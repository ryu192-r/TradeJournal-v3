"""Partial exit service for business logic."""
from decimal import Decimal
from typing import Tuple, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.trade_timeline import TradeTimeline
from app.schemas.partial_exit import PartialExitCreate
from app.services.capital_service import _auto_reconcile
from app.services.setup_playbook_service import _update_setup_stats
from app.utils.calculations import calculate_trade_leg_pnl


def _remaining_qty(trade: Trade, db: Session) -> Decimal:
    exited = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id == trade.id)
        .with_entities(PartialExit.qty)
        .all()
    )
    total_exited = sum(r[0] for r in exited)
    return trade.quantity - total_exited


def _allocate_fee(total_fees: Decimal, leg_qty: Decimal, total_qty: Decimal) -> Decimal:
    """Proportionally allocate fees by quantity."""
    if total_qty <= 0:
        return Decimal('0')
    return (total_fees or Decimal('0')) * (leg_qty / total_qty)


class PartialExitService:
    def __init__(self, db: Session):
        self.db = db

    def _remaining_qty(self, trade: Trade) -> Decimal:
        exited = (
            self.db.query(PartialExit)
            .filter(PartialExit.trade_id == trade.id)
            .with_entities(PartialExit.qty)
            .all()
        )
        total_exited = sum(r[0] for r in exited)
        return trade.quantity - total_exited

    def list_partial_exits(self, trade_id: int, user_id: Optional[int] = None) -> Tuple[list, Decimal]:
        q = self.db.query(Trade).filter(Trade.id == trade_id)
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trade = q.first()
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found"
            )
        exits = (
            self.db.query(PartialExit)
            .filter(PartialExit.trade_id == trade_id)
            .order_by(PartialExit.exit_time.asc())
            .all()
        )
        remaining = self._remaining_qty(trade)
        return exits, remaining

    def create_partial_exit(self, trade_id: int, payload: PartialExitCreate, user_id: Optional[int] = None) -> PartialExit:
        q = self.db.query(Trade).filter(Trade.id == trade_id)
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trade = q.first()
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found"
            )

        if trade.exit_price is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add partial exit to a fully closed trade",
            )

        remaining = self._remaining_qty(trade)
        if payload.qty >= remaining:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Qty {payload.qty} must be less than remaining {remaining}. Use full close for remaining quantity.",
            )

        if payload.qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity must be positive",
            )

        if payload.exit_price <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exit price must be positive",
            )

        direction = (trade.direction or "LONG").upper()
        is_long = direction == "LONG"

        realized_pnl = payload.realized_pnl
        if realized_pnl is None and trade.entry_price:
            fee_share = _allocate_fee(trade.fees or Decimal('0'), payload.qty, trade.quantity)
            realized_pnl = calculate_trade_leg_pnl(
                direction, trade.entry_price, payload.exit_price, payload.qty, fee_share
            )

        r_captured = payload.r_captured
        planned_stop = trade.original_stop_price if trade.original_stop_price is not None else trade.stop_price
        if r_captured is None and planned_stop and trade.entry_price:
            if is_long:
                risk_per_unit = trade.entry_price - planned_stop
            else:
                risk_per_unit = planned_stop - trade.entry_price
            if risk_per_unit and risk_per_unit > 0:
                gross_pnl = (payload.exit_price - trade.entry_price if is_long else trade.entry_price - payload.exit_price) * payload.qty
                r_captured = gross_pnl / (risk_per_unit * payload.qty)

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
        self.db.add(entry)
        self.db.flush()

        timeline = TradeTimeline(
            trade_id=trade_id,
            event_type="partial_exit",
            timestamp=payload.exit_time,
            new_value=f"qty={payload.qty} @ {payload.exit_price}",
            note=payload.note,
        )
        self.db.add(timeline)

        trade.compute_pnl()
        trade.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        _auto_reconcile(self.db, user_id=trade.user_id)
        _update_setup_stats(self.db, trade.setup, user_id=trade.user_id)
        self.db.commit()
        self.db.refresh(entry)

        return entry

    def delete_partial_exit(self, trade_id: int, exit_id: int, user_id: Optional[int] = None) -> None:
        q = self.db.query(Trade).filter(Trade.id == trade_id)
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trade = q.first()
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found"
            )

        exit_entry = self.db.query(PartialExit).filter(
            PartialExit.id == exit_id, PartialExit.trade_id == trade_id
        ).first()
        if not exit_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Partial exit not found"
            )

        setup_name = trade.setup

        self.db.query(TradeTimeline).filter(
            TradeTimeline.trade_id == trade_id,
            TradeTimeline.event_type == "partial_exit",
            TradeTimeline.new_value.contains(str(exit_entry.exit_price.normalize())),
            TradeTimeline.timestamp == exit_entry.exit_time,
        ).delete(synchronize_session="fetch")

        self.db.delete(exit_entry)
        self.db.flush()

        trade.compute_pnl()
        trade.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        _auto_reconcile(self.db, user_id=trade.user_id)
        if setup_name:
            _update_setup_stats(self.db, setup_name, user_id=trade.user_id)
        self.db.commit()

        return None
