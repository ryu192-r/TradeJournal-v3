"""Daily Journal CRUD router.

GET    /api/v1/journal/              — list all entries
GET    /api/v1/journal/{date}         — get journal for a specific date
POST   /api/v1/journal/               — create journal entry
PUT    /api/v1/journal/{date}         — update journal entry
GET    /api/v1/journal/weekly         — list entries for a given week
"""
from datetime import date, timedelta
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.daily_journal import DailyJournal
from app.schemas.daily_journal import (
    DailyJournalCreate,
    DailyJournalResponse,
    DailyJournalUpdate,
)

logger = structlog.get_logger()

router = APIRouter(prefix="/journal", tags=["daily-journal"])


@router.post(
    "/", response_model=DailyJournalResponse, status_code=status.HTTP_201_CREATED,
)
def create_journal(
    entry: DailyJournalCreate,
    db: Session = Depends(get_db),
):
    """Create a daily journal entry."""
    existing = db.execute(
        select(DailyJournal).where(DailyJournal.date == entry.date),
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Journal entry for {entry.date} already exists",
        )
    db_entry = DailyJournal(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    logger.info("journal_created", date=str(entry.date))
    return db_entry


@router.get("/", response_model=list[DailyJournalResponse])
def list_journals(
    skip: int = 0,
    limit: int = 30,
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
):
    """List journal entries with optional date range filter."""
    query = select(DailyJournal)
    if from_date:
        try:
            start = date.fromisoformat(from_date)
            query = query.where(DailyJournal.date >= start)
        except ValueError:
            pass
    if to_date:
        try:
            end = date.fromisoformat(to_date)
            query = query.where(DailyJournal.date <= end)
        except ValueError:
            pass
    query = query.order_by(DailyJournal.date.desc()).offset(skip).limit(limit)
    results = db.execute(query).scalars().all()
    return list(results)


@router.get("/weekly", response_model=list[DailyJournalResponse])
def list_weekly_journals(
    week_start: str = Query(..., description="Week start date ISO (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """List journal entries for a given week (week_start + 6 days)."""
    try:
        start = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {week_start}. Use ISO format (YYYY-MM-DD).",
        )
    end = start + timedelta(days=6)
    results = (
        db.execute(
            select(DailyJournal)
            .where(DailyJournal.date >= start, DailyJournal.date <= end)
            .order_by(DailyJournal.date.asc()),
        )
        .scalars()
        .all()
    )
    return list(results)


@router.get("/{date_str}", response_model=DailyJournalResponse)
def get_journal(
    date_str: str,
    db: Session = Depends(get_db),
):
    """Get a single journal entry by date."""
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {date_str}. Use ISO format (YYYY-MM-DD).",
        )
    entry = db.execute(
        select(DailyJournal).where(DailyJournal.date == target_date),
    ).scalar_one_or_none()
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No journal entry for {date_str}",
        )
    return entry


@router.put("/{date_str}", response_model=DailyJournalResponse)
def update_journal(
    date_str: str,
    entry_update: DailyJournalUpdate,
    db: Session = Depends(get_db),
):
    """Update a journal entry for a given date."""
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format: {date_str}. Use ISO format (YYYY-MM-DD).",
        )
    db_entry = db.execute(
        select(DailyJournal).where(DailyJournal.date == target_date),
    ).scalar_one_or_none()
    if not db_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No journal entry for {date_str}",
        )
    update_data = entry_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_entry, field, value)
    db.commit()
    db.refresh(db_entry)
    logger.info("journal_updated", date=date_str)
    return db_entry
