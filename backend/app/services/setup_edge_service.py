"""Setup Edge Service — R-multiple based setup expectancy, confidence, and status engine.

All metrics derived from actual closed trade data. No LLM scoring.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.market_snapshot import MarketSnapshot
from app.models.setup_playbook import SetupPlaybook
from app.models.trade import Trade
from app.utils.trade_dates import get_trade_session_date
from app.schemas.playbook_edge import (
    PlaybookEdgeListResponse,
    PlaybookScore,
    SetupConditionBreakdown,
    SetupEdgeConfidence,
    SetupEdgeDetailResponse,
    SetupEdgeMetrics,
    SetupEdgeStatus,
    SetupEdgeSummaryItem,
)


def _base_trades(db: Session, user_id: int) -> list[Trade]:
    return (
        db.query(Trade)
        .filter(Trade.user_id == user_id, Trade.status != "deleted")
        .order_by(Trade.entry_time.asc())
        .all()
    )


def _closed_with_r(trades: list[Trade]) -> list[Trade]:
    return [
        t for t in trades
        if t.exit_price is not None and t.pnl is not None and t.r_multiple is not None
    ]


def _r_value(trade: Trade) -> float:
    return float(trade.r_multiple)


def _entry_dt_ist(trade: Trade) -> Optional[datetime]:
    if not trade.entry_time:
        return None
    return trade.entry_time + timedelta(hours=5, minutes=30)


def _classify_r(r: float) -> str:
    if r > 0:
        return "win"
    if r < 0:
        return "loss"
    return "breakeven"


def _compute_r_streaks(r_vals: list[float]) -> tuple[int, int]:
    best_win = worst_loss = 0
    cur_win = cur_loss = 0
    for r in r_vals:
        if r > 0:
            cur_win += 1
            cur_loss = 0
            best_win = max(best_win, cur_win)
        elif r < 0:
            cur_loss += 1
            cur_win = 0
            worst_loss = max(worst_loss, cur_loss)
        else:
            cur_win = cur_loss = 0
    return best_win, worst_loss


def _max_drawdown_r(r_vals: list[float]) -> Optional[float]:
    if not r_vals:
        return None
    equity = 0.0
    peak = 0.0
    max_dd = 0.0
    for r in r_vals:
        equity += r
        peak = max(peak, equity)
        dd = peak - equity
        max_dd = max(max_dd, dd)
    return round(max_dd, 2)


def _expectancy_from_r_vals(r_vals: list[float]) -> tuple[Optional[float], Optional[float], Optional[float], Optional[float], Optional[float], int, int, int]:
    """Return win_rate, avg_winner_r, avg_loser_r, avg_r, expectancy_r, wins, losses, breakeven."""
    if not r_vals:
        return None, None, None, None, None, 0, 0, 0

    wins = [r for r in r_vals if r > 0]
    losses = [r for r in r_vals if r < 0]
    breakeven = len(r_vals) - len(wins) - len(losses)
    n = len(r_vals)

    win_rate = round(len(wins) / n * 100, 1)
    avg_winner = round(sum(wins) / len(wins), 2) if wins else None
    avg_loser = round(sum(losses) / len(losses), 2) if losses else None
    avg_r = round(sum(r_vals) / n, 2)

    wr_dec = len(wins) / n
    lr_dec = len(losses) / n
    expectancy = None
    if wins or losses:
        win_part = wr_dec * (avg_winner or 0)
        loss_part = lr_dec * abs(avg_loser or 0)
        expectancy = round(win_part - loss_part, 2)

    return win_rate, avg_winner, avg_loser, avg_r, expectancy, len(wins), len(losses), breakeven


def _profit_factor_r(r_vals: list[float]) -> Optional[float]:
    gross_win = sum(r for r in r_vals if r > 0)
    gross_loss = abs(sum(r for r in r_vals if r < 0))
    if gross_loss <= 0:
        return None
    return round(gross_win / gross_loss, 2)


def _recent_avg_r(trades: list[Trade], days: int, now: Optional[datetime] = None) -> Optional[float]:
    if not trades:
        return None
    now = now or datetime.utcnow()
    cutoff = now - timedelta(days=days)
    recent = [t for t in trades if t.entry_time and t.entry_time >= cutoff]
    r_vals = [_r_value(t) for t in recent]
    if not r_vals:
        return None
    return round(sum(r_vals) / len(r_vals), 2)


def _confidence_tier(sample_size: int) -> SetupEdgeConfidence:
    if sample_size >= 50:
        return SetupEdgeConfidence.HIGH
    if sample_size >= 20:
        return SetupEdgeConfidence.MEDIUM
    return SetupEdgeConfidence.LOW


def _downgrade_confidence(confidence: SetupEdgeConfidence) -> SetupEdgeConfidence:
    if confidence == SetupEdgeConfidence.HIGH:
        return SetupEdgeConfidence.MEDIUM
    if confidence == SetupEdgeConfidence.MEDIUM:
        return SetupEdgeConfidence.LOW
    return SetupEdgeConfidence.LOW


def _compute_confidence(sample_size: int, recent_20_expectancy: Optional[float]) -> SetupEdgeConfidence:
    confidence = _confidence_tier(sample_size)
    if recent_20_expectancy is not None and recent_20_expectancy < 0:
        confidence = _downgrade_confidence(confidence)
    return confidence


def _compute_status(
    expectancy_r: Optional[float],
    sample_size: int,
    confidence: SetupEdgeConfidence,
) -> SetupEdgeStatus:
    if expectancy_r is not None and expectancy_r < 0 and sample_size >= 20:
        return SetupEdgeStatus.PAUSE
    if (
        expectancy_r is not None
        and expectancy_r > 0.25
        and confidence in (SetupEdgeConfidence.MEDIUM, SetupEdgeConfidence.HIGH)
    ):
        return SetupEdgeStatus.FOCUS
    return SetupEdgeStatus.WATCH


def _r_std(r_vals: list[float]) -> float:
    if len(r_vals) < 2:
        return 0.0
    mean = sum(r_vals) / len(r_vals)
    var = sum((r - mean) ** 2 for r in r_vals) / len(r_vals)
    return var ** 0.5


def compute_playbook_score(metrics: SetupEdgeMetrics, r_vals: list[float]) -> PlaybookScore:
    """0-100 score: 40% expectancy, 20% win rate, 20% consistency, 20% recent."""
    exp_r = metrics.expectancy_r or 0.0
    expectancy_component = min(40.0, max(0.0, (exp_r + 0.5) / 1.5 * 40))

    wr = (metrics.win_rate or 0) / 100
    win_rate_component = min(20.0, max(0.0, wr * 20))

    std = _r_std(r_vals)
    consistency_component = min(20.0, max(0.0, 20.0 * (1.0 - min(std, 2.0) / 2.0)))

    recent = metrics.recent_30d_r
    avg = metrics.avg_r
    recent_component = 10.0
    if recent is not None and avg is not None:
        if avg != 0:
            ratio = recent / avg
            recent_component = min(20.0, max(0.0, ratio * 10))
        elif recent > 0:
            recent_component = 15.0
        else:
            recent_component = 5.0

    total = int(round(expectancy_component + win_rate_component + consistency_component + recent_component))
    total = min(100, max(0, total))
    if metrics.expectancy_r is not None and metrics.expectancy_r < 0:
        total = min(total, 45)

    return PlaybookScore(
        setup_name=metrics.setup_name,
        score=total,
        expectancy_component=round(expectancy_component, 1),
        win_rate_component=round(win_rate_component, 1),
        consistency_component=round(consistency_component, 1),
        recent_component=round(recent_component, 1),
    )


def _market_regime_bucket(regime: Optional[str], trend: Optional[str]) -> str:
    text = f"{regime or ''} {trend or ''}".lower()
    if any(k in text for k in ("trend", "bull", "bear", "up", "down", "momentum")):
        return "Trending"
    if any(k in text for k in ("range", "sideways", "chop", "flat", "consolidation")):
        return "Range"
    return "Unknown"


def _time_of_day_bucket(trade: Trade) -> str:
    ist = _entry_dt_ist(trade)
    if not ist:
        return "Unknown"
    hour = ist.hour
    if hour < 11:
        return "Morning"
    if hour < 14:
        return "Midday"
    return "Afternoon"


def _day_of_week_label(trade: Trade) -> str:
    ist = _entry_dt_ist(trade)
    if not ist:
        return "Unknown"
    names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    return names[ist.weekday()]


def _compute_condition_breakdowns(
    db: Session,
    user_id: int,
    setup_name: str,
    trades: list[Trade],
) -> list[SetupConditionBreakdown]:
    closed = _closed_with_r(trades)
    if not closed:
        return []

    snapshot_dates = {get_trade_session_date(t) for t in closed if get_trade_session_date(t)}
    snapshots: dict = {}
    if snapshot_dates:
        rows = (
            db.query(MarketSnapshot)
            .filter(
                MarketSnapshot.user_id == user_id,
                MarketSnapshot.date.in_(snapshot_dates),
            )
            .all()
        )
        snapshots = {r.date: r for r in rows}

    buckets: dict[tuple[str, str], list[float]] = defaultdict(list)

    for t in closed:
        r = _r_value(t)
        buckets[("time_of_day", _time_of_day_bucket(t))].append(r)
        buckets[("day_of_week", _day_of_week_label(t))].append(r)
        direction = (t.direction or "LONG").upper()
        buckets[("direction", direction)].append(r)

        if t.entry_time:
            snap = snapshots.get(get_trade_session_date(t))
            if snap:
                bucket = _market_regime_bucket(snap.nifty_regime, snap.nifty_trend)
                buckets[("market_context", bucket)].append(r)

    results: list[SetupConditionBreakdown] = []
    for (ctype, cvalue), r_vals in sorted(buckets.items(), key=lambda x: (-len(x[1]), x[0][0], x[0][1])):
        if cvalue == "Unknown" and len(r_vals) < 3:
            continue
        _, _, _, avg_r, exp_r, _, _, _ = _expectancy_from_r_vals(r_vals)
        results.append(SetupConditionBreakdown(
            setup_name=setup_name,
            condition_type=ctype,
            condition_value=cvalue,
            sample_size=len(r_vals),
            avg_r=avg_r,
            expectancy_r=exp_r,
        ))
    return results


def _setup_names_for_user(db: Session, user_id: int, trades: list[Trade]) -> list[str]:
    # SetupPlaybook is global today; filter by user_id here if playbooks become per-user.
    names: set[str] = set()
    for sp in db.query(SetupPlaybook).filter(SetupPlaybook.is_active == "active").all():
        names.add(sp.name)
    for t in trades:
        if t.setup:
            names.add(t.setup)
    return sorted(names)


def calculate_setup_edge(
    db: Session,
    setup_name: str,
    user_id: int,
    now: Optional[datetime] = None,
) -> SetupEdgeDetailResponse:
    """Core edge calculator for one setup."""
    now = now or datetime.utcnow()
    all_trades = _base_trades(db, user_id)
    setup_trades = [t for t in all_trades if (t.setup or "Uncategorised") == setup_name]
    closed = _closed_with_r(setup_trades)
    r_vals = [_r_value(t) for t in closed]

    win_rate, avg_winner, avg_loser, avg_r, expectancy_r, wins, losses, breakeven = _expectancy_from_r_vals(r_vals)
    best_streak, worst_streak = _compute_r_streaks(r_vals)

    last_20 = r_vals[-20:] if r_vals else []
    _, _, _, _, recent_20_exp, _, _, _ = _expectancy_from_r_vals(last_20)
    confidence = _compute_confidence(len(closed), recent_20_exp)
    status = _compute_status(expectancy_r, len(closed), confidence)

    metrics = SetupEdgeMetrics(
        setup_name=setup_name,
        sample_size=len(closed),
        wins=wins,
        losses=losses,
        breakeven=breakeven,
        win_rate=win_rate,
        avg_winner_r=avg_winner,
        avg_loser_r=avg_loser,
        avg_r=avg_r,
        expectancy_r=expectancy_r,
        profit_factor=_profit_factor_r(r_vals),
        recent_30d_r=_recent_avg_r(closed, 30, now),
        recent_90d_r=_recent_avg_r(closed, 90, now),
        max_drawdown_r=_max_drawdown_r(r_vals),
        best_streak=best_streak,
        worst_streak=worst_streak,
        confidence=confidence,
        status=status,
    )

    score = compute_playbook_score(metrics, r_vals)
    metrics.playbook_score = score.score
    conditions = _compute_condition_breakdowns(db, user_id, setup_name, setup_trades)

    return SetupEdgeDetailResponse(metrics=metrics, playbook_score=score, conditions=conditions)


def get_all_setup_edges(db: Session, user_id: int) -> PlaybookEdgeListResponse:
    """All setups ranked by playbook score."""
    now = datetime.utcnow()
    trades = _base_trades(db, user_id)
    names = _setup_names_for_user(db, user_id, trades)

    # Per-setup calculate_setup_edge reloads trades; batch if setup count grows large.
    metrics_list: list[SetupEdgeMetrics] = []
    for name in names:
        detail = calculate_setup_edge(db, name, user_id, now)
        if detail.metrics.sample_size > 0:
            metrics_list.append(detail.metrics)

    metrics_list.sort(key=lambda m: (m.playbook_score or 0, m.expectancy_r or -999), reverse=True)

    focus = [m.setup_name for m in metrics_list if m.status == SetupEdgeStatus.FOCUS]
    pause = [m.setup_name for m in metrics_list if m.status == SetupEdgeStatus.PAUSE]

    return PlaybookEdgeListResponse(
        generated_at=now.isoformat() + "Z",
        setups=metrics_list,
        focus_setups=focus,
        pause_setups=pause,
    )


def get_top_setup_edge(db: Session, user_id: int) -> Optional[SetupEdgeSummaryItem]:
    data = get_all_setup_edges(db, user_id)
    ranked = [m for m in data.setups if m.expectancy_r is not None]
    if not ranked:
        return None
    best = max(ranked, key=lambda m: (m.expectancy_r or -999, m.sample_size))
    return SetupEdgeSummaryItem(
        setup_name=best.setup_name,
        expectancy_r=best.expectancy_r,
        avg_r=best.avg_r,
        sample_size=best.sample_size,
        confidence=best.confidence,
        status=best.status,
        playbook_score=best.playbook_score,
    )


def get_weakest_setup_edge(db: Session, user_id: int) -> Optional[SetupEdgeSummaryItem]:
    data = get_all_setup_edges(db, user_id)
    ranked = [m for m in data.setups if m.sample_size >= 5 and m.expectancy_r is not None]
    if not ranked:
        return None
    worst = min(ranked, key=lambda m: (m.expectancy_r or 999, -m.sample_size))
    return SetupEdgeSummaryItem(
        setup_name=worst.setup_name,
        expectancy_r=worst.expectancy_r,
        avg_r=worst.avg_r,
        sample_size=worst.sample_size,
        confidence=worst.confidence,
        status=worst.status,
        playbook_score=worst.playbook_score,
    )


def get_setup_expectancy_line(db: Session, user_id: int, setup_name: str) -> Optional[str]:
    """Coaching-friendly one-liner, e.g. 'Breakout expectancy +0.61R'."""
    detail = calculate_setup_edge(db, setup_name, user_id)
    exp = detail.metrics.expectancy_r
    if exp is None or detail.metrics.sample_size == 0:
        return None
    sign = "+" if exp >= 0 else ""
    return f"{setup_name} expectancy {sign}{exp:.2f}R"
