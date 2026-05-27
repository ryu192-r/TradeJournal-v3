from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from decimal import Decimal
from collections import defaultdict
from typing import Optional, List
from pydantic import BaseModel, Field, field_serializer

from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.tier_config import TierConfig
from app.db.database import get_db
from app.utils.logging import get_logger
from app.utils.calculations import compute_aggregate_kpis
from app.utils.decimal_utils import ensure_decimal
from app.core.dependencies import get_current_user, scoped_trade_query, scoped_account_query
from app.models.user import User


router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/accounts", tags=["capital-dashboard"])
logger = get_logger(__name__)


# ───────────────────────── Schemas ─────────────────────────


class EquityCurvePointOut(BaseModel):
    date: str
    equity: Decimal

    @field_serializer("equity")
    def serialize_equity(self, v: Decimal) -> str:
        return str(v)


class CapitalEventOut(BaseModel):
    id: int
    date: str
    type: str
    amount: Decimal
    description: Optional[str] = None

    @field_serializer("amount")
    def serialize_amount(self, v: Decimal) -> str:
        return str(v)


class TierOut(BaseModel):
    name: str
    min: Decimal
    max: Optional[Decimal] = None
    current: bool = False
    progress_pct: Optional[float] = None

    @field_serializer("min", "max")
    def serialize_tier_value(self, v: Optional[Decimal]) -> Optional[str]:
        if v is None:
            return None
        return str(v)


class CapitalDashboardResponse(BaseModel):
    account_id: int
    account_name: str
    net_equity: str
    total_deposits: str
    total_withdrawals: str
    total_realized_pnl: str
    unrealized_pnl: str
    deployed_capital: str
    available_capital: str
    current_balance: str
    initial_balance: str
    breakeven_threshold: str = "500"
    total_trades: int
    win_rate: Optional[float] = None
    best_trade: str
    worst_trade: str
    average_win: str
    average_loss: str
    profit_factor: Optional[float] = None
    equity_curve: List[EquityCurvePointOut] = []
    events: List[CapitalEventOut] = []
    tiers: List[TierOut] = []
    progress_to_next_tier: Optional[float] = None


# ───────────────────────── Capital Tiers ─────────────────────────

DEFAULT_TIERS = [
    {"name": "Survival", "min": Decimal("0"), "max": Decimal("200000")},
    {"name": "Growth", "min": Decimal("200000"), "max": Decimal("1000000")},
    {"name": "Scaling", "min": Decimal("1000000"), "max": Decimal("5000000")},
    {"name": "Freedom", "min": Decimal("5000000"), "max": None},
]


def _load_tiers(db: Session) -> list[dict]:
    tiers = db.query(TierConfig).order_by(TierConfig.sort_order).all()
    if not tiers:
        for t in DEFAULT_TIERS:
            db.add(TierConfig(
                name=t["name"],
                min_amount=t["min"],
                max_amount=t["max"],
                sort_order=DEFAULT_TIERS.index(t),
            ))
        db.commit()
        tiers = db.query(TierConfig).order_by(TierConfig.sort_order).all()
    return [
        {"name": t.name, "min": t.min_amount, "max": t.max_amount}
        for t in tiers
    ]


def _compute_tiers(net_equity: Decimal, db: Session) -> tuple[list[dict], Optional[float]]:
    tier_defs = _load_tiers(db)
    result = []
    progress = None
    for tier in tier_defs:
        t_min = tier["min"]
        t_max = tier["max"]
        current = t_min <= net_equity and (t_max is None or net_equity < t_max)

        pct = None
        if current and t_max is not None:
            total_range = t_max - t_min
            if total_range > 0:
                pct = float((net_equity - t_min) / total_range) * 100
                pct = round(min(pct, 100), 1)

        if current and t_max is None:
            pct = 100.0

        if current and progress is None:
            progress = pct

        entry = TierOut(
            name=tier["name"],
            min=t_min,
            max=t_max,
            current=current,
            progress_pct=pct,
        )
        result.append(entry)

    return result, progress


# ───────────────────────── Helpers ─────────────────────────


