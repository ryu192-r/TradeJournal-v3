from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Boolean, Text, Index, event, JSON
from sqlalchemy.orm import relationship, object_session
from sqlalchemy.sql import func
from app.models.base import Base
from app.utils.decimal_utils import TagsList
from app.utils.calculations import calculate_trade_metrics
from decimal import Decimal

STOP_LOSS_STATUSES = {"original", "breakeven", "trailing", "manual", "risk_free", "profit_locked"}
PROTECTIVE_STOP_STATUSES = {"breakeven", "risk_free", "profit_locked"}


class Trade(Base):
    __tablename__ = 'trades'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)

    # Core trade fields
    symbol = Column(String(20), nullable=False, index=True)
    direction = Column(String(10), nullable=False, default='LONG')  # Always LONG for Indian equities
    entry_price = Column(Numeric(precision=18, scale=8), nullable=False)
    exit_price = Column(Numeric(precision=18, scale=8))
    quantity = Column(Numeric(precision=18, scale=8), nullable=False)
    entry_time = Column(DateTime, nullable=False, index=True)
    exit_time = Column(DateTime)
    fees = Column(Numeric(precision=18, scale=8), default=Decimal('0'))
    pnl = Column(Numeric(precision=18, scale=8))  # Computed field
    
    # Management
    notes = Column(Text)
    tags = Column(TagsList)
    setup = Column(String(100))
    tactic = Column(String(100))
    # stop_price = current/live stop used for position protection
    stop_price = Column(Numeric(precision=18, scale=8))
    # original_stop_price = planned/original stop used for risk/R-multiple truth
    original_stop_price = Column(Numeric(precision=18, scale=8))
    stop_loss_status = Column(String(20), default="original")  # original/manual/trailing vs breakeven/profit_locked protection
    target_price = Column(Numeric(precision=18, scale=8))
    r_multiple = Column(Numeric(precision=10, scale=4))
    
    # Status lifecycle
    status = Column(String(20), default='open')  # open, closed, deleted
    review_notes = Column(Text)
    review_tags = Column(TagsList)
    chart_images = Column(JSON, default=list)  # JSON array of image paths

    # Exit tracking
    exit_reason = Column(String(20))  # stop_loss, target, manual, trailing, system
    exit_notes = Column(Text)

    # Import identity (idempotency + dedup)
    import_source = Column(String(30))
    import_fingerprint = Column(String(64))
    external_order_id = Column(String(100))

    # Timestamps (auto-managed)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="trades")
    stop_history_entries = relationship("StopHistory", back_populates="trade")
    capital_events = relationship("CapitalEvent", back_populates="trade")
    source_idea = relationship("TradeIdea", back_populates="traded_trade", uselist=False)
    timeline_entries = relationship("TradeTimeline", back_populates="trade", order_by="TradeTimeline.timestamp")
    partial_exits = relationship("PartialExit", back_populates="trade", order_by="PartialExit.exit_time")
    emotion_logs = relationship("EmotionLog", back_populates="trade", order_by="EmotionLog.timestamp")
    execution_grade = relationship("ExecutionGrade", back_populates="trade", uselist=False)

    def _auto_set_status(self):
        """Auto-set status based on exit_price. Preserves 'deleted' and granular closed statuses."""
        if self.status == "deleted":
            return
        if self.exit_price is not None:
            # Preserve webhook/exit-reason-specific statuses; only set generic closed from open states
            if self.status in ("open", "draft", "reviewed", "analytics"):
                self.status = "closed"
        else:
            self.status = "open"

    def _planned_stop_price(self):
        """Risk truth: original planned stop. Falls back to current stop for legacy rows."""
        return self.original_stop_price if self.original_stop_price is not None else self.stop_price

    def _stop_protection_delta(self):
        if self.stop_price is None or self.entry_price is None:
            return None
        direction = (self.direction or "LONG").upper()
        if direction == "LONG":
            return Decimal(str(self.stop_price)) - Decimal(str(self.entry_price))
        return Decimal(str(self.entry_price)) - Decimal(str(self.stop_price))

    def _is_risk_free_stop(self) -> bool:
        delta = self._stop_protection_delta()
        return delta is not None and delta >= Decimal("0")

    def _derive_stop_loss_status(self, requested_status: str | None = None) -> str | None:
        """Derive protection state from current stop, keeping planned stop separate."""
        requested = requested_status or self.stop_loss_status
        delta = self._stop_protection_delta()
        if delta is None:
            return requested
        if delta == Decimal("0"):
            return "breakeven"
        if delta > Decimal("0"):
            return "profit_locked"
        if requested in STOP_LOSS_STATUSES and requested not in PROTECTIVE_STOP_STATUSES:
            return requested
        return "original"

    def sync_stop_loss_state(self, requested_status: str | None = None):
        """Sync current-stop protection state without changing planned risk truth."""
        # Backfill only when no planned stop exists; callers changing current SL should
        # preserve old stop before assignment so original risk truth is not overwritten.
        if self.original_stop_price is None and self.stop_price is not None:
            self.original_stop_price = self.stop_price
        self.stop_loss_status = self._derive_stop_loss_status(requested_status)

    def _sync_stop_loss_state(self):
        self.sync_stop_loss_state()

    def compute_pnl(self):
        """Auto-compute PnL and R-multiple. Direction-aware. Handles partial exits
        for both open and closed trades."""
        self._auto_set_status()
        self._sync_stop_loss_state()
        direction = (self.direction or "LONG").upper()
        is_long = direction == "LONG"
        planned_stop = self._planned_stop_price()

        # Gather partial exits from DB or relationship
        partials = []
        session = object_session(self)
        if session is not None and self.id is not None:
            from app.models.partial_exit import PartialExit
            partials = session.query(PartialExit).filter(PartialExit.trade_id == self.id).all()
        else:
            partials = list(self.partial_exits or [])

        total_exited_qty = sum(p.qty for p in partials)
        quantity = self.quantity or Decimal('0')
        remaining_qty = quantity - total_exited_qty
        partial_realized = sum(p.realized_pnl or Decimal('0') for p in partials)

        # Clamp remaining_qty to avoid negatives from data corruption
        if remaining_qty < 0:
            remaining_qty = Decimal('0')

        fees = self.fees or Decimal('0')

        if self.exit_price is not None and partials:
            # Closed trade with partial exits: total PnL = partial_realized + remaining leg
            fee_share = Decimal('0')
            if quantity > 0 and remaining_qty > 0:
                fee_share = fees * (remaining_qty / quantity)
            direction_mult = Decimal('1') if is_long else Decimal('-1')
            remaining_pnl = (self.exit_price - self.entry_price) * direction_mult * remaining_qty - fee_share
            self.pnl = partial_realized + remaining_pnl
        elif self.exit_price is not None:
            # Closed trade without partial exits — standard calculation
            calc = calculate_trade_metrics(
                entry_price=self.entry_price,
                exit_price=self.exit_price,
                quantity=quantity,
                fees=fees,
                stop_price=planned_stop,
                target_price=self.target_price,
                direction=direction,
            )
            self.pnl = calc.net_pnl
            if calc.r_multiple is not None:
                self.r_multiple = calc.r_multiple
            return self.pnl
        elif partials:
            # Open trade with partial exits: pnl stays null (no full exit)
            self.pnl = None
        else:
            # Open trade without partials or exit
            self.pnl = None

        # R-multiple for partial or full closed trades
        if planned_stop and self.entry_price and self.pnl is not None and quantity > 0:
            if is_long:
                risk_per_unit = self.entry_price - planned_stop
            else:
                risk_per_unit = planned_stop - self.entry_price
            risk = risk_per_unit * quantity
            if risk and risk > 0:
                self.r_multiple = self.pnl / risk
            else:
                self.r_multiple = None
        elif self.pnl is None and partials:
            self.r_multiple = None

        return self.pnl


# Indexes for common query patterns
Index('ix_trades_user_status', Trade.user_id, Trade.status)
Index('ix_trades_user_entry_time', Trade.user_id, Trade.entry_time)
Index('ix_trades_symbol_status', Trade.symbol, Trade.status)
Index('ix_trades_entry_time_exit_time', Trade.entry_time, Trade.exit_time)
Index('ix_trades_status', Trade.status)
Index('ix_trades_status_exit_entry', Trade.status, Trade.exit_price, Trade.entry_time)
Index('ix_trades_setup_status', Trade.setup, Trade.status)
Index('ix_trades_import_fingerprint', Trade.user_id, Trade.import_fingerprint)

# Auto-update updated_at on modification
@event.listens_for(Trade, 'before_update')
def receive_before_update(mapper, connection, target):
    target.compute_pnl()
    target.updated_at = func.now()
