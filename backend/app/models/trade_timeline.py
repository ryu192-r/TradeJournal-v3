from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class TradeTimeline(Base):
    __tablename__ = 'trade_timeline'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False, index=True)
    event_type = Column(String(30), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())
    old_value = Column(String(200))
    new_value = Column(String(200))
    note = Column(Text)
    emotion = Column(String(30))
    confidence = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    trade = relationship("Trade", back_populates="timeline_entries")


VALID_EVENT_TYPES = {
    'trade_opened', 'stop_updated', 'target_updated', 'pyramided',
    'partial_exit', 'note_added', 'conviction_changed', 'emotion_logged',
    'trade_closed', 'trade_deleted', 'review_added',
}

Index('ix_timeline_trade_event', TradeTimeline.trade_id, TradeTimeline.event_type)
