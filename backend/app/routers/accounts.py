from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator, field_serializer

from app.schemas.account import (
    AccountCreate,
    AccountUpdate,
    AccountResponse,
    AccountListResponse,
    EquityCurveResponse,
    EquityCurvePoint,
)
from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.db.database import get_db
from app.utils.logging import get_logger
from app.utils.decimal_utils import ensure_decimal
from app.core.dependencies import get_current_user


class RebalanceBody(BaseModel):
    new_balance: Decimal = Field(..., description="New account balance to set")

    @field_validator("new_balance", mode="before")
    @classmethod
    def ensure_decimal(cls, v):
        return ensure_decimal(v)


class RebalanceResponse(BaseModel):
    account_id: int
    new_balance: Decimal
    currency: str

    @field_validator("new_balance", mode="before")
    @classmethod
    def ensure_decimal(cls, v):
        return ensure_decimal(v)

    @field_serializer("new_balance")
    def serialize_decimal(self, v):
        if v is None:
            return None
        return str(v) if isinstance(v, Decimal) else v


router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/accounts", tags=["accounts"])
logger = get_logger(__name__)


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(acc: AccountCreate, db: Session = Depends(get_db)):
    """Create a new trading account."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_account = Account(
        name=acc.name,
        broker=acc.broker,
        account_number=acc.account_number,
        initial_balance=acc.initial_balance,
        current_balance=acc.initial_balance,
        currency=acc.currency,
        created_at=now,
        updated_at=now,
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)

    logger.info("account_created", account_id=db_account.id, account_name=db_account.name)
    return db_account


@router.get("/", response_model=AccountListResponse)
def list_accounts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List all accounts."""
    total = db.query(func.count(Account.id)).scalar() or 0
    accounts = db.query(Account).order_by(Account.id).offset(skip).limit(limit).all()
    return {"total": total, "items": accounts}


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(account_id: int, db: Session = Depends(get_db)):
    """Get a single account by ID."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
    return account


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(account_id: int, acc_update: AccountUpdate, db: Session = Depends(get_db)):
    """Update an account."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    update_data = acc_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(db_account, field, value)

    db_account.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(db_account)

    logger.info("account_updated", account_id=db_account.id)
    return db_account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete an account."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Check for associated capital events
    event_count = db.query(func.count(CapitalEvent.id)).filter(
        CapitalEvent.account_id == account_id
    ).scalar()
    if event_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete account with {event_count} associated capital events"
        )

    db.delete(db_account)
    db.commit()

    logger.info("account_deleted", account_id=account_id)
    return None


@router.patch("/{account_id}/rebalance", response_model=RebalanceResponse)
def rebalance_account_balance(account_id: int, body: RebalanceBody, db: Session = Depends(get_db)):
    """Manually set the current balance (e.g. after a sync adjustment)."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    db_account.current_balance = body.new_balance
    db_account.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(db_account)

    logger.info("account_rebalanced", account_id=account_id, new_balance=str(body.new_balance))
    return RebalanceResponse(
        account_id=db_account.id,
        new_balance=db_account.current_balance,
        currency=db_account.currency,
    )


@router.get("/{account_id}/equity-curve", response_model=EquityCurveResponse)
def get_equity_curve(
    account_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Build an equity curve for an account from capital events filtered by account_id."""
    db_account = db.query(Account).filter(Account.id == account_id).first()
    if not db_account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")

    # Filter capital events by account_id
    query = db.query(CapitalEvent).filter(
        CapitalEvent.account_id == account_id
    ).order_by(CapitalEvent.timestamp.asc())

    if start_date:
        query = query.filter(CapitalEvent.timestamp >= start_date)
    if end_date:
        query = query.filter(CapitalEvent.timestamp <= end_date)

    events = query.all()

    running = Decimal(str(db_account.initial_balance))
    points: List[EquityCurvePoint] = []
    day_buckets: dict[date, Decimal] = {}
    
    for evt in events:
        day = evt.timestamp.date()
        running += evt.amount
        day_buckets[day] = running

    for day_val in sorted(day_buckets.keys()):
        points.append(EquityCurvePoint(date=str(day_val), equity=day_buckets[day_val]))

    if not points:
        today = date.today()
        points.append(EquityCurvePoint(date=str(today), equity=db_account.initial_balance))

    current_equity = points[-1].equity if points else db_account.current_balance

    return EquityCurveResponse(
        account_id=db_account.id,
        account_name=db_account.name,
        initial_balance=db_account.initial_balance,
        current_equity=current_equity,
        points=points,
    )
