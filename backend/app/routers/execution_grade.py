from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.execution_grade import ExecutionGradeCreate, ExecutionGradeUpdate, ExecutionGradeResponse
from app.models.trade import Trade
from app.models.execution_grade import ExecutionGrade
from app.models.trade_timeline import TradeTimeline
from app.db.database import get_db

router = APIRouter(prefix="/trades/{trade_id}/execution-grade", tags=["execution-grades"])


@router.get("", response_model=ExecutionGradeResponse)
def get_execution_grade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    grade = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == trade_id).first()
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution grade not found")
    return grade


@router.post("", response_model=ExecutionGradeResponse, status_code=status.HTTP_201_CREATED)
def create_execution_grade(trade_id: int, payload: ExecutionGradeCreate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    existing = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == trade_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Execution grade already exists. Use PUT to update.")
    grade = ExecutionGrade(
        trade_id=trade_id,
        entry_quality=payload.entry_quality,
        sizing_quality=payload.sizing_quality,
        stop_quality=payload.stop_quality,
        patience=payload.patience,
        rule_adherence=payload.rule_adherence,
        exit_quality=payload.exit_quality,
        overall_grade=payload.overall_grade,
        notes=payload.notes,
    )
    db.add(grade)

    timeline = TradeTimeline(
        trade_id=trade_id,
        event_type="review_added",
        new_value=payload.overall_grade,
        note=f"Execution grade: {payload.overall_grade or 'N/A'}",
    )
    db.add(timeline)

    db.commit()
    db.refresh(grade)
    return grade


@router.put("", response_model=ExecutionGradeResponse)
def update_execution_grade(trade_id: int, payload: ExecutionGradeUpdate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trade not found")
    grade = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == trade_id).first()
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution grade not found. Use POST to create.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(grade, field, value)
    db.commit()
    db.refresh(grade)
    return grade


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def delete_execution_grade(trade_id: int, db: Session = Depends(get_db)):
    grade = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == trade_id).first()
    if not grade:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Execution grade not found")
    db.delete(grade)
    db.commit()
    return None