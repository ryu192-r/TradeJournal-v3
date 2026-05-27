"""Partial exit service for business logic."""
from decimal import Decimal
from typing import Tuple, Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.trade_timeline import TradeTimeline
from app.schemas.partial_exit import PartialExitCreate
from app.services.capital_service import _auto_reconcile
from app.services.setup_playbook_service import _update_setup_stats


def _remaining_qty(trade: Trade, db: Session) -> Decimal:
    exited = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id == trade.id)
        .with_entities(PartialExit.qty)
        .all()
    )
    total_exited = sum(r[0] for r in exited)
    return trade.quantity - total_exited


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

    def list_partial_exits(self, trade_id: int) -> Tuple[list, Decimal]:
        trade = self.db.query(Trade).filter(Trade.id == trade_id).first()
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

    def create_partial_exit(self, trade_id: int, payload: PartialExitCreate) -> PartialExit:
        trade = self.db.query(Trade).filter(Trade.id == trade_id).first()
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
        self.db.add(entry)

        timeline = TradeTimeline(
            trade_id=trade_id,
            event_type="partial_exit",
            timestamp=payload.exit_time,
            new_value=f"qty={payload.qty} @ {payload.exit_price}",
            note=payload.note,
        )
        self.db.add(timeline)

        _auto_reconcile(self.db)
        _update_setup_stats(self.db, trade.setup)
        self.db.commit()
        self.db.refresh(entry)

        return entry

    def delete_partial_exit(self, trade_id: int, exit_id: int) -> None:
        exit_entry = self.db.query(PartialExit).filter(
            PartialExit.id == exit_id, PartialExit.trade_id == trade_id
        ).first()
        if not exit_entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Partial exit not found"
            )

        trade = self.db.query(Trade).filter(Trade.id == trade_id).first()
        setup_name = trade.setup if trade else None

        self.db.query(TradeTimeline).filter(
            TradeTimeline.trade_id == trade_id,
            TradeTimeline.event_type == "partial_exit",
            TradeTimeline.new_value == f"qty={exit_entry.qty} @ {exit_entry.exit_price}",
        ).delete(synchronize_session="fetch")

        self.db.delete(exit_entry)
        _auto_reconcile(self.db)
        if setup_name:
            _update_setup_stats(self.db, setup_name)
        self.db.commit()

        return None
