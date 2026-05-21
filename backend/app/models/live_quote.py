from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text
from sqlalchemy.sql import func
from app.models.base import Base


class LiveQuote(Base):
    """Cached live stock quote — refreshed on each Tapetide sync."""
    __tablename__ = 'live_quotes'

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), unique=True, index=True, nullable=False)
    company_name = Column(String(200))
    ltp = Column(Numeric(precision=18, scale=4))
    change = Column(Numeric(precision=18, scale=4))
    change_pct = Column(Numeric(precision=10, scale=4))
    volume = Column(Numeric(precision=18, scale=2))
    high_52w = Column(Numeric(precision=18, scale=4))
    low_52w = Column(Numeric(precision=18, scale=4))
    pe = Column(Numeric(precision=10, scale=4))
    market_cap_cr = Column(Numeric(precision=18, scale=4))
    sector = Column(String(100))

    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())