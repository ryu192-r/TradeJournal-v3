from sqlalchemy import Column, Integer, String, Numeric, DateTime, UniqueConstraint, Index
from sqlalchemy.sql import func
from app.models.base import Base


class MarketCandle(Base):
    __tablename__ = 'market_candles'
    __table_args__ = (
        UniqueConstraint('symbol', 'timeframe', 'timestamp', 'source', name='uq_candle_symbol_tf_ts_source'),
        Index('ix_candle_symbol_timeframe', 'symbol', 'timeframe'),
        Index('ix_candle_symbol_timeframe_ts', 'symbol', 'timeframe', 'timestamp'),
    )

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    timeframe = Column(String(10), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    open = Column(Numeric(precision=18, scale=4), nullable=False)
    high = Column(Numeric(precision=18, scale=4), nullable=False)
    low = Column(Numeric(precision=18, scale=4), nullable=False)
    close = Column(Numeric(precision=18, scale=4), nullable=False)
    volume = Column(Integer)
    source = Column(String(20), nullable=False, default='cache')
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())