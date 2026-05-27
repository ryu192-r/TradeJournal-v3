from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, func, text
from sqlalchemy.orm import relationship
from app.models.base import Base
from decimal import Decimal


class Account(Base):
    __tablename__ = 'accounts'

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    broker = Column(String(100))
    account_number = Column(String(50))
    initial_balance = Column(Numeric(precision=18, scale=8), server_default=text('0'))
    current_balance = Column(Numeric(precision=18, scale=8), server_default=text('0'))
    currency = Column(String(10), default='INR')
    breakeven_threshold = Column(Numeric(precision=18, scale=8), server_default=text('500'))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="accounts")
    capital_events = relationship("CapitalEvent", back_populates="account")
