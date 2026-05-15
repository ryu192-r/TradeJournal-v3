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
from app.models.trade import Trade
from app.db.database import get_db
from app.utils.logging import get_logger
from app.utils.decimal_utils import ensure_decimal

router = APIRouter(prefix="/capital-events", tags=["capital-events"])
logger = get_logger(__name__)


def _reconcile_account(account_id: int, db: Session) -> Decimal:
    """Reconcile account balance. Returns delta applied (0 if no change)."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return Decimal("0")

    initial = ensure_decimal(account.initial_balance)
    current = ensure_decimal(account.current_balance)

    # Capital events
    events = db.query(CapitalEvent).filter(CapitalEvent.account_id == account_id).all()
    deposits = sum(ensure_decimal(e.amount) for e in events if e.event_type == "deposit")
    withdrawals = sum(abs(ensure_decimal(e.amount)) for e in events if e.event_type == "withdrawal")

    # Realized PnL (non-deleted, closed trades)
    realized_pnl = Decimal("0")
    closed_trades = db.query(Trade).filter(Trade.pnl.isnot(None), Trade.status != "deleted").all()
    for t in closed_trades:
        realized_pnl += ensure_decimal(t.pnl)

    # Deployed capital (non-deleted, open trades)
    deployed = Decimal("0")
    open_trades = db.query(Trade).filter(Trade.pnl.is_(None), Trade.status != "deleted").all()
    for t in open_trades:
        deployed += ensure_decimal(t.entry_price) * ensure_decimal(t.quantity) - ensure_decimal(t.fees)

    # Target = initial + deposits - withdrawals + realized_pnl - deployed
    target = initial + deposits - withdrawals + realized_pnl - deployed
    delta = target - current

    if delta != 0:
        db_event = CapitalEvent(
            account_id=account_id,
            event_type="adjustment",
            amount=delta,
            timestamp=datetime.utcnow(),
            description="Balance reconciliation",
        )
        db.add(db_event)
        account.current_balance = target
        account.updated_at = datetime.utcnow()
        db.commit()
        logger.info("account_reconciled", account_id=account_id, delta=str(delta))

    return delta


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
        elif event_type == "trade_deletion":
            summary.total_trade_deletions = total_str
        elif event_type == "pyramid":
            summary.total_pyramids = total_str

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
    """Update an existing capital event, recalculating account balance if amount changes."""
    db_event = db.query(CapitalEvent).filter(CapitalEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Capital event not found"
        )

    old_amount = db_event.amount
    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(db_event, field, value)

    if "amount" in update_data:
        delta = db_event.amount - old_amount
        account = db.query(Account).filter(Account.id == db_event.account_id).first()
        if account:
            account.current_balance = (account.current_balance or Decimal("0")) + delta
            account.updated_at = datetime.utcnow()

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


@router.post("/accounts/{account_id}/reconcile")
def reconcile_account(account_id: int, db: Session = Depends(get_db)):
    """Manually trigger balance reconciliation."""
    delta = _reconcile_account(account_id, db)
    account = db.query(Account).filter(Account.id == account_id).first()
    return {
        "account_id": account_id,
        "delta": str(delta),
        "new_balance": str(account.current_balance) if account else None,
        "event_created": delta != 0,
    }
