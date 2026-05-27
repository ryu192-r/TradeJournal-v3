from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.schemas.capital_event import (
    CapitalEventCreate,
    CapitalEventUpdate,
    CapitalEventResponse,
    CapitalEventListResponse,
    CapitalSummaryResponse,
)
from app.db.database import get_db
from app.services.capital_event_service import CapitalEventService
from app.core.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/capital-events", tags=["capital-events"])


@router.post("/", response_model=CapitalEventResponse, status_code=status.HTTP_201_CREATED)
def create_capital_event(event: CapitalEventCreate, db: Session = Depends(get_db)):
    """Create a new capital event and update account balance atomically."""
    svc = CapitalEventService(db)
    return svc.create_event(event)


@router.get("/", response_model=CapitalEventListResponse)
def list_capital_events(
    account_id: int,
    skip: int = 0,
    limit: int = 100,
    event_type: Optional[str] = None,
    trade_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List capital events for a specific account with optional filters."""
    svc = CapitalEventService(db)
    total, events = svc.list_events(account_id, skip, limit, event_type, trade_id, start_date, end_date)
    return {"total": total, "items": events}


@router.get("/summary", response_model=CapitalSummaryResponse)
def get_capital_summary(
    account_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get aggregate capital summary using single SQL aggregation query."""
    svc = CapitalEventService(db)
    return svc.get_summary(account_id, start_date, end_date)


@router.get("/{event_id}", response_model=CapitalEventResponse)
def get_capital_event(event_id: int, db: Session = Depends(get_db)):
    """Get a single capital event by ID."""
    svc = CapitalEventService(db)
    return svc.get_by_id(event_id)


@router.put("/{event_id}", response_model=CapitalEventResponse)
def update_capital_event(
    event_id: int,
    event_update: CapitalEventUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing capital event, recalculating account balance if amount changes."""
    svc = CapitalEventService(db)
    return svc.update_event(event_id, event_update)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capital_event(event_id: int, db: Session = Depends(get_db)):
    """Delete a capital event and reverse its impact on account balance."""
    svc = CapitalEventService(db)
    svc.delete_event(event_id)
    return None


@router.post("/accounts/{account_id}/reconcile")
def reconcile_account(account_id: int, db: Session = Depends(get_db)):
    """Manually trigger balance reconciliation."""
    svc = CapitalEventService(db)
    return svc.reconcile_account(account_id)
