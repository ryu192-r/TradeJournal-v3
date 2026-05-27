from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.db.database import get_db
from app.services.dhan_client import DhanSyncService
from app.services.trade_service import TradeService
from app.core.dependencies import get_current_user
from app.services.capital_service import _auto_reconcile
from app.services.setup_playbook_service import _update_setup_stats

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades/dhan", tags=["dhan-sync"])


@router.post("/sync")
def sync_dhan_trades(
    from_date: date,
    to_date: date,
    db: Session = Depends(get_db),
):
    """Sync trades from Dhan for a date range."""
    if from_date > to_date:
        raise HTTPException(status_code=400, detail="from_date must be <= to_date")

    svc = DhanSyncService()
    trade_svc = TradeService(db)

    try:
        day_trades = svc.get_range_trades(from_date, to_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Dhan API error: {str(e)}")

    added = 0
    skipped = 0
    setups_seen = set()
    for day in day_trades:
        # Pair OPEN/CLOSE legs
        opens = {t.exchange_order_id: t for t in day.trades if t.leg_type == "OPEN"}
        closes = {t.exchange_order_id: t for t in day.trades if t.leg_type == "CLOSE"}

        for oid, open_leg in opens.items():
            close_leg = closes.get(oid)
            existing = trade_svc.get_by_symbol_time(
                open_leg.trading_symbol,
                open_leg.order_timestamp,
                close_leg.order_timestamp if close_leg else None,
            )
            if existing:
                skipped += 1
                continue
            trade = trade_svc.find_or_create_pair(open_leg, close_leg)
            added += 1
            if trade.setup:
                setups_seen.add(trade.setup)

        # Unmatched CLOSE legs (single-leg close without open)
        for oid, close_leg in closes.items():
            if oid not in opens:
                existing = trade_svc.get_by_symbol_time(
                    close_leg.trading_symbol,
                    close_leg.order_timestamp,
                    None,
                )
                if existing:
                    skipped += 1
                    continue
                trade = trade_svc.create_from_dhan_leg(close_leg, is_open=False)
                added += 1
                if trade.setup:
                    setups_seen.add(trade.setup)

    for setup_name in setups_seen:
        _update_setup_stats(db, setup_name)
    _auto_reconcile(db)
    db.commit()

    return {
        "days_fetched": len(day_trades),
        "trades_added": added,
        "trades_skipped": skipped,
    }
