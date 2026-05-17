"""Dhan webhook processing service for stop-loss/target hit notifications."""
import structlog
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.trade import Trade
from app.models.stop_history import StopHistory

logger = structlog.get_logger()

# Valid exit reasons
VALID_EXIT_REASONS = {"stop_loss", "target", "manual", "trailing", "system"}

# Map Dhan order types to exit reasons
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

    def __init__(self, db: Session):
        self.db = db
        self.logger = logger.bind(component="dhan_webhook")

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
    ) -> Tuple[Optional[Trade], Optional[WebhookProcessingError]]:
        """Process a single webhook event.

        Matches against open trades by symbol + direction.
        If multiple open trades exist, matches the earliest entry_time.

        Returns:
            Tuple of (updated_trade, error)
            - On success: (trade, None)
            - On no match: (None, None) -- caller should log as unmatched
            - On error: (None, error)
        """
        try:
            # Find matching open trade
            trade = self._find_matching_trade(symbol, direction)
            if not trade:
                self.logger.info(
                    "no_matching_trade",
                    symbol=symbol,
                    direction=direction,
                )
                return None, None

            # Determine exit reason
            exit_reason = self._determine_exit_reason(
                order_type=order_type,
                trade=trade,
                exit_price=exit_price,
                stop_price=stop_price,
                target_price=target_price,
                remarks=remarks,
            )

            # Update trade
            trade.exit_price = exit_price
            trade.exit_time = exit_time
            trade.fees = (trade.fees or Decimal("0")) + fees
            trade.exit_reason = exit_reason
            trade.status = self._status_from_exit_reason(exit_reason)
            trade.exit_notes = remarks or f"Webhook exit: {order_type}"

            trade.compute_pnl()

            # Record stop history if SL or target hit
            if exit_reason in ("stop_loss", "target"):
                self._record_stop_history(
                    trade=trade,
                    exit_reason=exit_reason,
                    price=exit_price,
                    timestamp=exit_time,
                )

            self.db.commit()
            self.db.refresh(trade)

            self.logger.info(
                "trade_closed_via_webhook",
                trade_id=trade.id,
                symbol=symbol,
                direction=direction,
                exit_reason=exit_reason,
                status=trade.status,
            )

            return trade, None

        except Exception as e:
            self.db.rollback()
            error = WebhookProcessingError(f"Failed to process webhook: {str(e)}")
            self.logger.error(
                "webhook_processing_failed",
                symbol=symbol,
                direction=direction,
                error=str(e),
            )
            return None, error

    def _find_matching_trade(self, symbol: str, direction: str) -> Optional[Trade]:
        """Find an open trade matching symbol and direction.

        Prioritizes by: analytics > reviewed > draft
        Within same status, picks earliest entry_time.
        """
        # Query open trades with priority statuses
        open_statuses = ("open",)
        trade = (
            self.db.query(Trade)
            .filter(
                and_(
                    Trade.symbol == symbol,
                    Trade.direction == direction,
                    Trade.status.in_(open_statuses),
                    Trade.exit_price.is_(None),  # Not already exited
                )
            )
            .order_by(Trade.status, Trade.entry_time)
            .first()
        )
        return trade

    def _determine_exit_reason(
        self,
        order_type: str,
        trade: Trade,
        exit_price: Decimal,
        stop_price: Optional[Decimal],
        target_price: Optional[Decimal],
        remarks: Optional[str],
    ) -> str:
        """Determine the exit reason from order type and trade context.

        Priority:
        1. If order_type is SL/SL-M and price matches stop_price → stop_loss
        2. If order_type is LIMIT and price matches target_price → target
        3. If order_type is MARKET → could be system or manual
        4. Fall back to order_type mapping
        """
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
        """Map exit reason to trade status."""
        status_map = {
            "stop_loss": "closed_sl_hit",
            "target": "closed_target_hit",
            "manual": "closed_manual",
            "trailing": "closed_sl_hit",  # Trailing SL hit maps to SL hit
            "system": "closed_manual",    # System exits map to manual
        }
        return status_map.get(exit_reason, "closed_manual")

    def _record_stop_history(
        self,
        trade: Trade,
        exit_reason: str,
        price: Decimal,
        timestamp: datetime,
    ) -> None:
        """Record a stop_history entry for the exit."""
        stop_type_map = {
            "stop_loss": "initial",
            "target": "target",
        }
        stop_type = stop_type_map.get(exit_reason, "initial")

        stop_entry = StopHistory(
            trade_id=trade.id,
            stop_type=stop_type,
            price=price,
            timestamp=timestamp,
        )
        self.db.add(stop_entry)
        self.logger.info(
            "stop_history_recorded",
            trade_id=trade.id,
            stop_type=stop_type,
            price=str(price),
        )
