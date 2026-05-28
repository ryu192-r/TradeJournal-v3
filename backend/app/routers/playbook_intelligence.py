"""
Playbook Intelligence Router — deep per-setup analytics beyond basic CRUD stats.

GET  /api/v1/playbook/intelligence/overview    — across-all-setups comparison dashboard
GET  /api/v1/playbook/intelligence/{setup_name} — per-setup deep intelligence

Per-setup intelligence includes:
- expectancy, profit factor, R distribution
- ideal hold time (avg/median holding hours)
- best market conditions (time-of-day, day-of-week breakdowns)
- setup failure patterns (losing streaks, common exit reasons on losses)
- setup × behavior cross-analytics (emotion, execution grade)
- tactic-level performance breakdown
"""

from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.setup_playbook import SetupPlaybook
from app.utils.calculations import compute_aggregate_kpis
from app.utils.pnl_helpers import get_realized_pnl_events
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter(dependencies=[Depends(get_current_user)], prefix="/playbook", tags=["playbook-intelligence"])


def _parse_date_range(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
) -> tuple[Optional[datetime], Optional[datetime]]:
    start = None
    end = None
    if from_date:
        try:
            start = datetime.fromisoformat(from_date)
        except ValueError:
            pass
    if to_date:
        try:
            end = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            pass
    return start, end


def _get_setup_trades(db: Session, setup_name: str, start: Optional[datetime], end: Optional[datetime], user_id: int) -> list[Trade]:
    q = db.query(Trade).filter(Trade.setup == setup_name, Trade.status != "deleted", Trade.user_id == user_id)
    if start:
        q = q.filter(Trade.entry_time >= start)
    if end:
        q = q.filter(Trade.entry_time <= end)
    return q.order_by(Trade.entry_time.asc()).all()


def _compute_performance(trades: list[Trade]) -> dict:
    closed = [t for t in trades if t.exit_price is not None and t.pnl is not None]
    if not closed:
        return {
            "trade_count": len(trades), "closed_count": 0, "win_rate": None,
            "total_pnl": None, "avg_pnl": None, "profit_factor": None,
            "expectancy": None, "avg_r": None, "max_r": None, "min_r": None,
            "r_std": None,
        }

    kpis = compute_aggregate_kpis(closed)
    closed_count = kpis["trade_count"]
    r_vals = [float(t.r_multiple) for t in closed if t.r_multiple is not None]

    return {
        "trade_count": len(trades),
        "closed_count": closed_count,
        "win_rate": kpis["win_rate"],
        "total_pnl": kpis["net_pnl"],
        "avg_pnl": round(kpis["net_pnl"] / closed_count, 2) if closed_count > 0 else None,
        "profit_factor": kpis["profit_factor"],
        "expectancy": kpis["expectancy"],
        "avg_r": kpis["avg_r"],
        "max_r": round(max(r_vals), 2) if r_vals else None,
        "min_r": round(min(r_vals), 2) if r_vals else None,
        "r_std": round(
            (sum((r - sum(r_vals) / len(r_vals)) ** 2 for r in r_vals) / len(r_vals)) ** 0.5, 2
        ) if len(r_vals) > 1 else None,
    }


