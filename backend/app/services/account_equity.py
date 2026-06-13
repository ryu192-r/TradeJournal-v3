"""Account Equity — single source of truth for all money computations.

Interface: equity_snapshot(db, user_id) -> EquitySnapshot
"""
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.live_quote import LiveQuote
from app.models.partial_exit import PartialExit
from app.models.trade import Trade
from app.utils.calculations import compute_live_pnl
from app.utils.decimal_utils import ensure_decimal


@dataclass(frozen=True)
class EquitySnapshot:
    initial_balance: Decimal
    capital_flow: Decimal        # SUM(amount) where event_type != 'adjustment'
    realized_pnl: Decimal        # closed trade pnl + partial exit realized pnl
    net_equity: Decimal           # initial + capital_flow + realized_pnl
    deployed_capital: Decimal     # Σ entry_price × remaining_qty (open)
    available_capital: Decimal    # net_equity − deployed_capital
    unrealized_pnl: Decimal       # Σ live pnl on open positions
    total_equity: Decimal         # net_equity + unrealized_pnl


def equity_snapshot(db: Session, user_id: int) -> EquitySnapshot:
    """Compute and return the full equity snapshot for a user."""
    account = db.query(Account).filter(Account.user_id == user_id).order_by(Account.id).first()
    initial = ensure_decimal(account.initial_balance) if account else Decimal("0")
    account_id = account.id if account else None

    # Capital flow: all events except adjustment
    capital_flow = Decimal("0")
    if account_id is not None:
        row = (
            db.query(func.coalesce(func.sum(CapitalEvent.amount), 0))
            .filter(CapitalEvent.account_id == account_id, CapitalEvent.event_type != "adjustment")
            .scalar()
        )
        capital_flow = ensure_decimal(row)

    # Realized PnL: closed trades + partial exits on open trades
    closed_pnl = ensure_decimal(
        db.query(func.coalesce(func.sum(Trade.pnl), 0))
        .filter(Trade.user_id == user_id, Trade.status != "deleted", Trade.pnl.isnot(None))
        .scalar()
    )

    open_trades = (
        db.query(Trade)
        .filter(Trade.user_id == user_id, Trade.status != "deleted", Trade.exit_price.is_(None))
        .all()
    )
    open_ids = [t.id for t in open_trades]

    partial_realized = Decimal("0")
    pe_qty_map: dict[int, Decimal] = {}
    if open_ids:
        pe_rows = (
            db.query(
                PartialExit.trade_id,
                func.coalesce(func.sum(PartialExit.qty), 0),
                func.coalesce(func.sum(PartialExit.realized_pnl), 0),
            )
            .filter(PartialExit.trade_id.in_(open_ids))
            .group_by(PartialExit.trade_id)
            .all()
        )
        for tid, qty_sum, pnl_sum in pe_rows:
            pe_qty_map[tid] = ensure_decimal(qty_sum)
            partial_realized += ensure_decimal(pnl_sum)

    realized_pnl = closed_pnl + partial_realized
    net_equity = initial + capital_flow + realized_pnl

    # Deployed capital: entry × remaining_qty
    deployed = Decimal("0")
    for t in open_trades:
        rem = ensure_decimal(t.quantity) - pe_qty_map.get(t.id, Decimal("0"))
        if rem > 0:
            deployed += ensure_decimal(t.entry_price) * rem

    available = net_equity - deployed

    # Unrealized PnL via LiveQuote
    unrealized = Decimal("0")
    if open_trades:
        symbols = {t.symbol for t in open_trades}
        quotes = {
            q.symbol: q
            for q in db.query(LiveQuote).filter(LiveQuote.symbol.in_(symbols)).all()
        }
        for t in open_trades:
            q = quotes.get(t.symbol)
            if q is None or q.ltp is None:
                continue
            rem = ensure_decimal(t.quantity) - pe_qty_map.get(t.id, Decimal("0"))
            if rem <= 0:
                continue
            pnl = compute_live_pnl(
                entry_price=t.entry_price,
                ltp=q.ltp,
                quantity=t.quantity,
                remaining_qty=rem,
                fees=t.fees,
                direction=t.direction or "LONG",
            )
            if pnl is not None:
                unrealized += pnl

    total = net_equity + unrealized

    return EquitySnapshot(
        initial_balance=initial,
        capital_flow=capital_flow,
        realized_pnl=realized_pnl,
        net_equity=net_equity,
        deployed_capital=deployed,
        available_capital=available,
        unrealized_pnl=unrealized,
        total_equity=total,
    )