def _get_partial_exits_by_trade(db: Session, user_id: int) -> dict[int, list[PartialExit]]:
    all_partials = (
        db.query(PartialExit)
        .join(Trade)
        .filter(Trade.user_id == user_id, Trade.status != "deleted")
        .order_by(PartialExit.exit_time.asc())
        .all()
    )
    by_trade: dict[int, list[PartialExit]] = defaultdict(list)
    for pe in all_partials:
        by_trade[pe.trade_id].append(pe)
    return by_trade


def _remaining_qty_for_trade(trade: Trade, partials: list[PartialExit]) -> Decimal:
    total_exited = sum(pe.qty for pe in partials)
    return trade.quantity - total_exited


# ───────────────────────── Endpoint ─────────────────────────


@router.get("/capital-dashboard", response_model=CapitalDashboardResponse)
def get_capital_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    accounts = db.query(Account).filter(Account.user_id == current_user.id).order_by(Account.id).limit(1).all()
    if not accounts:
        account = Account(name="Default", initial_balance=0, current_balance=0, user_id=current_user.id)
        db.add(account)
        db.commit()
        db.refresh(account)
    else:
        account = accounts[0]
    initial_balance = ensure_decimal(account.initial_balance)

    # Capital events
    events_q = (
        db.query(CapitalEvent)
        .filter(CapitalEvent.account_id == account.id)
        .order_by(CapitalEvent.timestamp.desc())
        .all()
    )

    total_deposits = Decimal("0")
    total_withdrawals = Decimal("0")
    total_fees = Decimal("0")
    capital_events_out = []

    for evt in events_q:
        amt = ensure_decimal(evt.amount)
        if evt.event_type == "deposit":
            total_deposits += amt
        elif evt.event_type == "withdrawal":
            total_withdrawals += abs(amt)
        elif evt.event_type == "fee":
            total_fees += abs(amt)

        capital_events_out.append(CapitalEventOut(
            id=evt.id,
            date=str(evt.timestamp.date()),
            type=evt.event_type,
            amount=amt,
            description=evt.description,
        ))

    # Load all partial exits indexed by trade_id
    pe_by_trade = _get_partial_exits_by_trade(db, current_user.id)

    # ── Realized PnL: closed trade pnl + partial exit realized_pnl from open trades ──
    closed_trades = (
        db.query(Trade)
        .filter(Trade.exit_price.isnot(None), Trade.status != "deleted", Trade.user_id == current_user.id)
        .all()
    )

    open_trades = (
        db.query(Trade)
        .filter(Trade.exit_price.is_(None), Trade.status != "deleted", Trade.user_id == current_user.id)
        .all()
    )

    total_realized_pnl = Decimal("0")
    all_realized_pnls: list[Decimal] = []

    # Closed trades contribute their full pnl
    for t in closed_trades:
        pnl = ensure_decimal(t.pnl)
        total_realized_pnl += pnl
        all_realized_pnls.append(pnl)

    # Open trades contribute partial exit realized pnl
    open_partial_realized = Decimal("0")
    for t in open_trades:
        partials = pe_by_trade.get(t.id, [])
        for pe in partials:
            pe_pnl = ensure_decimal(pe.realized_pnl) if pe.realized_pnl else Decimal("0")
            total_realized_pnl += pe_pnl
            open_partial_realized += pe_pnl
            all_realized_pnls.append(pe_pnl)

    # ── Deployed capital using remaining_qty ──
    deployed_capital = Decimal("0")
    for t in open_trades:
        partials = pe_by_trade.get(t.id, [])
        rem = _remaining_qty_for_trade(t, partials)
        deployed_capital += ensure_decimal(t.entry_price) * rem

    # ── Unrealized PnL: (cannot compute server-side without LTP — return 0) ──
    #    Frontend computes this client-side using LTP from market data
    unrealized_pnl = Decimal("0")

    # ── Stats from all realized PnLs (closed trade PnL + partial exit PnL) ──
    best_trade = Decimal("0")
    worst_trade = Decimal("0")
    for pnl_val in all_realized_pnls:
        if pnl_val > best_trade:
            best_trade = pnl_val
        if pnl_val < worst_trade:
            worst_trade = pnl_val

    _SimpleKpiTrade = type("_SimpleKpiTrade", (), {"pnl": 0.0, "r_multiple": None})
    kpi_trades = []
    for pnl_val in all_realized_pnls:
        t = _SimpleKpiTrade()
        t.pnl = float(pnl_val)
        kpi_trades.append(t)
    kpis = compute_aggregate_kpis(kpi_trades)
    win_rate = kpis["win_rate"]
    profit_factor = kpis["profit_factor"]
    average_win = Decimal(str(kpis["gross_profit"])) / Decimal(str(kpis["trade_count"])) if kpis["gross_profit"] and kpis["trade_count"] else Decimal("0")
    average_loss = Decimal(str(kpis["gross_loss"])) / Decimal(str(kpis["trade_count"])) if kpis["gross_loss"] and kpis["trade_count"] else Decimal("0")

    # Net equity = initial_balance + capital events net + all realized PnL
    capital_net = total_deposits - total_withdrawals - total_fees
    net_equity = initial_balance + capital_net + total_realized_pnl

    # ── Equity curve ──
    daily_balance: dict[date, Decimal] = defaultdict(Decimal)

    # Closed trade PnL by exit date
    for t in closed_trades:
        day = t.exit_time.date() if t.exit_time else t.entry_time.date()
        daily_balance[day] += ensure_decimal(t.pnl)

    # Partial exit realized PnL by exit date
    for t in open_trades:
        for pe in pe_by_trade.get(t.id, []):
            day = pe.exit_time.date() if pe.exit_time else date.today()
            pe_pnl = ensure_decimal(pe.realized_pnl) if pe.realized_pnl else Decimal("0")
            daily_balance[day] += pe_pnl

    # Capital events (deposits, withdrawals, fees for equity curve — adjustments are reconciliation artifacts)
    events_asc = sorted(events_q, key=lambda e: e.timestamp)
    for evt in events_asc:
        if evt.event_type in ("deposit", "withdrawal", "fee"):
            day = evt.timestamp.date()
            amt = ensure_decimal(evt.amount)
            if evt.event_type == "withdrawal":
                amt = -abs(amt)
            elif evt.event_type == "fee":
                amt = -abs(amt)
            daily_balance[day] += amt

    # Build running curve — always include initial balance as the first point
    curve_points: list[EquityCurvePointOut] = []
    earliest_event_date = min(daily_balance.keys()) if daily_balance else None
    if earliest_event_date:
        start_date = min(earliest_event_date, account.created_at.date() if account.created_at else earliest_event_date) - timedelta(days=1)
    else:
        start_date = account.created_at.date() if account.created_at else date.today()
    curve_points.append(EquityCurvePointOut(date=str(start_date), equity=initial_balance))
    running = initial_balance
    for day_val in sorted(daily_balance.keys()):
        running += daily_balance[day_val]
        curve_points.append(EquityCurvePointOut(date=str(day_val), equity=running))

    if not curve_points:
        today = date.today()
        curve_points.append(EquityCurvePointOut(date=str(today), equity=net_equity))

    # Tiers
    tiers_out, progress = _compute_tiers(net_equity, db)

    current_balance = ensure_decimal(account.current_balance)

    return CapitalDashboardResponse(
        account_id=account.id,
        account_name=account.name,
        net_equity=str(net_equity),
        total_deposits=str(total_deposits),
        total_withdrawals=str(total_withdrawals),
        total_realized_pnl=str(total_realized_pnl),
        unrealized_pnl=str(unrealized_pnl),
        deployed_capital=str(deployed_capital),
        available_capital=str(net_equity - deployed_capital),
        current_balance=str(current_balance),
        initial_balance=str(initial_balance),
        breakeven_threshold=str(account.breakeven_threshold or "500"),
        total_trades=total_trades,
        win_rate=win_rate,
        best_trade=str(best_trade),
        worst_trade=str(worst_trade),
        average_win=str(average_win),
        average_loss=str(average_loss),
        profit_factor=profit_factor,
        equity_curve=curve_points,
        events=capital_events_out,
        tiers=tiers_out,
        progress_to_next_tier=progress,
    )