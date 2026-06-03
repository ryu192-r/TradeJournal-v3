"""Daily Charges Ledger Router.

GET    /api/v1/daily-charges/summary    — summary by date range
GET    /api/v1/daily-charges             — list charges in date range
PUT    /api/v1/daily-charges/{trade_date} — upsert charges for a date
GET    /api/v1/daily-charges/{trade_date} — get charges for a date
DELETE /api/v1/daily-charges/{trade_date} — delete charges for a date
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.daily_charges import DailyChargesCreate, DailyChargesUpdate, DailyChargesRead, DailyChargesListResponse, DailyChargesSummary
from app.services.daily_charges_service import DailyChargesService

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/daily-charges", tags=["daily-charges"])


def _to_date(s: str) -> date:
    try:
        return date.fromisoformat(s)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid date format: {s}. Use ISO (YYYY-MM-DD).")


@router.get("/summary", response_model=DailyChargesSummary)
def get_summary(
    start_date: str = Query(..., description="Start date ISO (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date ISO (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = DailyChargesService(db, user_id=current_user.id)
    s = _to_date(start_date)
    e = _to_date(end_date)
    return svc.summary(s, e)


@router.get("/", response_model=DailyChargesListResponse)
def list_daily_charges(
    start_date: Optional[str] = Query(None, description="Start date ISO (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date ISO (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = DailyChargesService(db, user_id=current_user.id)
    s = _to_date(start_date) if start_date else None
    e = _to_date(end_date) if end_date else None
    total, items = svc.list_by_range(s, e)
    return {"total": total, "items": items}


@router.put("/{trade_date}", response_model=DailyChargesRead)
def upsert_daily_charges(
    trade_date: str,
    payload: DailyChargesCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = DailyChargesService(db, user_id=current_user.id)
    d = _to_date(trade_date)
    data = payload.model_dump(exclude={"trade_date"}, exclude_none=True)
    return svc.upsert(d, data)


@router.get("/{trade_date}", response_model=DailyChargesRead)
def get_daily_charges(
    trade_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = DailyChargesService(db, user_id=current_user.id)
    d = _to_date(trade_date)
    record = svc.get_by_date(d)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No charges recorded for {trade_date}")
    return record


@router.delete("/{trade_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_daily_charges(
    trade_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = DailyChargesService(db, user_id=current_user.id)
    d = _to_date(trade_date)
    try:
        svc.delete_by_date(d)
    except (ValueError, PermissionError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No charges recorded for {trade_date}")
    return None
