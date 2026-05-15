from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional

from app.db.database import get_db
from app.services.dhan_client import DhanSyncService
from app.services.trade_service import TradeService

router = APIRouter(prefix="/trades/dhan", tags=["dhan-sync"])


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
            trade_svc.find_or_create_pair(open_leg, close_leg)
            added += 1

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
                trade_svc.create_from_dhan_leg(close_leg, is_open=False)
                added += 1

    return {
        "days_fetched": len(day_trades),
        "trades_added": added,
        "trades_skipped": skipped,
    }
