"""
Operational Dashboard Router — single-call aggregated payloads for the dashboard.

GET /api/v1/dashboard/operational  — KPI + open trades + risk + capital + warnings
GET /api/v1/dashboard/intelligence — lifecycle + behavioral + playbook + market highlights

Purpose: reduce waterfall requests and improve first paint.
"""

from datetime import date
from typing import Optional
from decimal import Decimal
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_serializer
from sqlalchemy.orm import Session
from sqlalchemy import case, func

from app.db.database import get_db
from app.models.account import Account
from app.models.capital_event import CapitalEvent
from app.models.trade import Trade
from app.models.partial_exit import PartialExit
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.setup_playbook import SetupPlaybook
from app.models.market_snapshot import MarketSnapshot
from app.models.live_quote import LiveQuote
from app.utils.decimal_utils import ensure_decimal
from app.utils.calculations import calculate_trade_metrics, compute_aggregate_kpis, compute_streaks

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ─────────────────────── Schemas ───────────────────────

class _KpiSummary(BaseModel):
    trade_count: int
    win_rate: Optional[float] = None
    profit_factor: Optional[float] = None
    expectancy: Optional[float] = None
    avg_r_multiple: Optional[float] = None
    max_drawdown_amount: Optional[float] = None  # absolute rupee drawdown
    max_drawdown_pct: Optional[float] = None      # actual percentage
    net_pnl: Optional[str] = None
    gross_profit: Optional[str] = None
    gross_loss: Optional[str] = None


class _OpenTradeSummary(BaseModel):
    id: int
    symbol: str
    entry_price: str
    quantity: str
    remaining_qty: str
    stop_price: Optional[str] = None
    fees: str


class _RiskSummary(BaseModel):
    net_equity: str
    open_positions: int
    deployed_capital: str
    available_capital: str
    open_risk: str
    portfolio_heat_pct: Optional[float] = None
    deployed_capital_pct: Optional[float] = None
    positions_without_stop: int
    warnings: list[dict]


class _StreakSummary(BaseModel):
    current_type: Optional[str] = None
    current_count: int = 0
    longest_win: int = 0
    longest_loss: int = 0


class _EquityPoint(BaseModel):
    date: str
    equity: str


class _CapitalSummary(BaseModel):
    net_equity: str
    initial_balance: str
    total_deposits: str
    total_withdrawals: str
    total_realized_pnl: str
    unrealized_pnl: str
    total_equity_unrealized: str
    total_trades: int
    win_rate: Optional[float] = None


class OperationalDashboardResponse(BaseModel):
    kpi: _KpiSummary
    open_trades: list[_OpenTradeSummary]
    risk: _RiskSummary
    capital: _CapitalSummary
    streaks: _StreakSummary
    equity_curve: list[_EquityPoint]

    class Config:
        from_attributes = True


class _LifecycleHighlight(BaseModel):
    total_emotion_logs: int = 0
    most_frequent_emotion: Optional[str] = None
    worst_performing_emotion: Optional[str] = None
    graded_trades: int = 0
    avg_grade_score: Optional[float] = None  # 1-5 scale
    high_grade_rate: Optional[float] = None  # % of A/B grades
    discipline_score: Optional[float] = None


class _BehavioralHighlight(BaseModel):
    overtrading_days: int = 0
    overtrading_weeks: int = 0
    revenge_trades: int = 0
    early_exit_rate: Optional[float] = None
    avg_capture_ratio: Optional[float] = None


class _PlaybookHighlight(BaseModel):
    setups: list[dict]


class _MarketContextHighlight(BaseModel):
    date: Optional[str] = None
    nifty_close: Optional[float] = None
    nifty_change_pct: Optional[float] = None
    nifty_regime: Optional[str] = None
    india_vix: Optional[float] = None
    fii_flow_cr: Optional[str] = None
    dii_flow_cr: Optional[str] = None
    breadth_advance: Optional[int] = None
    breadth_decline: Optional[int] = None


