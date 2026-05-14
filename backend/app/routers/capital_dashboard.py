from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field, field_serializer

from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.trade import Trade
from app.models.tier_config import TierConfig
from app.db.database import get_db
from app.utils.logging import get_logger
from app.utils.decimal_utils import ensure_decimal


router = APIRouter(prefix="/accounts", tags=["capital-dashboard"])
logger = get_logger(__name__)


# ───────────────────────── Schemas ─────────────────────────


class EquityCurvePointOut(BaseModel):
    date: str
    equity: Decimal

    @field_serializer("equity")
    def serialize_equity(self, v: Decimal) -> str:
        return str(v)


class CapitalEventOut(BaseModel):
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
    net_equity: str
    total_deposits: str
    total_withdrawals: str
    total_realized_pnl: str
    unrealized_pnl: str
    current_balance: str
    initial_balance: str
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
        # seed defaults
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


# ───────────────────────── Endpoint ─────────────────────────


@router.get("/capital-dashboard", response_model=CapitalDashboardResponse)
def get_capital_dashboard(db: Session = Depends(get_db)):
    accounts = db.query(Account).order_by(Account.id).limit(1).all()
    if not accounts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No accounts found. Create an account first."
        )

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
    capital_events_out = []

    for evt in events_q:
        amt = ensure_decimal(evt.amount)
        if evt.event_type == "deposit":
            total_deposits += amt
        elif evt.event_type == "withdrawal":
            total_withdrawals += abs(amt)

        capital_events_out.append(CapitalEventOut(
            date=str(evt.timestamp.date()),
            type=evt.event_type,
            amount=amt,
            description=evt.description,
        ))

    # Realized PnL from trades
    trades = (
        db.query(Trade)
        .filter(Trade.pnl.isnot(None))
        .all()
    )

    total_realized_pnl = Decimal("0")
    total_trades = len(trades)
    win_count = 0
    best_trade = Decimal("0")
    worst_trade = Decimal("0")
    total_wins = Decimal("0")
    total_losses = Decimal("0")
    win_count = 0
    loss_count = 0

    for t in trades:
        pnl = ensure_decimal(t.pnl)
        total_realized_pnl += pnl
        if pnl > best_trade:
            best_trade = pnl
        if pnl < worst_trade:
            worst_trade = pnl
        if pnl >= 0:
            win_count += 1
            total_wins += pnl
        else:
            loss_count += 1
            total_losses += pnl

    win_rate = round((win_count / total_trades * 100), 2) if total_trades > 0 else None
    average_win = round(total_wins / win_count, 2) if win_count > 0 else Decimal("0")
    average_loss = round(total_losses / loss_count, 2) if loss_count > 0 else Decimal("0")
    profit_factor = round(float(total_wins / abs(total_losses)), 2) if total_losses != 0 else None

    # Net equity = initial_balance + sum of capital events + realized PnL
    capital_net = total_deposits - total_withdrawals
    net_equity = initial_balance + capital_net + total_realized_pnl

    # Equity curve from capital events
    running = initial_balance
    curve_points: list[EquityCurvePointOut] = []
    day_buckets: dict[date, Decimal] = {}

    events_asc = sorted(events_q, key=lambda e: e.timestamp)
    for evt in events_asc:
        day = evt.timestamp.date()
        running += ensure_decimal(evt.amount)
        day_buckets[day] = running

    for day_val in sorted(day_buckets.keys()):
        curve_points.append(EquityCurvePointOut(date=str(day_val), equity=day_buckets[day_val]))

    if not curve_points:
        today = date.today()
        curve_points.append(EquityCurvePointOut(date=str(today), equity=net_equity))

    # Tiers
    tiers_out, progress = _compute_tiers(net_equity, db)

    current_balance = ensure_decimal(account.current_balance)

    return CapitalDashboardResponse(
        net_equity=str(net_equity),
        total_deposits=str(total_deposits),
        total_withdrawals=str(total_withdrawals),
        total_realized_pnl=str(total_realized_pnl),
        unrealized_pnl="0",
        current_balance=str(current_balance),
        initial_balance=str(initial_balance),
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
