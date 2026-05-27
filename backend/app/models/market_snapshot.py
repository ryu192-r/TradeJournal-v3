from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, JSON, Text, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class MarketSnapshot(Base):
    """Daily market environment snapshot — NIFTY regime, sector strength, breadth, volatility."""
    __tablename__ = 'market_snapshots'
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='uq_market_snapshots_user_date'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    nifty_close = Column(Numeric(precision=18, scale=4))
    nifty_change_pct = Column(Numeric(precision=10, scale=4))
    nifty_high = Column(Numeric(precision=18, scale=4))
    nifty_low = Column(Numeric(precision=18, scale=4))
    nifty_open = Column(Numeric(precision=18, scale=4))

    nifty_trend = Column(String(20))
    nifty_regime = Column(String(20))

    india_vix = Column(Numeric(precision=10, scale=4))
    atr_14 = Column(Numeric(precision=18, scale=4))
    atr_pct = Column(Numeric(precision=10, scale=4))

    advance_count = Column(Integer)
    decline_count = Column(Integer)
    advance_decline_ratio = Column(Numeric(precision=10, scale=4))

    sector_strength = Column(JSON, default=dict)
    fii_flow_cr = Column(Numeric(precision=18, scale=4))
    dii_flow_cr = Column(Numeric(precision=18, scale=4))

    is_earnings_season = Column(String(10), default='unknown')
    macro_events = Column(JSON, default=list)
    notes = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="market_snapshots")