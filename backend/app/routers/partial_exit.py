from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from decimal import Decimal

from app.schemas.partial_exit import PartialExitCreate, PartialExitResponse, PartialExitListResponse
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.trade_timeline import TradeTimeline
from app.db.database import get_db

router = APIRouter(prefix="/trades/{trade_id}/partial-exits", tags=["partial-exits"])


@router.get("", response_model=PartialExitListResponse)
def list_partial_exits(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    exits = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id == trade_id)
        .order_by(PartialExit.exit_time.asc())
        .all()
    )
    return {"items": exits}


@router.post("", response_model=PartialExitResponse, status_code=status.HTTP_201_CREATED)
def create_partial_exit(trade_id: int, payload: PartialExitCreate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    realized_pnl = payload.realized_pnl
    if realized_pnl is None and trade.entry_price:
        realized_pnl = (payload.exit_price - trade.entry_price) * payload.qty
        if trade.fees:
            realized_pnl -= Decimal(str(trade.fees)) * (payload.qty / trade.quantity)

    r_captured = payload.r_captured
    if r_captured is None and trade.stop_price and trade.entry_price:
        risk = trade.entry_price - trade.stop_price
        if risk and risk != 0:
            r_captured = ((payload.exit_price - trade.entry_price) * payload.qty) / (risk * payload.qty)

    entry = PartialExit(
        trade_id=trade_id,
        qty=payload.qty,
        exit_price=payload.exit_price,
        exit_time=payload.exit_time,
        realized_pnl=realized_pnl,
        r_captured=r_captured,
        exit_reason=payload.exit_reason,
        note=payload.note,
    )
    db.add(entry)

    timeline = TradeTimeline(
        trade_id=trade_id,
        event_type="partial_exit",
        timestamp=payload.exit_time,
        new_value=f"qty={payload.qty} @ {payload.exit_price}",
        note=payload.note,
    )
    db.add(timeline)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{exit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partial_exit(trade_id: int, exit_id: int, db: Session = Depends(get_db)):
    exit_entry = db.query(PartialExit).filter(PartialExit.id == exit_id, PartialExit.trade_id == trade_id).first()
    if not exit_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partial exit not found")
    db.delete(exit_entry)
    db.commit()
    return None