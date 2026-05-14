from sqlalchemy import Column, Integer, String, Text, DateTime, Numeric, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from app.models.base import Base


class TradeIdea(Base):
    __tablename__ = 'trade_ideas'

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), nullable=False)
    direction = Column(String(10), nullable=False)  # LONG or SHORT
    entry_price_target = Column(Numeric(precision=18, scale=8))
    stop_price = Column(Numeric(precision=18, scale=8))
    target_price = Column(Numeric(precision=18, scale=8))
    thesis = Column(Text)
    timeframe = Column(String(50))
    confidence = Column(String(20))  # LOW / MEDIUM / HIGH
    tags = Column(String(200))
    revisit_date = Column(DateTime)

    # Status machine: draft → active → traded / archived
    status = Column(String(20), nullable=False, default='draft')
    traded_trade_id = Column(Integer, ForeignKey('trades.id'), nullable=True)
    triggered_at = Column(DateTime)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Optional FK to Trade (populated when idea is converted to trade)
    traded_trade = relationship('Trade', back_populates='source_idea')

    __table_args__ = (
        Index('ix_trade_ideas_status', 'status'),
        Index('ix_trade_ideas_symbol', 'symbol'),
    )