class IntelligenceDashboardResponse(BaseModel):
    lifecycle: _LifecycleHighlight
    behavioral: _BehavioralHighlight
    playbook: _PlaybookHighlight
    market: _MarketContextHighlight


# ─────────────────────── Operational ───────────────────────

@router.get("/operational", response_model=OperationalDashboardResponse)
def operational_dashboard(db: Session = Depends(get_db)):
    """Single-call payload for the critical dashboard zone."""
    # ── Account ──
    account = db.query(Account).order_by(Account.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="No account found")

    # ── Open trades ──
    open_trades = (
        db.query(Trade)
        .filter(Trade.status != "deleted", Trade.exit_price.is_(None))
        .order_by(Trade.entry_time.desc())
        .all()
    )

    open_trade_ids = [t.id for t in open_trades]
    pe_map: dict[int, list[Decimal]] = defaultdict(list)
    if open_trade_ids:
        partial_rows = (
            db.query(PartialExit.trade_id, PartialExit.qty)
            .filter(PartialExit.trade_id.in_(open_trade_ids))
        )
        for trade_id, qty in partial_rows:
            pe_map[trade_id].append(ensure_decimal(qty))

    open_trade_summaries = []
    for t in open_trades:
        exited = sum(pe_map.get(t.id, []), Decimal("0"))
        rem = t.quantity - exited
        open_trade_summaries.append(_OpenTradeSummary(
            id=t.id,
            symbol=t.symbol,
            entry_price=str(t.entry_price),
            quantity=str(t.quantity),
            remaining_qty=str(rem),
            stop_price=str(t.stop_price) if t.stop_price else None,
            fees=str(t.fees),
        ))

    # ── Net equity (SQL aggregates) ──
    # Only deposits/withdrawals — adjustments are reconciliation artifacts
    total_deposits = (
        db.query(func.coalesce(func.sum(CapitalEvent.amount), 0))
        .filter(CapitalEvent.account_id == account.id, CapitalEvent.event_type == "deposit")
        .scalar()
    ) or Decimal("0")
    total_withdrawals = abs(
        db.query(func.coalesce(func.sum(CapitalEvent.amount), 0))
        .filter(CapitalEvent.account_id == account.id, CapitalEvent.event_type == "withdrawal")
        .scalar()
    ) or Decimal("0")
    capital_net = total_deposits - total_withdrawals

    realized_pnl = (
        db.query(func.coalesce(func.sum(Trade.pnl), 0))
        .filter(Trade.pnl.isnot(None), Trade.status != "deleted")
        .scalar()
    ) or Decimal("0")

    pe_realized = (
        db.query(func.coalesce(func.sum(PartialExit.realized_pnl), 0))
        .filter(PartialExit.trade_id.in_(open_trade_ids))
        .scalar()
    ) if open_trade_ids else Decimal("0")

    net_equity = ensure_decimal(account.initial_balance) + ensure_decimal(capital_net) + ensure_decimal(realized_pnl) + pe_realized

    # ── Unrealized PnL (live quotes × open positions) ──
    live_quotes = {q.symbol: q for q in db.query(LiveQuote).all()}
    unrealized_pnl = Decimal("0")
    for t in open_trades:
        exited = sum(pe_map.get(t.id, []), Decimal("0"))
        rem = t.quantity - exited
        ltp = None
        if t.symbol in live_quotes and live_quotes[t.symbol].ltp is not None:
            ltp = ensure_decimal(live_quotes[t.symbol].ltp)
        if ltp is not None:
            from app.utils.calculations import compute_live_pnl
            live_pnl = compute_live_pnl(
                entry_price=t.entry_price,
                ltp=ltp,
                quantity=t.quantity,
                remaining_qty=rem,
                fees=t.fees,
                direction=t.direction,
            )
            if live_pnl is not None:
                unrealized_pnl += live_pnl

    total_equity_unrealized = net_equity + unrealized_pnl

    # ── Risk (open-trade derived, but we only need totals) ──
    deployed = Decimal("0")
    open_risk = Decimal("0")
    pos_without_stop = 0
    for t in open_trades:
        exited = sum(pe_map.get(t.id, []), Decimal("0"))
        rem = t.quantity - exited
        deployed += ensure_decimal(t.entry_price) * rem
        if t.stop_price:
            calc = calculate_trade_metrics(
                entry_price=t.entry_price,
                quantity=rem,
                stop_price=t.stop_price,
                direction=t.direction,
            )
            if calc.risk_amount is not None:
                open_risk += calc.risk_amount
        else:
            pos_without_stop += 1

    available = net_equity - deployed
    heat_pct = round(float((open_risk / net_equity) * 100), 2) if net_equity > 0 else None
    deployed_pct = round(float((deployed / net_equity) * 100), 2) if net_equity > 0 else None

    warnings = []
    if heat_pct is not None:
        if heat_pct > 6:
            warnings.append({"severity": "high", "code": "portfolio_heat_high", "message": f"Portfolio heat is {heat_pct}%", "trade_id": None, "symbol": None})
        elif heat_pct > 4:
            warnings.append({"severity": "medium", "code": "portfolio_heat_elevated", "message": f"Portfolio heat is {heat_pct}%", "trade_id": None, "symbol": None})
    if deployed_pct is not None and deployed_pct > 80:
        warnings.append({"severity": "medium", "code": "capital_deployment_high", "message": f"Capital deployment is {deployed_pct}%", "trade_id": None, "symbol": None})
    for t in open_trades:
        if t.stop_price is None:
            warnings.append({"severity": "high", "code": "missing_stop", "message": f"{t.symbol} has no stop loss", "trade_id": t.id, "symbol": t.symbol})

    # ── KPI (all closed trades, aggregated in SQL) ──
    total_trades, net_pnl_sum, gross_profit_sum, gross_loss_sum, win_count, avg_r_value = db.query(
        func.count(Trade.id),
        func.coalesce(func.sum(Trade.pnl), 0),
        func.coalesce(func.sum(case((Trade.pnl > 0, Trade.pnl), else_=0)), 0),
        func.coalesce(func.sum(case((Trade.pnl < 0, Trade.pnl), else_=0)), 0),
        func.coalesce(func.sum(case((Trade.pnl > 0, 1), else_=0)), 0),
        func.avg(Trade.r_multiple),
    ).filter(
        Trade.status != "deleted",
        Trade.pnl.isnot(None),
    ).one()

    if total_trades:
        gross_profit_val = float(gross_profit_sum or 0)
        gross_loss_val = abs(float(gross_loss_sum or 0))
        net_pnl = round(float(net_pnl_sum or 0), 2)
        win_rate = round(int(win_count or 0) / total_trades * 100, 1)

        profit_factor = None
        if gross_loss_val > 0:
            profit_factor = round(gross_profit_val / gross_loss_val, 2)
        elif gross_profit_val > 0:
            profit_factor = None  # no losses yet; avoid Infinity

        expectancy = round(net_pnl / total_trades, 2)
        avg_r = round(float(avg_r_value), 2) if avg_r_value is not None else None
    else:
        net_pnl, win_rate, profit_factor, expectancy, avg_r = None, None, None, None, None
        gross_profit_val, gross_loss_val = 0.0, 0.0

    # ── Max drawdown ──
    daily_rows = (
        db.query(func.date(Trade.entry_time).label("dt"), func.coalesce(func.sum(Trade.pnl), 0))
        .filter(Trade.status != "deleted", Trade.pnl.isnot(None))
        .group_by(func.date(Trade.entry_time))
        .order_by("dt")
        .all()
    )
    initial = float(account.initial_balance or 0)
    peak = initial
    max_dd_amount = 0.0
    max_dd_pct = 0.0
    cum = initial
    for _, day_pnl in daily_rows:
        cum += float(day_pnl)
        if cum > peak:
            peak = cum
        dd = peak - cum
        if dd > max_dd_amount:
            max_dd_amount = dd
        if peak > 0:
            dd_pct = (dd / peak) * 100
            if dd_pct > max_dd_pct:
                max_dd_pct = dd_pct

    # ── Streaks (minimal ordered closed-trade query) ──
    sorted_closed = (
        db.query(Trade.pnl, Trade.entry_time)
        .filter(Trade.status != "deleted", Trade.pnl.isnot(None))
        .order_by(Trade.entry_time.asc())
        .all()
    )
    current_streak_type = None
    current_streak_count = 0
    longest_win = 0
    longest_loss = 0
    for t in sorted_closed:
        pnl = ensure_decimal(t.pnl)
        if pnl is None:
            continue
        t_type = "win" if pnl > 0 else "loss"
        if t_type == current_streak_type:
            current_streak_count += 1
        else:
            current_streak_type = t_type
            current_streak_count = 1
        if t_type == "win":
            longest_win = max(longest_win, current_streak_count)
        else:
            longest_loss = max(longest_loss, current_streak_count)

    # ── Capital summary already computed above (total_deposits, total_withdrawals) ──

    # ── Equity curve (realized PnL + capital events by date) ──
    initial_balance = ensure_decimal(account.initial_balance)
    daily_balance: dict[date, Decimal] = defaultdict(Decimal)

    closed_for_curve = (
        db.query(Trade)
        .filter(Trade.status != "deleted", Trade.pnl.isnot(None))
        .all()
    )
    for t in closed_for_curve:
        day = t.exit_time.date() if t.exit_time else t.entry_time.date()
        daily_balance[day] += ensure_decimal(t.pnl)

    open_for_pe = (
        db.query(PartialExit)
        .filter(PartialExit.trade_id.in_(open_trade_ids))
        .all()
    ) if open_trade_ids else []
    for pe in open_for_pe:
        day = pe.exit_time.date() if pe.exit_time else date.today()
        pe_pnl = ensure_decimal(pe.realized_pnl) if pe.realized_pnl else Decimal("0")
        daily_balance[day] += pe_pnl

    capital_events = (
        db.query(CapitalEvent)
        .filter(CapitalEvent.account_id == account.id, CapitalEvent.event_type.in_(("deposit", "withdrawal")))
        .order_by(CapitalEvent.timestamp.asc())
        .all()
    )
    for evt in capital_events:
        day = evt.timestamp.date()
        amt = ensure_decimal(evt.amount)
        if evt.event_type == "withdrawal":
            amt = -abs(amt)
        daily_balance[day] += amt

    equity_curve: list[_EquityPoint] = []
    running = initial_balance
    for day_val in sorted(daily_balance.keys()):
        running += daily_balance[day_val]
        equity_curve.append(_EquityPoint(date=str(day_val), equity=str(round(running, 2))))

    if not equity_curve:
        equity_curve.append(_EquityPoint(date=str(date.today()), equity=str(net_equity)))

    return OperationalDashboardResponse(
        kpi=_KpiSummary(
            trade_count=total_trades,
            win_rate=win_rate,
            profit_factor=profit_factor,
            expectancy=expectancy,
            avg_r_multiple=avg_r,
            max_drawdown_amount=round(float(max_dd_amount), 2) if max_dd_amount else None,
            max_drawdown_pct=round(float(max_dd_pct), 2) if max_dd_pct else None,
            net_pnl=str(round(net_pnl, 2)) if net_pnl is not None else None,
            gross_profit=str(round(gross_profit_val, 2)) if gross_profit_val else None,
            gross_loss=str(round(gross_loss_val, 2)) if gross_loss_val else None,
        ),
        open_trades=open_trade_summaries,
        risk=_RiskSummary(
            net_equity=str(net_equity),
            open_positions=len(open_trades),
            deployed_capital=str(deployed),
            available_capital=str(available),
            open_risk=str(open_risk),
            portfolio_heat_pct=heat_pct,
            deployed_capital_pct=deployed_pct,
            positions_without_stop=pos_without_stop,
            warnings=warnings,
        ),
        capital=_CapitalSummary(
            net_equity=str(net_equity),
            initial_balance=str(account.initial_balance),
            total_deposits=str(total_deposits),
            total_withdrawals=str(total_withdrawals),
            total_realized_pnl=str(realized_pnl),
            unrealized_pnl=str(round(unrealized_pnl, 2)),
            total_equity_unrealized=str(round(total_equity_unrealized, 2)),
            total_trades=total_trades,
            win_rate=win_rate,
        ),
        streaks=_StreakSummary(
            current_type=current_streak_type,
            current_count=current_streak_count,
            longest_win=longest_win,
            longest_loss=longest_loss,
        ),
        equity_curve=equity_curve,
    )


