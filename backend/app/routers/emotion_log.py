from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.schemas.emotion_log import EmotionLogCreate, EmotionLogResponse, EmotionLogListResponse
from app.db.database import get_db
from app.services.emotion_log_service import EmotionLogService
from app.core.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades/{trade_id}/emotions", tags=["emotion-logs"])


@router.get("", response_model=EmotionLogListResponse)
def list_emotion_logs(trade_id: int, db: Session = Depends(get_db)):
    svc = EmotionLogService(db)
    logs = svc.list_logs(trade_id)
    return {"items": logs}


@router.post("", response_model=EmotionLogResponse, status_code=201)
def create_emotion_log(trade_id: int, payload: EmotionLogCreate, db: Session = Depends(get_db)):
    svc = EmotionLogService(db)
    entry = svc.create_log(trade_id, payload)
    return entry


@router.delete("/{log_id}", status_code=204)
def delete_emotion_log(trade_id: int, log_id: int, db: Session = Depends(get_db)):
    svc = EmotionLogService(db)
    svc.delete_log(trade_id, log_id)
    return None
