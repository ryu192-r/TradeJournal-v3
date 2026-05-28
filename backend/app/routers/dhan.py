from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
import logging

from app.db.database import get_db
from app.services.dhan_client import DhanSyncService
from app.services.trade_service import TradeService
from app.core.dependencies import get_current_user
from app.services.capital_service import _auto_reconcile
from app.services.setup_playbook_service import _update_setup_stats
from app.models.user import User

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades/dhan", tags=["dhan-sync"])
logger = logging.getLogger(__name__)


@router.post("/sync")
def sync_dhan_trades(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sync trades from Dhan for a date range. Idempotent."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    svc = DhanSyncService()
    trade_svc = TradeService(db)

    try:
        day_trades = svc.get_range_trades(from_date, to_date)
    except Exception as e:
        logger.warning("dhan_api_error", user_id=current_user.id, error=str(e))
        raise HTTPException(status_code=502, detail=f"Dhan API error: {str(e)}")

    added = 0
    skipped = 0
    updated = 0
    errors = []
    setups_seen = set()

    from app.services.import_normalization import parse_datetime

    for day in day_trades:
        opens = {t.exchange_order_id: t for t in day.trades if t.leg_type == "OPEN"}
        closes = {t.exchange_order_id: t for t in day.trades if t.leg_type == "CLOSE"}

        for oid, open_leg in opens.items():
            close_leg = closes.get(oid)
            try:
                trade, action, info = trade_svc.import_trade({
                    "user_id": current_user.id,
                    "symbol": open_leg.trading_symbol,
                    "direction": "LONG",
                    "entry_price": open_leg.price,
                    "exit_price": close_leg.price if close_leg else None,
                    "quantity": open_leg.quantity,
                    "entry_time": parse_datetime(open_leg.order_timestamp),
                    "exit_time": parse_datetime(close_leg.order_timestamp) if close_leg else None,
                    "fees": 0,
                    "external_order_id": oid,
                    "import_source": "dhan_sync",
                }, defer_commit=True)
            except Exception as e:
                logger.warning("dhan_sync_import_failed", user_id=current_user.id, oid=oid, error=str(e))
                errors.append({"oid": oid, "error": str(e)})
                db.rollback()
                continue

            if action == "created":
                added += 1
            elif action == "updated":
                updated += 1
            else:
                skipped += 1
            if trade and trade.setup:
                setups_seen.add(trade.setup)

        # Unmatched CLOSE legs — trade unmatched, not an invalid import
        for oid, close_leg in closes.items():
            if oid in opens:
                continue
            errors.append({
                "oid": oid,
                "symbol": close_leg.trading_symbol,
                "error": "unmatched_close_leg",
                "detail": "No matching OPEN leg found for this CLOSE — not imported",
            })
            continue

    if added or updated or errors:
        try:
            for setup_name in setups_seen:
                _update_setup_stats(db, setup_name, user_id=current_user.id)
            _auto_reconcile(db, user_id=current_user.id)
            db.commit()
        except Exception as e:
            logger.warning("dhan_sync_side_effects_failed", user_id=current_user.id, error=str(e))
            db.rollback()

    logger.info(
        "dhan_sync_completed",
        user_id=current_user.id,
        added=added,
        skipped=skipped,
        updated=updated,
        errors=len(errors),
    )

    return {
        "status": "success" if not errors else "partial_errors",
        "days_fetched": len(day_trades),
        "trades_added": added,
        "trades_skipped": skipped,
        "trades_updated": updated,
        "errors": errors,
    }