# ─────────────────────── Intelligence ───────────────────────

@router.get("/intelligence", response_model=IntelligenceDashboardResponse)
def intelligence_dashboard(db: Session = Depends(get_db)):
    """Single-call payload for the intelligence zone."""
    # ── Lifecycle highlights ──
    emotion_rows = (
        db.query(
            EmotionLog.emotion,
            func.count(EmotionLog.id).label("count"),
        )
        .group_by(EmotionLog.emotion)
        .all()
    )
    total_emotion_logs = sum(r.count for r in emotion_rows)
    most_frequent = max(emotion_rows, key=lambda r: r.count).emotion if emotion_rows else None

    closed_with_emotion = (
        db.query(Trade, EmotionLog)
        .join(EmotionLog, Trade.id == EmotionLog.trade_id)
        .filter(Trade.status != "deleted", Trade.pnl.isnot(None))
        .all()
    )
    emotion_pnl: dict[str, float] = defaultdict(float)
    emotion_count: dict[str, int] = defaultdict(int)
    for t, e in closed_with_emotion:
        emotion_pnl[e.emotion] += float(t.pnl or 0)
        emotion_count[e.emotion] += 1
    worst_emotion = None
    worst_pnl = float('inf')
    for emo, pnl in emotion_pnl.items():
        if pnl < worst_pnl and emotion_count[emo] >= 3:
            worst_pnl = pnl
            worst_emotion = emo

    # Grade summary
    all_grades = db.query(ExecutionGrade).all()
    graded_count = sum(1 for g in all_grades if g.overall_grade)
    grade_map = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
    numeric = [grade_map.get(g.overall_grade, 0) for g in all_grades if g.overall_grade in grade_map]
    avg_grade = round(sum(numeric) / len(numeric), 2) if numeric else None
    high_grade_rate = round(sum(1 for n in numeric if n >= 4) / len(numeric) * 100, 1) if numeric else None

    # Discipline score
    discipline_score = None
    if numeric:
        discipline_score = round(sum(numeric) / len(numeric) / 5 * 100, 1)

    # ── Behavioral highlights ──
    overtrading_days = 0
    overtrading_weeks = 0
    all_trades = db.query(Trade).filter(Trade.status != "deleted").all()
    daily: dict[str, list] = defaultdict(list)
    weekly: dict[str, list] = defaultdict(list)
    for t in all_trades:
        if t.entry_time:
            daily[t.entry_time.strftime("%Y-%m-%d")].append(t)
            iso = t.entry_time.isocalendar()
            weekly[f"{iso[0]}-W{iso[1]:02d}"].append(t)
    for day_trades in daily.values():
        if len(day_trades) > 3:
            overtrading_days += 1
    for week_trades in weekly.values():
        if len(week_trades) > 10:
            overtrading_weeks += 1

    # Revenge trades
    loss_times = sorted([t.entry_time for t in all_trades if t.pnl is not None and float(t.pnl) < 0 and t.entry_time])
    revenge_count = 0
    for t in all_trades:
        if t.entry_time:
            for lt in loss_times:
                if lt < t.entry_time and (t.entry_time - lt).total_seconds() <= 4 * 3600:
                    revenge_count += 1
                    break

    # Early exits / capture ratio
    closed = [t for t in all_trades if t.exit_price is not None and t.pnl is not None]
    capture_ratios = []
    early_exits = 0
    has_target = 0
    for t in closed:
        calc = calculate_trade_metrics(
            entry_price=t.entry_price,
            exit_price=t.exit_price,
            quantity=t.quantity,
            fees=t.fees,
            stop_price=t.stop_price,
            target_price=t.target_price,
            direction=t.direction,
        )
        reason = t.exit_reason or "manual"
        if calc.is_valid_for_risk_reward and calc.risk_reward_ratio is not None and calc.r_multiple is not None and calc.risk_reward_ratio != 0:
            capture = float(calc.r_multiple) / float(calc.risk_reward_ratio)
            capture_ratios.append(capture)
            if reason not in ("target",) and capture < 0.8:
                early_exits += 1
            has_target += 1

    avg_capture = round(sum(capture_ratios) / len(capture_ratios), 3) if capture_ratios else None
    early_exit_rate = round(early_exits / has_target * 100, 1) if has_target else None

    # ── Playbook highlights ──
    setups = db.query(SetupPlaybook).filter(SetupPlaybook.is_active == "active").all()
    setup_highlights = []
    for sp in setups:
        sp_trades = [t for t in all_trades if t.setup == sp.name and t.status != "deleted"]
        closed_sp = [t for t in sp_trades if t.pnl is not None]
        pnls = [float(t.pnl) for t in closed_sp]
        wins = [p for p in pnls if p > 0]
        setup_highlights.append({
            "name": sp.name,
            "trade_count": len(sp_trades),
            "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
            "avg_r": sp.avg_r,
            "total_pnl": str(round(sum(pnls), 2)) if pnls else None,
        })
    setup_highlights.sort(key=lambda x: float(x["total_pnl"] or 0), reverse=True)

    # ── Market context highlights ──
    latest_snap = (
        db.query(MarketSnapshot)
        .order_by(MarketSnapshot.date.desc())
        .first()
    )
    market_highlight = _MarketContextHighlight()
    if latest_snap:
        market_highlight = _MarketContextHighlight(
            date=str(latest_snap.date) if latest_snap.date else None,
            nifty_close=float(latest_snap.nifty_close) if latest_snap.nifty_close else None,
            nifty_change_pct=float(latest_snap.nifty_change_pct) if latest_snap.nifty_change_pct else None,
            india_vix=float(latest_snap.india_vix) if latest_snap.india_vix else None,
            fii_flow_cr=str(latest_snap.fii_flow_cr) if latest_snap.fii_flow_cr is not None else None,
            dii_flow_cr=str(latest_snap.dii_flow_cr) if latest_snap.dii_flow_cr is not None else None,
            breadth_advance=latest_snap.advance_count,
            breadth_decline=latest_snap.decline_count,
        )

    # Compute regime from change
    if latest_snap and latest_snap.nifty_change_pct:
        chg = float(latest_snap.nifty_change_pct)
        vix = float(latest_snap.india_vix or 0)
        if vix > 25:
            market_highlight.nifty_regime = "volatile"
        elif chg > 0.5:
            market_highlight.nifty_regime = "bullish"
        elif chg < -0.5:
            market_highlight.nifty_regime = "bearish"
        else:
            market_highlight.nifty_regime = "neutral"

    return IntelligenceDashboardResponse(
        lifecycle=_LifecycleHighlight(
            total_emotion_logs=total_emotion_logs,
            most_frequent_emotion=most_frequent,
            worst_performing_emotion=worst_emotion,
            graded_trades=graded_count,
            avg_grade_score=avg_grade,
            high_grade_rate=high_grade_rate,
            discipline_score=discipline_score,
        ),
        behavioral=_BehavioralHighlight(
            overtrading_days=overtrading_days,
            overtrading_weeks=overtrading_weeks,
            revenge_trades=revenge_count,
            early_exit_rate=early_exit_rate,
            avg_capture_ratio=avg_capture,
        ),
        playbook=_PlaybookHighlight(
            setups=setup_highlights[:5]
        ),
        market=market_highlight,
    )
