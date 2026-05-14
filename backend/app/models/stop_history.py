from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base
from decimal import Decimal


class StopHistory(Base):
    __tablename__ = 'stop_history'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False)
    stop_type = Column(String(20), nullable=False)  # initial, manual, breakeven, trailing, target
    price = Column(Numeric(precision=18, scale=8), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    
    # Relationships
    trade = relationship("Trade", back_populates="stop_history_entries")


# Index for common query patterns
Index('ix_stop_history_trade_id', StopHistory.trade_id)