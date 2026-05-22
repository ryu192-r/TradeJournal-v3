from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class PartialExit(Base):
    __tablename__ = 'partial_exits'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False, index=True)
    qty = Column(Numeric(precision=18, scale=8), nullable=False)
    exit_price = Column(Numeric(precision=18, scale=8), nullable=False)
    exit_time = Column(DateTime, nullable=False)
    realized_pnl = Column(Numeric(precision=18, scale=8))
    r_captured = Column(Numeric(precision=10, scale=4))
    exit_reason = Column(String(30))
    note = Column(String(500))
    created_at = Column(DateTime, server_default=func.now())

    trade = relationship("Trade", back_populates="partial_exits")


Index('ix_partial_exits_trade_exit_time', PartialExit.trade_id, PartialExit.exit_time)
