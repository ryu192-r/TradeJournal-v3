from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from decimal import Decimal
from typing import Optional

from app.schemas.capital_event import (
    CapitalEventCreate,
    CapitalEventUpdate,
    CapitalEventResponse,
    CapitalEventListResponse,
    CapitalSummaryResponse,
)
from app.models.capital_event import CapitalEvent
from app.models.account import Account
from app.db.database import get_db
from app.utils.logging import get_logger

router = APIRouter(prefix="/capital-events", tags=["capital-events"])
logger = get_logger(__name__)


@router.post("/", response_model=CapitalEventResponse, status_code=status.HTTP_201_CREATED)
def create_capital_event(event: CapitalEventCreate, db: Session = Depends(get_db)):
    """Create a new capital event and update account balance atomically."""
    # Verify account exists
    account = db.query(Account).filter(Account.id == event.account_id).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )

    db_event = CapitalEvent(
        account_id=event.account_id,
        event_type=event.event_type,
        amount=event.amount,
        timestamp=event.timestamp,
        description=event.description,
        trade_id=event.trade_id,
    )
    db.add(db_event)

    # Update account current_balance atomically in same transaction
    old_balance = account.current_balance or Decimal("0")
    account.current_balance = old_balance + event.amount
    account.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(db_event)

    logger.info(
        "capital_event_created",
        event_id=db_event.id,
        account_id=event.account_id,
        event_type=db_event.event_type,
        amount=str(db_event.amount)
    )
    return db_event


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
    query = db.query(CapitalEvent).filter(CapitalEvent.account_id == account_id)

    if event_type:
        query = query.filter(CapitalEvent.event_type == event_type)
    if trade_id is not None:
        query = query.filter(CapitalEvent.trade_id == trade_id)
    if start_date:
        query = query.filter(CapitalEvent.timestamp >= start_date)
    if end_date:
        query = query.filter(CapitalEvent.timestamp <= end_date)

    total = query.count()
    events = query.order_by(CapitalEvent.timestamp.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": events}


@router.get("/summary", response_model=CapitalSummaryResponse)
def get_capital_summary(
    account_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get aggregate capital summary using single SQL aggregation query."""
    base_filters = [CapitalEvent.account_id == account_id]
    if start_date:
        base_filters.append(CapitalEvent.timestamp >= start_date)
    if end_date:
        base_filters.append(CapitalEvent.timestamp <= end_date)

    # Single SQL query: breakdown by event_type + net change
    rows = (
        db.query(
            CapitalEvent.event_type,
            func.sum(CapitalEvent.amount).label("total"),
            func.count(CapitalEvent.id).label("cnt"),
        )
        .filter(*base_filters)
        .group_by(CapitalEvent.event_type)
        .all()
    )

    summary = CapitalSummaryResponse(
        total_deposits="0",
        total_withdrawals="0",
        total_profit="0",
        total_fees="0",
        total_adjustments="0",
        net_change="0",
        event_count=0,
    )
    
    for event_type, total, cnt in rows:
        summary.event_count += cnt
        total_str = str(total) if total is not None else "0"
        if event_type == "deposit":
            summary.total_deposits = total_str
        elif event_type == "withdrawal":
            summary.total_withdrawals = total_str
        elif event_type == "profit":
            summary.total_profit = total_str
        elif event_type == "fee":
            summary.total_fees = total_str
        elif event_type == "adjustment":
            summary.total_adjustments = total_str

    # Net change from same query group (compute as sum of all breakdown totals)
    net = Decimal("0")
    for _, total, _ in rows:
        if total is not None:
            net += Decimal(str(total))
    summary.net_change = str(net)

    logger.info("capital_summary_generated", account_id=account_id, event_count=summary.event_count)
    return summary


@router.get("/{event_id}", response_model=CapitalEventResponse)
def get_capital_event(event_id: int, db: Session = Depends(get_db)):
    """Get a single capital event by ID."""
    event_obj = db.query(CapitalEvent).filter(CapitalEvent.id == event_id).first()
    if not event_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capital event not found"
        )
    return event_obj


@router.put("/{event_id}", response_model=CapitalEventResponse)
def update_capital_event(
    event_id: int,
    event_update: CapitalEventUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing capital event."""
    db_event = db.query(CapitalEvent).filter(CapitalEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capital event not found"
        )

    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(db_event, field, value)

    db.commit()
    db.refresh(db_event)

    logger.info("capital_event_updated", event_id=db_event.id)
    return db_event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capital_event(event_id: int, db: Session = Depends(get_db)):
    """Delete a capital event and reverse its impact on account balance."""
    db_event = db.query(CapitalEvent).filter(CapitalEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capital event not found"
        )

    # Reverse balance impact before deleting
    account = db.query(Account).filter(Account.id == db_event.account_id).first()
    if account:
        old_balance = account.current_balance or Decimal("0")
        account.current_balance = old_balance - db_event.amount
        account.updated_at = datetime.utcnow()

    db.delete(db_event)
    db.commit()

    logger.info("capital_event_deleted", event_id=event_id)
    return None
