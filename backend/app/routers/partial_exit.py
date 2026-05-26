from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal

from app.schemas.partial_exit import PartialExitCreate, PartialExitResponse, PartialExitListResponse
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.trade_timeline import TradeTimeline
from app.db.database import get_db
from app.models.account import Account
from app.routers.capital_events import _reconcile_account

router = APIRouter(prefix="/trades/{trade_id}/partial-exits", tags=["partial-exits"])


def _auto_reconcile(db: Session):
    account = db.query(Account).first()
    if account:
        _reconcile_account(account.id, db)


def _remaining_qty(trade: Trade, db: Session) -> Decimal:
    exited = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id == trade.id)
        .with_entities(PartialExit.qty)
        .all()
    )
    total_exited = sum(r[0] for r in exited)
    return trade.quantity - total_exited


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
    remaining = _remaining_qty(trade, db)
    return {"items": exits, "remaining_qty": str(remaining)}


@router.post("", response_model=PartialExitResponse, status_code=status.HTTP_201_CREATED)
def create_partial_exit(trade_id: int, payload: PartialExitCreate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")

    if trade.exit_price is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add partial exit to a fully closed trade")

    remaining = _remaining_qty(trade, db)
    if payload.qty >= remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Qty {payload.qty} must be less than remaining {remaining}. Use full close for remaining quantity.",
        )

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

    _auto_reconcile(db)
    db.commit()
    db.refresh(entry)

    return entry


@router.delete("/{exit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partial_exit(trade_id: int, exit_id: int, db: Session = Depends(get_db)):
    exit_entry = db.query(PartialExit).filter(PartialExit.id == exit_id, PartialExit.trade_id == trade_id).first()
    if not exit_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partial exit not found")

    # Clean up associated timeline entries
    db.query(TradeTimeline).filter(
        TradeTimeline.trade_id == trade_id,
        TradeTimeline.event_type == "partial_exit",
        TradeTimeline.new_value == f"qty={exit_entry.qty} @ {exit_entry.exit_price}",
    ).delete(synchronize_session="fetch")

    db.delete(exit_entry)
    _auto_reconcile(db)
    db.commit()

    return None
