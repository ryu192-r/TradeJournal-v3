from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base
from decimal import Decimal


class CapitalEvent(Base):
    __tablename__ = 'capital_events'

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False)  # deposit, withdrawal, profit, fee, adjustment
    amount = Column(Numeric(precision=18, scale=8), nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    description = Column(String(200))
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=True)  # Optional reference to trade
    # NOTE: account_id FK added by sibling task t_b90546a4 — do not re-add this column.
    account_id = Column(Integer, ForeignKey('accounts.id'), nullable=True)

    # Relationships
    trade = relationship("Trade", back_populates="capital_events")
    account = relationship("Account", back_populates="capital_events")
