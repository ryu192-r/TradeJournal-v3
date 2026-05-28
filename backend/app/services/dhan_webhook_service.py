"""Dhan webhook processing service for stop-loss/target hit notifications."""
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.trade import Trade
from app.models.stop_history import StopHistory
from app.models.trade_timeline import TradeTimeline
from app.services.capital_service import _auto_reconcile
from app.services.setup_playbook_service import _update_setup_stats

logger = logging.getLogger(__name__)

VALID_EXIT_REASONS = {"stop_loss", "target", "manual", "trailing", "system"}

ORDER_TYPE_TO_EXIT_REASON = {
    "SL": "stop_loss",
    "SL-M": "stop_loss",
    "LIMIT": "manual",
    "MARKET": "manual",
}


class WebhookProcessingError(Exception):
    """Error during webhook processing."""
    pass


class DhanWebhookService:
    """Process Dhan webhook events and update trade state."""

    def __init__(self, db: Session, user_id: Optional[int] = None):
        self.db = db
        self.user_id = user_id
        self.logger = logger.getChild("dhan_webhook")

    def process_event(
        self,
        symbol: str,
        direction: str,
        exit_price: Decimal,
        exit_time: datetime,
        order_type: str,
        order_id: str,
        fees: Decimal = Decimal("0"),
        stop_price: Optional[Decimal] = None,
        target_price: Optional[Decimal] = None,
        remarks: Optional[str] = None,
        event_id: Optional[str] = None,
        defer_commit: bool = False,
    ) -> Tuple[Optional[Trade], Optional[WebhookProcessingError]]:
        """Process single webhook event. Matches open trade by symbol + direction + user_id.

        Persistent dedup: checks TradeTimeline for event_id before processing.
        Returns early (None, None) if event_id was already processed.
        """
        try:
            if event_id:
                existing_tl = self.db.query(TradeTimeline).filter(
                    TradeTimeline.note.like(f"%event_id={event_id}%"),
                ).first()
                if existing_tl:
                    self.logger.info("webhook_event_already_processed", event_id=event_id)
                    return None, None

            trade = self._find_matching_trade(symbol, direction)
            if not trade:
                self.logger.info("no_matching_trade", symbol=symbol, direction=direction, user_id=self.user_id, event_id=event_id)
                return None, None

            exit_reason = self._determine_exit_reason(
                order_type=order_type,
                trade=trade,
                exit_price=exit_price,
                stop_price=stop_price,
                target_price=target_price,
                remarks=remarks,
            )

            trade.exit_price = exit_price
            trade.exit_time = exit_time
            trade.fees = (trade.fees or Decimal("0")) + fees
            trade.exit_reason = exit_reason
            trade.status = self._status_from_exit_reason(exit_reason)
            trade.exit_notes = remarks or f"Webhook exit: {order_type}"
            trade.external_order_id = order_id
            trade.import_source = "dhan_webhook"

            trade.compute_pnl()

            if exit_reason in ("stop_loss", "target"):
                self._record_stop_history(
                    trade=trade,
                    exit_reason=exit_reason,
                    price=exit_price,
                    timestamp=exit_time,
                )

            tl = TradeTimeline(
                trade_id=trade.id,
                event_type="trade_closed",
                new_value=f"PnL={trade.pnl}",
                note=f"webhook exit_reason={exit_reason} event_id={event_id or 'none'}",
            )
            self.db.add(tl)

            _update_setup_stats(self.db, trade.setup, user_id=self.user_id)
            _auto_reconcile(self.db, user_id=self.user_id)

            if not defer_commit:
                self.db.commit()
                self.db.refresh(trade)

            self.logger.info(
                "trade_closed_via_webhook",
                trade_id=trade.id,
                symbol=symbol,
                direction=direction,
                exit_reason=exit_reason,
                status=trade.status,
                event_id=event_id,
            )
            return trade, None

        except Exception as e:
            self.db.rollback()
            error = WebhookProcessingError(f"Failed to process webhook: {str(e)}")
            self.logger.error("webhook_processing_failed", symbol=symbol, direction=direction, error=str(e), event_id=event_id)
            return None, error

    def _find_matching_trade(self, symbol: str, direction: str) -> Optional[Trade]:
        open_statuses = ("open",)
        q = (
            self.db.query(Trade)
            .filter(
                and_(
                    Trade.symbol == symbol,
                    Trade.direction == direction,
                    Trade.status.in_(open_statuses),
                    Trade.exit_price.is_(None),
                )
            )
            .order_by(Trade.entry_time)
        )
        if self.user_id is not None:
            q = q.filter(Trade.user_id == self.user_id)
        return q.first()

    def _determine_exit_reason(
        self,
        order_type: str,
        trade: Trade,
        exit_price: Decimal,
        stop_price: Optional[Decimal],
        target_price: Optional[Decimal],
        remarks: Optional[str],
    ) -> str:
        if remarks:
            remarks_lower = remarks.lower()
            if "target" in remarks_lower:
                return "target"
            if "stop" in remarks_lower or "sl" in remarks_lower:
                return "stop_loss"

        if order_type in ("SL", "SL-M"):
            if stop_price and trade.stop_price:
                return "stop_loss"
            return ORDER_TYPE_TO_EXIT_REASON.get(order_type, "system")

        if order_type == "LIMIT":
            if target_price and trade.target_price:
                return "target"

        return ORDER_TYPE_TO_EXIT_REASON.get(order_type, "system")

    def _status_from_exit_reason(self, exit_reason: str) -> str:
        status_map = {
            "stop_loss": "closed_sl_hit",
            "target": "closed_target_hit",
            "manual": "closed_manual",
            "trailing": "closed_sl_hit",
            "system": "closed_manual",
        }
        return status_map.get(exit_reason, "closed_manual")

    def _record_stop_history(self, trade: Trade, exit_reason: str, price: Decimal, timestamp: datetime) -> None:
        stop_type_map = {"stop_loss": "initial", "target": "target"}
        stop_type = stop_type_map.get(exit_reason, "initial")
        entry = StopHistory(
            trade_id=trade.id,
            stop_type=stop_type,
            price=price,
            timestamp=timestamp,
        )
        self.db.add(entry)
        self.logger.info("stop_history_recorded", trade_id=trade.id, stop_type=stop_type, price=str(price))
