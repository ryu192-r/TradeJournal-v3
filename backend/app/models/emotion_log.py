from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class EmotionLog(Base):
    __tablename__ = 'emotion_logs'

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(Integer, ForeignKey('trades.id'), nullable=False, index=True)
    emotion = Column(String(30), nullable=False)
    confidence = Column(Integer)
    stress = Column(Integer)
    conviction = Column(Integer)
    patience = Column(Integer)
    focus = Column(Integer)
    note = Column(String(500))
    timestamp = Column(DateTime, nullable=False, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())

    trade = relationship("Trade", back_populates="emotion_logs")


VALID_EMOTIONS = {
    'calm', 'fearful', 'euphoric', 'revenge', 'fomo', 'hesitant', 'disciplined',
}


Index('ix_emotion_logs_trade_timestamp', EmotionLog.trade_id, EmotionLog.timestamp)
Index('ix_emotion_logs_emotion', EmotionLog.emotion)
