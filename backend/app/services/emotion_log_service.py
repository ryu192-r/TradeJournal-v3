"""Emotion log service for business logic."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.trade_timeline import TradeTimeline
from app.schemas.emotion_log import EmotionLogCreate


class EmotionLogService:
    def __init__(self, db: Session):
        self.db = db

    def list_logs(self, trade_id: int, user_id: Optional[int] = None) -> list:
        q = self.db.query(Trade).filter(Trade.id == trade_id)
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trade = q.first()
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found"
            )
        logs = (
            self.db.query(EmotionLog)
            .filter(EmotionLog.trade_id == trade_id)
            .order_by(EmotionLog.timestamp.desc())
            .all()
        )
        return logs

    def create_log(self, trade_id: int, payload: EmotionLogCreate, user_id: Optional[int] = None) -> EmotionLog:
        q = self.db.query(Trade).filter(Trade.id == trade_id)
        if user_id is not None:
            q = q.filter(Trade.user_id == user_id)
        trade = q.first()
        if not trade:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found"
            )
        entry = EmotionLog(
            trade_id=trade_id,
            emotion=payload.emotion,
            confidence=payload.confidence,
            stress=payload.stress,
            conviction=payload.conviction,
            patience=payload.patience,
            focus=payload.focus,
            note=payload.note,
            timestamp=payload.timestamp or datetime.now(timezone.utc).replace(tzinfo=None),
        )
        self.db.add(entry)

        timeline = TradeTimeline(
            trade_id=trade_id,
            event_type="emotion_logged",
            timestamp=entry.timestamp,
            new_value=payload.emotion,
            note=payload.note,
            confidence=payload.confidence,
            emotion=payload.emotion,
        )
        self.db.add(timeline)

        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete_log(self, trade_id: int, log_id: int, user_id: Optional[int] = None) -> None:
        log = self.db.query(EmotionLog).filter(
            EmotionLog.id == log_id, EmotionLog.trade_id == trade_id
        ).first()
        if not log:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Emotion log not found"
            )
        self.db.query(TradeTimeline).filter(
            TradeTimeline.trade_id == trade_id,
            TradeTimeline.event_type == "emotion_logged",
            TradeTimeline.emotion == log.emotion,
            TradeTimeline.timestamp == log.timestamp,
        ).delete(synchronize_session="fetch")
        self.db.delete(log)
        self.db.commit()
        return None

    def get_emotion_summary(self, user_id: int) -> dict:
        # Stub: the real emotion_summary endpoint lives in lifecycle_analytics.py
        # This method is defined per the spec but not actively used yet.
        return {}
