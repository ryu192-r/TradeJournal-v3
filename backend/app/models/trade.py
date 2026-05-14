from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Boolean, Text, Index, event, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
from decimal import Decimal


class Trade(Base):
    __tablename__ = 'trades'

    id = Column(Integer, primary_key=True, index=True)
    
    # Core trade fields
    symbol = Column(String(20), nullable=False, index=True)
    direction = Column(String(10), nullable=False)  # LONG or SHORT
    entry_price = Column(Numeric(precision=18, scale=8), nullable=False)
    exit_price = Column(Numeric(precision=18, scale=8))
    quantity = Column(Numeric(precision=18, scale=8), nullable=False)
    entry_time = Column(DateTime, nullable=False, index=True)
    exit_time = Column(DateTime)
    fees = Column(Numeric(precision=18, scale=8), default=Decimal('0'))
    pnl = Column(Numeric(precision=18, scale=8))  # Computed field
    
    # Management
    notes = Column(Text)
    tags = Column(String(200))
    setup = Column(String(100))
    tactic = Column(String(100))
    stop_price = Column(Numeric(precision=18, scale=8))
    target_price = Column(Numeric(precision=18, scale=8))
    r_multiple = Column(Numeric(precision=10, scale=4))
    
    # Status lifecycle
    status = Column(String(20), default='draft')  # draft, reviewed, analytics, closed_sl_hit, closed_target_hit, closed_manual, deleted
    review_notes = Column(Text)
    review_tags = Column(String(200))
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

    def compute_pnl(self):
        """Auto-compute PnL based on prices and direction."""
        if self.exit_price and self.entry_price and self.quantity:
            raw_pnl = (self.exit_price - self.entry_price) * self.quantity
            if self.direction == 'SHORT':
                raw_pnl = -raw_pnl
            self.pnl = raw_pnl - (self.fees or Decimal('0'))
        return self.pnl


# Indexes for common query patterns
Index('ix_trades_symbol_status', Trade.symbol, Trade.status)
Index('ix_trades_entry_time_exit_time', Trade.entry_time, Trade.exit_time)

# Auto-update updated_at on modification
@event.listens_for(Trade, 'before_update')
def receive_before_update(mapper, connection, target):
    target.compute_pnl()
    target.updated_at = func.now()
