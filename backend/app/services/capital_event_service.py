"""Capital event service for business logic."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.models.capital_event import CapitalEvent
from app.models.account import Account
from app.schemas.capital_event import (
    CapitalEventCreate,
    CapitalEventUpdate,
    CapitalSummaryResponse,
)
from app.services.capital_service import _reconcile_account
from app.utils.logging import get_logger

logger = get_logger(__name__)


class CapitalEventService:
    """Service for CRUD and aggregation of capital events."""

    USER_ALLOWED_TYPES = {"deposit", "withdrawal", "profit", "fee"}

    def __init__(self, db: Session, user_id: Optional[int] = None):
        self.db = db
        self.user_id = user_id

    def _verify_account_ownership(self, account_id: int) -> Account:
        if self.user_id is not None:
            account = self.db.query(Account).filter(Account.id == account_id, Account.user_id == self.user_id).first()
            if not account:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
            return account
        account = self.db.query(Account).filter(Account.id == account_id).first()
        if not account:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found")
        return account

    # ─────────────────────── CRUD ───────────────────────

    def create_event(self, event: CapitalEventCreate) -> CapitalEvent:
        if event.event_type not in self.USER_ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"event_type '{event.event_type}' is reserved. Allowed: {', '.join(sorted(self.USER_ALLOWED_TYPES))}",
            )

        account = self._verify_account_ownership(event.account_id)

        db_event = CapitalEvent(
            account_id=event.account_id,
            event_type=event.event_type,
            amount=event.amount,
            timestamp=event.timestamp,
            description=event.description,
            trade_id=event.trade_id,
        )
        self.db.add(db_event)

        old_balance = account.current_balance or Decimal("0")
        account.current_balance = old_balance + event.amount
        account.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)

        self.db.commit()
        self.db.refresh(db_event)

        logger.info(
            "capital_event_created",
            event_id=db_event.id,
            account_id=event.account_id,
            event_type=db_event.event_type,
            amount=str(db_event.amount),
        )
        return db_event

    def get_by_id(self, event_id: int) -> CapitalEvent:
        event_obj = self.db.query(CapitalEvent).filter(CapitalEvent.id == event_id).first()
        if not event_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Capital event not found",
            )
        self._verify_account_ownership(event_obj.account_id)
        return event_obj

    def list_events(
        self,
        account_id: int,
        skip: int = 0,
        limit: int = 100,
        event_type: Optional[str] = None,
        trade_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Tuple[int, list]:
        self._verify_account_ownership(account_id)
        query = self.db.query(CapitalEvent).filter(CapitalEvent.account_id == account_id)

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
        return total, events

    def update_event(self, event_id: int, event_update: CapitalEventUpdate) -> CapitalEvent:
        db_event = self.get_by_id(event_id)
        self._verify_account_ownership(db_event.account_id)

        update_data = event_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                setattr(db_event, field, value)

        if "amount" in update_data:
            _reconcile_account(db_event.account_id, self.db)

        self.db.commit()
        self.db.refresh(db_event)

        logger.info("capital_event_updated", event_id=db_event.id)
        return db_event

    def delete_event(self, event_id: int) -> None:
        db_event = self.db.query(CapitalEvent).filter(CapitalEvent.id == event_id).first()
        if not db_event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Capital event not found",
            )
        self._verify_account_ownership(db_event.account_id)

        account_id = db_event.account_id
        self.db.delete(db_event)
        _reconcile_account(account_id, self.db)
        self.db.commit()

        logger.info("capital_event_deleted", event_id=event_id)
        return None

    # ─────────────────────── Summary ───────────────────────

    def get_summary(
        self,
        account_id: int,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> CapitalSummaryResponse:
        self._verify_account_ownership(account_id)
        base_filters = [CapitalEvent.account_id == account_id]
        if start_date:
            base_filters.append(CapitalEvent.timestamp >= start_date)
        if end_date:
            base_filters.append(CapitalEvent.timestamp <= end_date)

        rows = (
            self.db.query(
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

        net = Decimal("0")
        for _, total, _ in rows:
            if total is not None:
                net += Decimal(str(total))
        summary.net_change = str(net)

        logger.info("capital_summary_generated", account_id=account_id, event_count=summary.event_count)
        return summary

    # ─────────────────────── Reconcile ───────────────────────

    def reconcile_account(self, account_id: int) -> dict:
        account = self._verify_account_ownership(account_id)
        delta = _reconcile_account(account_id, self.db, user_id=self.user_id)
        self.db.commit()
        account = self.db.query(Account).filter(Account.id == account_id).first()
        return {
            "account_id": account_id,
            "delta": str(delta),
            "new_balance": str(account.current_balance) if account else None,
            "event_created": delta != 0,
        }
