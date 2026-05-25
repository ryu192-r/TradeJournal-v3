from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.schemas.emotion_log import EmotionLogCreate, EmotionLogResponse, EmotionLogListResponse, IST as EL_IST
from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.trade_timeline import TradeTimeline
from app.db.database import get_db

router = APIRouter(prefix="/trades/{trade_id}/emotions", tags=["emotion-logs"])


@router.get("", response_model=EmotionLogListResponse)
def list_emotion_logs(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    logs = (
        db.query(EmotionLog)
        .filter(EmotionLog.trade_id == trade_id)
        .order_by(EmotionLog.timestamp.desc())
        .all()
    )
    return {"items": logs}


@router.post("", response_model=EmotionLogResponse, status_code=status.HTTP_201_CREATED)
def create_emotion_log(trade_id: int, payload: EmotionLogCreate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    entry = EmotionLog(
        trade_id=trade_id,
        emotion=payload.emotion,
        confidence=payload.confidence,
        stress=payload.stress,
        conviction=payload.conviction,
        patience=payload.patience,
        focus=payload.focus,
        note=payload.note,
        timestamp=payload.timestamp or datetime.now(EL_IST).replace(tzinfo=None),
    )
    db.add(entry)

    timeline = TradeTimeline(
        trade_id=trade_id,
        event_type="emotion_logged",
        timestamp=entry.timestamp,
        new_value=payload.emotion,
        note=payload.note,
        confidence=payload.confidence,
        emotion=payload.emotion,
    )
    db.add(timeline)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_emotion_log(trade_id: int, log_id: int, db: Session = Depends(get_db)):
    log = db.query(EmotionLog).filter(EmotionLog.id == log_id, EmotionLog.trade_id == trade_id).first()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emotion log not found")
    db.delete(log)
    db.commit()
    return None