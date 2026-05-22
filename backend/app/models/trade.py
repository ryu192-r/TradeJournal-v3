from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Boolean, Text, Index, event, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from app.utils.decimal_utils import TagsList
from app.utils.calculations import calculate_trade_metrics
from decimal import Decimal


class Trade(Base):
    __tablename__ = 'trades'

    id = Column(Integer, primary_key=True, index=True)
    
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
    stop_price = Column(Numeric(precision=18, scale=8))
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
    
    # Timestamps (auto-managed)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    stop_history_entries = relationship("StopHistory", back_populates="trade")
    capital_events = relationship("CapitalEvent", back_populates="trade")
    source_idea = relationship("TradeIdea", back_populates="traded_trade", uselist=False)
    timeline_entries = relationship("TradeTimeline", back_populates="trade", order_by="TradeTimeline.timestamp")
    partial_exits = relationship("PartialExit", back_populates="trade", order_by="PartialExit.exit_time")
    emotion_logs = relationship("EmotionLog", back_populates="trade", order_by="EmotionLog.timestamp")
    execution_grade = relationship("ExecutionGrade", back_populates="trade", uselist=False)

    def compute_pnl(self):
        """Auto-compute PnL and R-multiple using shared calculation module."""
        calc = calculate_trade_metrics(
            entry_price=self.entry_price,
            exit_price=self.exit_price,
            quantity=self.quantity,
            fees=self.fees or Decimal('0'),
            stop_price=self.stop_price,
            target_price=self.target_price,
            direction=self.direction,
        )
        self.pnl = calc.net_pnl
        if calc.r_multiple is not None:
            self.r_multiple = calc.r_multiple
        return self.pnl


# Indexes for common query patterns
Index('ix_trades_symbol_status', Trade.symbol, Trade.status)
Index('ix_trades_entry_time_exit_time', Trade.entry_time, Trade.exit_time)
Index('ix_trades_status', Trade.status)
Index('ix_trades_status_exit_entry', Trade.status, Trade.exit_price, Trade.entry_time)
Index('ix_trades_setup_status', Trade.setup, Trade.status)

# Auto-update updated_at on modification
@event.listens_for(Trade, 'before_update')
def receive_before_update(mapper, connection, target):
    target.compute_pnl()
    target.updated_at = func.now()
