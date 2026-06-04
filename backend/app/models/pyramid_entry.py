from sqlalchemy import Column, Integer, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class PyramidEntry(Base):
    __tablename__ = 'pyramid_entries'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False, index=True)
    entry_price = Column(Numeric(precision=18, scale=8), nullable=False)
    quantity = Column(Numeric(precision=18, scale=8), nullable=False)
    entry_time = Column(DateTime, nullable=False)
    fees = Column(Numeric(precision=18, scale=8), server_default='0')
    created_at = Column(DateTime, server_default=func.now())

    trade = relationship("Trade", back_populates="pyramid_entries")


Index('ix_pyramid_entries_trade_time', PyramidEntry.trade_id, PyramidEntry.entry_time)