def _compute_hold_time(trades: list[Trade]) -> dict:
    holding_hours = []
    for t in trades:
        if t.entry_time and t.exit_time and t.exit_price is not None:
            delta = (t.exit_time - t.entry_time).total_seconds() / 3600
            if delta > 0:
                holding_hours.append(delta)

    if not holding_hours:
        return {"avg_hours": None, "median_hours": None, "min_hours": None, "max_hours": None, "sample_size": 0}

    sorted_h = sorted(holding_hours)
    median = sorted_h[len(sorted_h) // 2]

    best_pnl = None
    best_bucket = None
    buckets: dict[str, list[float]] = defaultdict(list)
    for t in trades:
        if t.entry_time and t.exit_time and t.exit_price is not None and t.pnl is not None:
            h = (t.exit_time - t.entry_time).total_seconds() / 3600
            if h < 4:
                bucket = "<4h"
            elif h < 24:
                bucket = "4-24h"
            elif h < 72:
                bucket = "1-3d"
            elif h < 168:
                bucket = "3-7d"
            else:
                bucket = ">7d"
            buckets[bucket].append(float(t.pnl))

    hold_performance = {}
    for bucket, pnls in buckets.items():
        hold_performance[bucket] = {
            "count": len(pnls),
            "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
            "win_rate": round(len([p for p in pnls if p > 0]) / len(pnls) * 100, 1) if pnls else None,
        }
        if best_pnl is None or (hold_performance[bucket]["avg_pnl"] is not None and best_pnl is not None and hold_performance[bucket]["avg_pnl"] > best_pnl):
            best_pnl = hold_performance[bucket]["avg_pnl"]
            best_bucket = bucket

    return {
        "avg_hours": round(sum(holding_hours) / len(holding_hours), 1),
        "median_hours": round(median, 1),
        "min_hours": round(min(holding_hours), 1),
        "max_hours": round(max(holding_hours), 1),
        "sample_size": len(holding_hours),
        "hold_performance": hold_performance,
        "best_hold_bucket": best_bucket,
    }


def _compute_market_conditions(trades: list[Trade]) -> dict:
    time_of_day: dict[int, dict] = defaultdict(lambda: {"count": 0, "wins": 0, "pnl": Decimal("0")})
    day_of_week: dict[int, dict] = defaultdict(lambda: {"count": 0, "wins": 0, "pnl": Decimal("0")})

    for t in trades:
        if t.entry_time and t.exit_price is not None and t.pnl is not None:
            hour = t.entry_time.hour
            dow = t.entry_time.weekday()
            pnl = t.pnl

            time_of_day[hour]["count"] += 1
            time_of_day[hour]["pnl"] += pnl
            if pnl > 0:
                time_of_day[hour]["wins"] += 1

            day_of_week[dow]["count"] += 1
            day_of_week[dow]["pnl"] += pnl
            if pnl > 0:
                day_of_week[dow]["wins"] += 1

    tod_list = []
    for hour in sorted(time_of_day.keys()):
        d = time_of_day[hour]
        tod_list.append({
            "hour": hour,
            "label": f"{hour:02d}:00",
            "count": d["count"],
            "win_rate": round(d["wins"] / d["count"] * 100, 1) if d["count"] else None,
            "avg_pnl": round(d["pnl"] / d["count"], 2) if d["count"] else None,
        })

    dow_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    dow_list = []
    for dow in sorted(day_of_week.keys()):
        d = day_of_week[dow]
        dow_list.append({
            "day_of_week": dow,
            "day_name": dow_names[dow] if dow < 5 else f"Day{dow}",
            "count": d["count"],
            "win_rate": round(d["wins"] / d["count"] * 100, 1) if d["count"] else None,
            "avg_pnl": round(d["pnl"] / d["count"], 2) if d["count"] else None,
        })

    best_tod = max(tod_list, key=lambda x: x.get("avg_pnl") or 0) if tod_list else None
    best_dow = max(dow_list, key=lambda x: x.get("avg_pnl") or 0) if dow_list else None
    worst_tod = min(tod_list, key=lambda x: x.get("avg_pnl") or 0) if tod_list else None
    worst_dow = min(dow_list, key=lambda x: x.get("avg_pnl") or 0) if dow_list else None

    return {
        "time_of_day": tod_list,
        "day_of_week": dow_list,
        "best_time": best_tod,
        "best_day": best_dow,
        "worst_time": worst_tod,
        "worst_day": worst_dow,
    }


def _compute_failure_patterns(trades: list[Trade]) -> dict:
    closed = [t for t in trades if t.exit_price is not None and t.pnl is not None]
    losers = [t for t in closed if (t.pnl or Decimal("0")) < 0]

    exit_reasons: dict[str, int] = defaultdict(int)
    for t in losers:
        reason = t.exit_reason or "manual"
        exit_reasons[reason] += 1

    streak = 0
    max_streak = 0
    current_streak = 0
    for t in sorted(closed, key=lambda x: x.entry_time or datetime.min):
        if (t.pnl or Decimal("0")) < 0:
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0
    streak = current_streak

    avg_loss = round(sum(t.pnl or Decimal("0") for t in losers) / len(losers), 2) if losers else None
    max_loss = round(min(t.pnl or Decimal("0") for t in losers), 2) if losers else None

    no_stop_losses = [t for t in losers if not t.stop_price or (t.stop_price or Decimal("0")) <= 0]
    missing_stop_rate = round(len(no_stop_losses) / len(losers) * 100, 1) if losers else None

    failure_insights = []
    if exit_reasons.get("manual", 0) > len(losers) * 0.5 if losers else False:
        failure_insights.append({
            "type": "warning",
            "message": f"Most losing trades exited manually ({exit_reasons.get('manual', 0)}/{len(losers)}). May indicate panic selling or lack of plan.",
        })
    if missing_stop_rate is not None and missing_stop_rate > 30:
        failure_insights.append({
            "type": "warning",
            "message": f"{missing_stop_rate}% of losing trades had no stop loss defined.",
        })
    if max_streak >= 4:
        failure_insights.append({
            "type": "pattern",
            "message": f"Longest consecutive loss streak is {max_streak}. Consider reducing size after {max_streak - 1} consecutive losses.",
        })

    return {
        "loss_count": len(losers),
        "avg_loss": avg_loss,
        "max_loss": max_loss,
        "max_consecutive_losses": max_streak,
        "current_loss_streak": streak,
        "exit_reasons_on_losses": [{"reason": r, "count": c} for r, c in sorted(exit_reasons.items(), key=lambda x: x[1], reverse=True)],
        "missing_stop_rate": missing_stop_rate,
        "insights": failure_insights,
    }


def _compute_behavior_crossover(db: Session, trades: list[Trade]) -> dict:
    trade_ids = [t.id for t in trades]
    if not trade_ids:
        return {"emotion_breakdown": [], "grade_breakdown": [], "emotion_pnl": []}

    all_emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    all_grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()

    emotion_by_trade: dict[int, list[EmotionLog]] = defaultdict(list)
    for e in all_emotions:
        emotion_by_trade[e.trade_id].append(e)

    grade_by_trade: dict[int, ExecutionGrade] = {}
    for g in all_grades:
        grade_by_trade[g.trade_id] = g

    emotion_agg: dict[str, dict] = defaultdict(lambda: {"count": 0, "wins": 0, "pnl": Decimal("0")})
    grade_agg: dict[str, dict] = defaultdict(lambda: {"count": 0, "wins": 0, "pnl": Decimal("0")})

    for t in trades:
        if t.exit_price is None or t.pnl is None:
            continue
        pnl = t.pnl
        is_win = pnl > 0

        for e in emotion_by_trade.get(t.id, []):
            emotion_agg[e.emotion]["count"] += 1
            emotion_agg[e.emotion]["pnl"] += pnl
            if is_win:
                emotion_agg[e.emotion]["wins"] += 1

        grade = grade_by_trade.get(t.id)
        if grade and grade.overall_grade:
            grade_agg[grade.overall_grade]["count"] += 1
            grade_agg[grade.overall_grade]["pnl"] += pnl
            if is_win:
                grade_agg[grade.overall_grade]["wins"] += 1

    emotion_pnl = []
    for emotion, data in sorted(emotion_agg.items(), key=lambda x: x[1]["pnl"], reverse=True):
        emotion_pnl.append({
            "emotion": emotion,
            "count": data["count"],
            "win_rate": round(data["wins"] / data["count"] * 100, 1) if data["count"] else None,
            "avg_pnl": round(data["pnl"] / data["count"], 2) if data["count"] else None,
        })

    grade_pnl = []
    grade_order = ["A", "B", "C", "D", "F"]
    for g in grade_order:
        if g in grade_agg:
            data = grade_agg[g]
            grade_pnl.append({
                "grade": g,
                "count": data["count"],
                "win_rate": round(data["wins"] / data["count"] * 100, 1) if data["count"] else None,
                "avg_pnl": round(data["pnl"] / data["count"], 2) if data["count"] else None,
            })

    return {"emotion_breakdown": emotion_pnl, "grade_breakdown": grade_pnl}


def _compute_tactic_performance(trades: list[Trade], playbook: SetupPlaybook) -> list[dict]:
    if not playbook.tactics:
        tactic_trades: dict[str, list] = defaultdict(list)
        for t in trades:
            if t.tactic:
                tactic_trades[t.tactic].append(t)

        results = []
        for tactic_name, tactic_trades_list in tactic_trades.items():
            closed = [t for t in tactic_trades_list if t.exit_price is not None and t.pnl is not None]
            if not closed:
                results.append({"tactic": tactic_name, "trade_count": len(tactic_trades_list), "closed_count": 0})
                continue
            pnls = [t.pnl for t in closed]
            wins = [p for p in pnls if p > 0]
            results.append({
                "tactic": tactic_name,
                "trade_count": len(tactic_trades_list),
                "closed_count": len(closed),
                "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
                "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
                "total_pnl": round(sum(pnls), 2),
            })
        return results

    tactic_names = [t.get("name") if isinstance(t, dict) else t.name for t in playbook.tactics]
    tactic_trades = {name: [] for name in tactic_names}
    uncategorized = []

    for t in trades:
        if t.tactic and t.tactic in tactic_names:
            tactic_trades[t.tactic].append(t)
        else:
            uncategorized.append(t)

    results = []
    for name in tactic_names:
        t_list = tactic_trades[name]
        closed = [t for t in t_list if t.exit_price is not None and t.pnl is not None]
        if not t_list:
            continue
        pnls = [t.pnl for t in closed] if closed else []
        wins = [p for p in pnls if p > 0]
        results.append({
            "tactic": name,
            "trade_count": len(t_list),
            "closed_count": len(closed),
            "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
            "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
            "total_pnl": round(sum(pnls), 2) if pnls else None,
        })

    if uncategorized:
        closed = [t for t in uncategorized if t.exit_price is not None and t.pnl is not None]
        pnls = [t.pnl for t in closed] if closed else []
        wins = [p for p in pnls if p > 0]
        results.append({
            "tactic": "Other",
            "trade_count": len(uncategorized),
            "closed_count": len(closed),
            "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
            "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
            "total_pnl": round(sum(pnls), 2) if pnls else None,
        })

    return results


# ─────────────────────── overview endpoint ───────────────────────

@router.get("/intelligence/overview")
def playbook_intelligence_overview(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Across-all-setups comparison dashboard. Ranks setups by expectancy, win rate, and PnL."""
    start, end = _parse_date_range(from_date, to_date)

    setups = db.query(SetupPlaybook).filter(SetupPlaybook.is_active == "active").all()
    if not setups:
        return {"setups": [], "best_by_expectancy": None, "best_by_win_rate": None, "best_by_pnl": None}

    # Fetch partial exit realized PnL events for open trades in this period
    realized_events = get_realized_pnl_events(db, current_user.id, start, end) if start and end else []
    pe_by_setup: dict[str, list] = defaultdict(list)
    for ev in realized_events:
        if ev.source == "partial_exit":
            pe_by_setup[ev.setup or "Unassigned"].append(ev)

    results = []
    for sp in setups:
        trades = _get_setup_trades(db, sp.name, start, end, current_user.id)
        if not trades and sp.name not in pe_by_setup:
            results.append({
                "setup_id": sp.id,
                "setup_name": sp.name,
                "trade_count": 0,
                "closed_count": 0,
                "win_rate": None,
                "expectancy": None,
                "profit_factor": None,
                "total_pnl": None,
                "avg_r": None,
            })
            continue

        perf = _compute_performance(trades)

        # Merge partial exit PnL into setup stats
        partial_events = pe_by_setup.get(sp.name, [])
        if partial_events:
            pe_pnl = sum(ev.pnl for ev in partial_events)
            pe_wins = sum(1 for ev in partial_events if ev.pnl > 0)
            total_pnl_val = Decimal(str(perf["total_pnl"])) + pe_pnl if perf["total_pnl"] is not None else pe_pnl
            perf["total_pnl"] = total_pnl_val
            perf["closed_count"] = perf["closed_count"] + len(partial_events)
            closed_with_pe = perf["trade_count"] + len(partial_events)
            all_wins = (perf.get("win_rate") or 0) / 100 * perf.get("closed_count", 0) if perf.get("win_rate") else 0
            all_wins += pe_wins
            perf["win_rate"] = round(all_wins / closed_with_pe * 100, 1) if closed_with_pe > 0 else None
            # Recalculate expectancy with partial exits
            if perf.get("expectancy") is not None:
                perf["expectancy"] = round(perf["expectancy"] + pe_pnl / len(partial_events) * (len(partial_events) / max(perf["closed_count"], 1)), 2)

        results.append({
            "setup_id": sp.id,
            "setup_name": sp.name,
            "trade_count": perf["trade_count"],
            "closed_count": perf["closed_count"],
            "win_rate": perf["win_rate"],
            "expectancy": perf["expectancy"],
            "profit_factor": perf["profit_factor"],
            "total_pnl": perf["total_pnl"],
            "avg_r": perf["avg_r"],
        })

    with_data = [r for r in results if r["closed_count"] > 0]
    best_exp = max(with_data, key=lambda x: x.get("expectancy") or -999999) if with_data else None
    best_wr = max(with_data, key=lambda x: x.get("win_rate") or 0) if with_data else None
    best_pnl = max(with_data, key=lambda x: x.get("total_pnl") or -999999) if with_data else None

    return {
        "setups": results,
        "best_by_expectancy": best_exp,
        "best_by_win_rate": best_wr,
        "best_by_pnl": best_pnl,
    }


# ─────────────────────── per-setup intelligence ───────────────────────

@router.get("/intelligence/{setup_name}")
def setup_intelligence(
    setup_name: str,
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deep per-setup intelligence: performance, hold time, market conditions,
    failure patterns, behavior crossover, and tactic breakdown."""
    start, end = _parse_date_range(from_date, to_date)

    playbook = db.query(SetupPlaybook).filter(SetupPlaybook.name == setup_name).first()
    if not playbook:
        raise HTTPException(status_code=404, detail=f"Setup '{setup_name}' not found")

    trades = _get_setup_trades(db, setup_name, start, end, current_user.id)

    # Fetch partial exit realized PnL events for this setup
    realized_events = get_realized_pnl_events(db, current_user.id, start, end) if start and end else []
    partial_events = [ev for ev in realized_events if ev.source == "partial_exit" and (ev.setup or "Unassigned") == setup_name]

    if not trades and not partial_events:
        return {
            "setup_name": setup_name,
            "description": playbook.description,
            "ideal_conditions": playbook.ideal_conditions,
            "risk_profile": playbook.risk_profile,
            "rules": playbook.rules,
            "performance": _compute_performance([]),
            "hold_time": _compute_hold_time([]),
            "market_conditions": _compute_market_conditions([]),
            "failure_patterns": _compute_failure_patterns([]),
            "behavior_crossover": _compute_behavior_crossover(db, []),
            "tactic_breakdown": _compute_tactic_performance([], playbook),
            "recent_trades": [],
        }

    perf = _compute_performance(trades)
    if partial_events:
        pe_pnl = sum(ev.pnl for ev in partial_events)
        pe_wins = sum(1 for ev in partial_events if ev.pnl > 0)
        total_pnl_val = Decimal(str(perf["total_pnl"])) + pe_pnl if perf["total_pnl"] is not None else pe_pnl
        perf["total_pnl"] = total_pnl_val
        perf["closed_count"] = perf["closed_count"] + len(partial_events)

    closed_trades = [t for t in trades if t.exit_price is not None]
    recent = sorted(closed_trades, key=lambda t: t.entry_time or datetime.min, reverse=True)[:10]

    return {
        "setup_name": setup_name,
        "description": playbook.description,
        "ideal_conditions": playbook.ideal_conditions,
        "risk_profile": playbook.risk_profile,
        "rules": playbook.rules,
        "performance": perf,
        "hold_time": _compute_hold_time(trades),
        "market_conditions": _compute_market_conditions(trades),
        "failure_patterns": _compute_failure_patterns(trades),
        "behavior_crossover": _compute_behavior_crossover(db, trades),
        "tactic_breakdown": _compute_tactic_performance(trades, playbook),
        "recent_trades": [
            {
                "id": t.id,
                "symbol": t.symbol,
                "entry_price": str(t.entry_price),
                "exit_price": str(t.exit_price) if t.exit_price else None,
                "pnl": str(t.pnl) if t.pnl else None,
                "r_multiple": str(t.r_multiple) if t.r_multiple else None,
                "exit_reason": t.exit_reason,
                "tactic": t.tactic,
                "entry_time": t.entry_time.isoformat() if t.entry_time else None,
            }
            for t in recent
        ],
    }