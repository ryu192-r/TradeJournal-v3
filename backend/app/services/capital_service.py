"""Capital Service for business logic."""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.capital_event import CapitalEvent
from app.utils.decimal_utils import ensure_decimal
from app.utils.logging import get_logger

logger = get_logger(__name__)


def _reconcile_account(account_id: int, db: Session, user_id: Optional[int] = None) -> Decimal:
    """Reconcile account balance. Returns delta applied (0 if no change)."""
    q = db.query(Account).filter(Account.id == account_id)
    if user_id is not None:
        q = q.filter(Account.user_id == user_id)
    account = q.first()
    if not account:
        return Decimal("0")

    # Use account's user_id for trade scoping if no explicit user_id provided
    effective_user_id = user_id if user_id is not None else account.user_id

    initial = ensure_decimal(account.initial_balance)
    current = ensure_decimal(account.current_balance)

    # Capital events
    events = db.query(CapitalEvent).filter(CapitalEvent.account_id == account_id).all()
    deposits = sum(ensure_decimal(e.amount) for e in events if e.event_type == "deposit")
    withdrawals = sum(abs(ensure_decimal(e.amount)) for e in events if e.event_type == "withdrawal")
    fees = sum(abs(ensure_decimal(e.amount)) for e in events if e.event_type == "fee")

    # Realized PnL (non-deleted, closed trades) — scoped to user
    realized_pnl = Decimal("0")
    closed_query = db.query(Trade).filter(Trade.pnl.isnot(None), Trade.status != "deleted")
    if effective_user_id is not None:
        closed_query = closed_query.filter(Trade.user_id == effective_user_id)
    closed_trades = closed_query.all()
    for t in closed_trades:
        realized_pnl += ensure_decimal(t.pnl)

    # Open trades: partial exit realized PnL + deployed capital
    partial_realized = Decimal("0")
    deployed = Decimal("0")
    open_query = db.query(Trade).filter(Trade.exit_price.is_(None), Trade.status != "deleted")
    if effective_user_id is not None:
        open_query = open_query.filter(Trade.user_id == effective_user_id)
    open_trades_list = open_query.all()

    partial_totals: dict[int, tuple[Decimal, Decimal]] = {}
    open_trade_ids = [t.id for t in open_trades_list]
    if open_trade_ids:
        rows = (
            db.query(
                PartialExit.trade_id,
                func.coalesce(func.sum(PartialExit.qty), 0),
                func.coalesce(func.sum(PartialExit.realized_pnl), 0),
            )
            .filter(PartialExit.trade_id.in_(open_trade_ids))
            .group_by(PartialExit.trade_id)
            .all()
        )
        partial_totals = {
            trade_id: (ensure_decimal(total_qty), ensure_decimal(total_realized))
            for trade_id, total_qty, total_realized in rows
        }

    for t in open_trades_list:
        total_exited_qty, trade_partial_realized = partial_totals.get(t.id, (Decimal("0"), Decimal("0")))
        partial_realized += trade_partial_realized
        quantity = ensure_decimal(t.quantity)
        remaining_qty = quantity - total_exited_qty
        fee_share = ensure_decimal(t.fees or "0") * (remaining_qty / quantity) if quantity > 0 else Decimal("0")
        deployed += ensure_decimal(t.entry_price) * remaining_qty - fee_share
    realized_pnl += partial_realized

    # Target = initial + deposits - withdrawals - fees + realized_pnl - deployed
    target = initial + deposits - withdrawals - fees + realized_pnl - deployed
    delta = target - current

    if delta != 0:
        db_event = CapitalEvent(
            account_id=account_id,
            event_type="adjustment",
            amount=delta,
            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
            description="Balance reconciliation",
        )
        db.add(db_event)
        account.current_balance = target
        account.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        logger.info("account_reconciled", account_id=account_id, delta=str(delta))

    return delta


def _auto_reconcile(db: Session, user_id: Optional[int] = None):
    q = db.query(Account)
    if user_id is not None:
        q = q.filter(Account.user_id == user_id)
    account = q.first()
    if account:
        _reconcile_account(account.id, db, user_id)
