from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.schemas.trade_timeline import TimelineEventCreate, TimelineEventResponse, TimelineListResponse, IST as TL_IST
from app.models.trade import Trade
from app.models.trade_timeline import TradeTimeline
from app.db.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/trades/{trade_id}/timeline", tags=["trade-timeline"])


@router.get("", response_model=TimelineListResponse)
def list_timeline(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    entries = (
        db.query(TradeTimeline)
        .filter(TradeTimeline.trade_id == trade_id)
        .order_by(TradeTimeline.timestamp.desc())
        .all()
    )
    return {"items": entries}


@router.post("", response_model=TimelineEventResponse, status_code=status.HTTP_201_CREATED)
def create_timeline_event(trade_id: int, payload: TimelineEventCreate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    entry = TradeTimeline(
        trade_id=trade_id,
        event_type=payload.event_type,
        timestamp=payload.timestamp or datetime.now(TL_IST).replace(tzinfo=None),
        old_value=payload.old_value,
        new_value=payload.new_value,
        note=payload.note,
        emotion=payload.emotion,
        confidence=payload.confidence,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timeline_event(trade_id: int, event_id: int, db: Session = Depends(get_db)):
    event = db.query(TradeTimeline).filter(TradeTimeline.id == event_id, TradeTimeline.trade_id == trade_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline event not found")
    db.delete(event)
    db.commit()
    return None