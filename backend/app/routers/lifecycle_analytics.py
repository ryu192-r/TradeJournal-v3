"""
Lifecycle Analytics Router — emotion aggregation, execution grade analytics,
behavioral analytics, revenge trade detection, overtrading detection,
early exit analysis, and composite discipline scoring.

GET  /api/v1/lifecycle/emotion-summary    — emotion frequency + PnL by emotion
GET  /api/v1/lifecycle/grade-summary      — grade distribution + avg PnL by grade
GET  /api/v1/lifecycle/behavioral          — emotion-grade correlations + discipline score
GET  /api/v1/lifecycle/revenge-trades      — detect revenge trades programmatically
GET  /api/v1/lifecycle/overtrading         — detect overtrading patterns by frequency
GET  /api/v1/lifecycle/early-exits         — analyze early exit patterns and capture ratios
GET  /api/v1/lifecycle/discipline-score     — composite behavioral discipline score
"""

from datetime import datetime, timedelta, date
from typing import Optional, List
from decimal import Decimal
from collections import defaultdict
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.db.database import get_db
from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.trade_timeline import TradeTimeline
from app.models.daily_journal import DailyJournal

router = APIRouter(prefix="/lifecycle", tags=["lifecycle-analytics"])


# ─────────────────────── helpers ───────────────────────

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


def _base_trade_query(db: Session, start: Optional[datetime], end: Optional[datetime]):
    q = db.query(Trade).filter(Trade.status != "deleted")
    if start:
        q = q.filter(Trade.entry_time >= start)
    if end:
        q = q.filter(Trade.entry_time <= end)
    return q


# ─────────────────────── emotion summary ───────────────────────

@router.get("/emotion-summary")
def emotion_summary(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
):
    """Aggregate emotion frequency, average PnL, and win rate by emotion type."""
    start, end = _parse_date_range(from_date, to_date)

    trades_q = _base_trade_query(db, start, end)
    trades = trades_q.all()
    trade_ids = [t.id for t in trades]
    trades_map = {t.id: t for t in trades}

    if not trade_ids:
        return {"emotions": [], "total_logs": 0, "most_frequent": None, "worst_performing": None}

    rows = (
        db.query(
            EmotionLog.emotion,
            func.count(EmotionLog.id).label("count"),
            func.avg(EmotionLog.confidence).label("avg_confidence"),
            func.avg(EmotionLog.stress).label("avg_stress"),
            func.avg(EmotionLog.conviction).label("avg_conviction"),
            func.avg(EmotionLog.patience).label("avg_patience"),
            func.avg(EmotionLog.focus).label("avg_focus"),
        )
        .filter(EmotionLog.trade_id.in_(trade_ids))
        .group_by(EmotionLog.emotion)
        .all()
    )

    all_emotion_logs = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    emotion_trade_ids: dict[str, list[int]] = defaultdict(list)
    for log in all_emotion_logs:
        emotion_trade_ids[log.emotion].append(log.trade_id)

    emotion_pnl: dict[str, dict] = {}
    for emotion_type in set(r.emotion for r in rows):
        ids = list(set(emotion_trade_ids[emotion_type]))
        trades_with = [trades_map[tid] for tid in ids if tid in trades_map and trades_map[tid].exit_price is not None]
        pnls = [float(t.pnl or 0) for t in trades_with]
        wins = [p for p in pnls if p > 0]
        emotion_pnl[emotion_type] = {
            "trade_count": len(trades_with),
            "total_pnl": str(Decimal(str(sum(pnls))).quantize(Decimal("0.01"))) if pnls else "0.00",
            "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
        }

    emotions = []
    most_frequent = None
    worst_performing = None
    max_count = 0
    worst_pnl = Decimal("Infinity")

    for r in rows:
        pnl_info = emotion_pnl.get(r.emotion, {"trade_count": 0, "total_pnl": "0.00", "win_rate": None})
        entry = {
            "emotion": r.emotion,
            "count": r.count,
            "avg_confidence": round(float(r.avg_confidence), 1) if r.avg_confidence else None,
            "avg_stress": round(float(r.avg_stress), 1) if r.avg_stress else None,
            "avg_conviction": round(float(r.avg_conviction), 1) if r.avg_conviction else None,
            "avg_patience": round(float(r.avg_patience), 1) if r.avg_patience else None,
            "avg_focus": round(float(r.avg_focus), 1) if r.avg_focus else None,
            "trade_count": pnl_info["trade_count"],
            "total_pnl": pnl_info["total_pnl"],
            "win_rate": pnl_info["win_rate"],
        }
        emotions.append(entry)
        if r.count > max_count:
            max_count = r.count
            most_frequent = r.emotion
        pnl_val = Decimal(pnl_info["total_pnl"])
        if pnl_val < worst_pnl:
            worst_pnl = pnl_val
            worst_performing = r.emotion

    return {
        "emotions": emotions,
        "total_logs": sum(e["count"] for e in emotions),
        "most_frequent": most_frequent,
        "worst_performing": worst_performing,
    }


# ─────────────────────── grade summary ───────────────────────

@router.get("/grade-summary")
def grade_summary(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
):
    """Aggregate execution grade distribution + PnL by overall grade."""
    start, end = _parse_date_range(from_date, to_date)
    trades_q = _base_trade_query(db, start, end)
    trades = trades_q.all()
    trade_ids = [t.id for t in trades]

    if not trade_ids:
        return {"grade_distribution": {}, "dimension_averages": {}, "grade_pnl": [], "avg_overall": None}

    grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()
    trades_map = {t.id: t for t in trades}

    grade_dist: dict[str, int] = {}
    dim_vals: dict[str, list[str]] = {
        "entry_quality": [], "sizing_quality": [], "stop_quality": [],
        "patience": [], "rule_adherence": [], "exit_quality": [],
    }
    grade_pnl: list[dict] = []
    all_overall: list[str] = []
    grade_order = ["A", "B", "C", "D", "F"]

    for g in grades:
        overall = g.overall_grade or "N/A"
        grade_dist[overall] = grade_dist.get(overall, 0) + 1
        if g.overall_grade:
            all_overall.append(g.overall_grade)
        for dim in dim_vals:
            val = getattr(g, dim, None)
            if val:
                dim_vals[dim].append(val)

        trade = trades_map.get(g.trade_id)
        if trade and trade.exit_price is not None:
            grade_pnl.append({
                "trade_id": g.trade_id,
                "overall_grade": overall,
                "pnl": str(trade.pnl) if trade.pnl else "0.00",
                "symbol": trade.symbol,
            })

    dim_avgs = {}
    grade_map = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
    for dim, vals in dim_vals.items():
        if vals:
            numeric = [grade_map[v] for v in vals if v in grade_map]
            dim_avgs[dim] = round(sum(numeric) / len(numeric), 2) if numeric else None
        else:
            dim_avgs[dim] = None

    avg_overall = None
    if all_overall:
        numeric = [grade_map[g] for g in all_overall if g in grade_map]
        avg_overall = round(sum(numeric) / len(numeric), 2) if numeric else None

    grade_pnl_summary = []
    for grade in grade_order:
        matching = [e for e in grade_pnl if e["overall_grade"] == grade]
        if not matching:
            continue
        pnls = [Decimal(e["pnl"]) for e in matching]
        wins = [p for p in pnls if p > 0]
        grade_pnl_summary.append({
            "grade": grade,
            "count": len(matching),
            "avg_pnl": str(round(sum(float(p) for p in pnls) / len(pnls), 2)) if pnls else "0.00",
            "total_pnl": str(sum(pnls)),
            "win_rate": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
        })

    return {
        "grade_distribution": grade_dist,
        "dimension_averages": dim_avgs,
        "grade_pnl": grade_pnl_summary,
        "avg_overall": avg_overall,
    }


# ─────────────────────── behavioral analytics ───────────────────────

@router.get("/behavioral")
def behavioral_analytics(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
):
    """Cross-reference emotions with execution grades + PnL to reveal behavioral patterns."""
    start, end = _parse_date_range(from_date, to_date)
    trades_q = _base_trade_query(db, start, end)
    closed_trades = [t for t in trades_q.all() if t.exit_price is not None]

    if not closed_trades:
        return {"emotion_grade_matrix": [], "discipline_score": None, "insights": []}

    trade_ids = [t.id for t in closed_trades]

    all_emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    all_grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()

    emotion_by_trade: dict[int, list[EmotionLog]] = {}
    for e in all_emotions:
        emotion_by_trade.setdefault(e.trade_id, []).append(e)

    grade_by_trade: dict[int, ExecutionGrade] = {}
    for g in all_grades:
        grade_by_trade[g.trade_id] = g

    grade_map = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}

    matrix: dict[str, dict] = {}
    for t in closed_trades:
        emotions = emotion_by_trade.get(t.id, [])
        grade = grade_by_trade.get(t.id)
        pnl = float(t.pnl or 0)

        for e in emotions:
            key = e.emotion
            if key not in matrix:
                matrix[key] = {"avg_pnl": 0, "win_rate": 0, "avg_grade_numeric": 0, "count": 0, "wins": 0, "total_pnl": 0, "grade_sum": 0}
            m = matrix[key]
            m["count"] += 1
            m["total_pnl"] += pnl
            if pnl > 0:
                m["wins"] += 1
            if grade and grade.overall_grade:
                m["grade_sum"] += grade_map.get(grade.overall_grade, 0)

    emotion_grade_matrix = []
    for emotion, data in sorted(matrix.items(), key=lambda x: x[1]["total_pnl"]):
        emotion_grade_matrix.append({
            "emotion": emotion,
            "count": data["count"],
            "avg_pnl": round(data["total_pnl"] / data["count"], 2) if data["count"] else 0,
            "total_pnl": round(data["total_pnl"], 2),
            "win_rate": round(data["wins"] / data["count"] * 100, 1) if data["count"] else 0,
            "avg_grade_numeric": round(data["grade_sum"] / data["count"], 2) if data["grade_sum"] and data["count"] else None,
        })

    graded_trades = [g for g in all_grades if g.overall_grade]
    high_grades = [g for g in graded_trades if g.overall_grade in ("A", "B")]
    discipline_score = round(len(high_grades) / len(graded_trades) * 100, 1) if graded_trades else None

    insights: list[dict] = []

    revenge_emotions = [e for e in emotion_grade_matrix if e["emotion"] in ("revenge", "fomo")]
    for r in revenge_emotions:
        if r["avg_pnl"] < 0 or (r["win_rate"] and r["win_rate"] < 40):
            insights.append({
                "type": "warning",
                "message": f"When {r['emotion']}, avg PnL is ₹{r['avg_pnl']} with {r['win_rate']}% win rate across {r['count']} trades",
                "emotion": r["emotion"],
            })

    low_grade_emotions = [e for e in emotion_grade_matrix if e.get("avg_grade_numeric") and e["avg_grade_numeric"] < 3]
    for lg in low_grade_emotions:
        insights.append({
            "type": "insight",
            "message": f"Trading while {lg['emotion']} correlates with lower execution grades (avg {lg['avg_grade_numeric']}/5)",
            "emotion": lg["emotion"],
        })

    return {
        "emotion_grade_matrix": emotion_grade_matrix,
        "discipline_score": discipline_score,
        "insights": insights,
    }


# ─────────────────────── revenge trade detection ───────────────────────

@router.get("/revenge-trades")
def revenge_trades(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    hours_window: int = Query(4, description="Hours after a loss to consider revenge window"),
    db: Session = Depends(get_db),
):
    """Detect trades opened shortly after a losing trade — programmatic revenge trade detection.

    A trade is flagged as a potential revenge trade if:
    1. It was opened within `hours_window` hours after a closed losing trade
    2. The trade has an emotion log with 'revenge' or 'fomo' emotion, OR
    3. The entry came within the revenge window regardless of emotion data
    """
    start, end = _parse_date_range(from_date, to_date)
    trades_q = _base_trade_query(db, start, end)
    all_trades = trades_q.order_by(Trade.entry_time.asc()).all()
    trades_map = {t.id: t for t in all_trades}

    if not all_trades:
        return {"revenge_trades": [], "total_flagged": 0, "avg_pnl_flagged": None, "avg_pnl_unflagged": None}

    trade_ids = [t.id for t in all_trades]
    all_emotions = {e.trade_id: e for e in db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()}

    loss_times_sorted = [t.entry_time for t in all_trades if t.exit_price is not None and t.pnl is not None and t.pnl < 0 and t.entry_time]
    for t in all_trades:
        revenge_emotion = False
        emotion = all_emotions.get(t.id)
        if emotion and emotion.emotion in ("revenge", "fomo"):
            revenge_emotion = True

        within_window = False
        # binary search in loss_times_sorted for nearest loss before t.entry_time
        if loss_times_sorted and t.entry_time:
            import bisect
            idx = bisect.bisect_left(loss_times_sorted, t.entry_time) - 1
            if idx >= 0:
                nearest = loss_times_sorted[idx]
                if (t.entry_time - nearest).total_seconds() <= hours_window * 3600:
                    within_window = True

        if revenge_emotion or within_window:
            revenge_trades_list.append({
                "trade_id": t.id,
                "symbol": t.symbol,
                "entry_time": t.entry_time.isoformat() if t.entry_time else None,
                "pnl": str(t.pnl) if t.pnl else None,
                "emotion": emotion.emotion if emotion else None,
                "flagged_reason": "emotion" if revenge_emotion and not within_window else
                                   "window" if within_window and not revenge_emotion else "both",
                "hours_after_loss": None,
            })

    loss_times_sorted = sorted(loss_times_sorted)
    for rt in revenge_trades_list:
        trade = trades_map.get(rt["trade_id"])
        if trade and trade.entry_time:
            nearest_loss = None
            for lt in reversed(loss_times_sorted):
                if lt < trade.entry_time:
                    nearest_loss = lt
                    break
            if nearest_loss:
                rt["hours_after_loss"] = round((trade.entry_time - nearest_loss).total_seconds() / 3600, 1)

    return {
        "revenge_trades": revenge_trades_list,
        "total_flagged": len(revenge_trades_list),
        "avg_pnl_flagged": round(sum(flagged_pnls) / len(flagged_pnls), 2) if flagged_pnls else None,
        "avg_pnl_unflagged": round(sum(unflagged_pnls) / len(unflagged_pnls), 2) if unflagged_pnls else None,
    }


# ─────────────────────── overtrading detection ───────────────────────

@router.get("/overtrading")
def overtrading_detection(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    daily_threshold: int = Query(3, description="Max trades per day before flagging"),
    weekly_threshold: int = Query(10, description="Max trades per week before flagging"),
    db: Session = Depends(get_db),
):
    """Detect overtrading patterns by analyzing trade frequency per day/week.

    Flags days and weeks where trade count exceeds thresholds, computes PnL impact,
    and identifies emotional state during overtrading sessions.
    """
    start, end = _parse_date_range(from_date, to_date)
    trades_q = _base_trade_query(db, start, end)
    all_trades = trades_q.order_by(Trade.entry_time.asc()).all()

    if not all_trades:
        return {
            "overtrading_days": [],
            "overtrading_weeks": [],
            "total_overtrading_trades": 0,
            "avg_pnl_overtrading": None,
            "avg_pnl_normal": None,
            "summary": {"total_days": 0, "overtrading_days": 0, "total_weeks": 0, "overtrading_weeks": 0},
        }

    trade_ids = [t.id for t in all_trades]
    all_emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    emotion_by_trade: dict[int, list[EmotionLog]] = {}
    for e in all_emotions:
        emotion_by_trade.setdefault(e.trade_id, []).append(e)

    daily: dict[str, list] = defaultdict(list)
    weekly: dict[str, list] = defaultdict(list)

    for t in all_trades:
        if t.entry_time:
            day_key = t.entry_time.strftime("%Y-%m-%d")
            iso_cal = t.entry_time.isocalendar()
            week_key = f"{iso_cal[0]}-W{iso_cal[1]:02d}"
            daily[day_key].append(t)
            weekly[week_key].append(t)

    overtrading_days = []
    for day_key in sorted(daily.keys()):
        day_trades = daily[day_key]
        if len(day_trades) > daily_threshold:
            pnls = [float(t.pnl or 0) for t in day_trades if t.exit_price is not None]
            emotions_day = []
            for t in day_trades:
                for e in emotion_by_trade.get(t.id, []):
                    emotions_day.append(e.emotion)
            overtrading_days.append({
                "date": day_key,
                "trade_count": len(day_trades),
                "threshold": daily_threshold,
                "total_pnl": round(sum(pnls), 2) if pnls else None,
                "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
                "win_rate": round(len([p for p in pnls if p > 0]) / len(pnls) * 100, 1) if pnls else None,
                "emotions": list(set(emotions_day)),
                "trade_ids": [t.id for t in day_trades],
            })

    overtrading_weeks = []
    for week_key in sorted(weekly.keys()):
        week_trades = weekly[week_key]
        if len(week_trades) > weekly_threshold:
            pnls = [float(t.pnl or 0) for t in week_trades if t.exit_price is not None]
            emotions_week = []
            for t in week_trades:
                for e in emotion_by_trade.get(t.id, []):
                    emotions_week.append(e.emotion)
            overtrading_weeks.append({
                "week": week_key,
                "trade_count": len(week_trades),
                "threshold": weekly_threshold,
                "total_pnl": round(sum(pnls), 2) if pnls else None,
                "avg_pnl": round(sum(pnls) / len(pnls), 2) if pnls else None,
                "win_rate": round(len([p for p in pnls if p > 0]) / len(pnls) * 100, 1) if pnls else None,
                "top_emotions": sorted(set(emotions_week), key=lambda x: emotions_week.count(x), reverse=True)[:3],
            })

    ot_trade_ids = set()
    for day in overtrading_days:
        ot_trade_ids.update(day["trade_ids"])
    for week in overtrading_weeks:
        for t in weekly.get(week["week"], []):
            ot_trade_ids.add(t.id)

    ot_pnls = [float(t.pnl or 0) for t in all_trades if t.id in ot_trade_ids and t.exit_price is not None]
    normal_pnls = [float(t.pnl or 0) for t in all_trades if t.id not in ot_trade_ids and t.exit_price is not None]

    unique_days = set(daily.keys())
    overtrading_day_set = {d["date"] for d in overtrading_days}
    total_weeks = len(weekly)
    ot_weeks_count = len(overtrading_weeks)

    return {
        "overtrading_days": overtrading_days,
        "overtrading_weeks": overtrading_weeks,
        "total_overtrading_trades": len(ot_trade_ids),
        "avg_pnl_overtrading": round(sum(ot_pnls) / len(ot_pnls), 2) if ot_pnls else None,
        "avg_pnl_normal": round(sum(normal_pnls) / len(normal_pnls), 2) if normal_pnls else None,
        "summary": {
            "total_days": len(unique_days),
            "overtrading_days": len(overtrading_day_set),
            "total_weeks": total_weeks,
            "overtrading_weeks": ot_weeks_count,
        },
    }


# ─────────────────────── early exit analysis ───────────────────────

@router.get("/early-exits")
def early_exit_analysis(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
):
    """Analyze trades closed before reaching target or stop — early exit patterns.

    Computes capture ratio (how much of the R-multiple was captured), exit reason
    breakdown, and identifies systematic early exit tendencies.
    """
    start, end = _parse_date_range(from_date, to_date)
    trades_q = _base_trade_query(db, start, end)
    closed_trades = [t for t in trades_q.all() if t.exit_price is not None and t.pnl is not None]

    if not closed_trades:
        return {
            "total_closed": 0,
            "exit_reason_breakdown": [],
            "capture_stats": None,
            "early_exits": [],
            "early_exit_rate": None,
            "avg_pnl_early_exit": None,
            "avg_pnl_full_exit": None,
            "dimension_scores": None,
        }

    trade_ids = [t.id for t in closed_trades]
    all_grades = {g.trade_id: g for g in db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()}

    exit_reasons: dict[str, dict] = defaultdict(lambda: {"count": 0, "pnl": 0.0, "wins": 0})
    capture_ratios = []
    early_exits = []

    has_target = 0
    target_reached = 0
    stop_hit = 0
    manual_exits = 0

    for t in closed_trades:
        pnl = float(t.pnl or 0)
        reason = t.exit_reason or "manual"
        exit_reasons[reason]["count"] += 1
        exit_reasons[reason]["pnl"] += pnl
        if pnl > 0:
            exit_reasons[reason]["wins"] += 1

        entry = float(t.entry_price or 0)
        stop = float(t.stop_price or 0) if t.stop_price else None
        target = float(t.target_price or 0) if t.target_price else None
        exit_p = float(t.exit_price or 0)

        if target and stop and entry and (target - entry) != 0 and (entry - stop) != 0:
            risk = entry - stop
            reward = target - entry
            actual_r = pnl / risk if risk != 0 else None
            max_r = reward / risk if risk != 0 else None

            if actual_r is not None and max_r is not None and max_r != 0:
                capture = actual_r / max_r
                capture_ratios.append(capture)

                is_early = reason not in ("target",) and capture < 0.8
                if is_early:
                    grade = all_grades.get(t.id)
                    early_exits.append({
                        "trade_id": t.id,
                        "symbol": t.symbol,
                        "entry_price": str(t.entry_price),
                        "exit_price": str(t.exit_price),
                        "target_price": str(t.target_price) if t.target_price else None,
                        "stop_price": str(t.stop_price) if t.stop_price else None,
                        "pnl": str(t.pnl),
                        "exit_reason": reason,
                        "capture_ratio": round(capture, 3),
                        "actual_r": round(actual_r, 2),
                        "max_r": round(max_r, 1),
                        "exit_quality_grade": grade.exit_quality if grade else None,
                        "entry_time": t.entry_time.isoformat() if t.entry_time else None,
                    })

            has_target += 1
            if reason == "target":
                target_reached += 1
            elif reason == "stop_loss":
                stop_hit += 1

        if reason == "manual":
            manual_exits += 1

    reason_list = []
    for reason, data in exit_reasons.items():
        reason_list.append({
            "reason": reason,
            "count": data["count"],
            "total_pnl": round(data["pnl"], 2),
            "avg_pnl": round(data["pnl"] / data["count"], 2) if data["count"] else 0,
            "win_rate": round(data["wins"] / data["count"] * 100, 1) if data["count"] else None,
        })
    reason_list.sort(key=lambda x: x["count"], reverse=True)

    avg_capture = round(sum(capture_ratios) / len(capture_ratios), 3) if capture_ratios else None
    median_capture = sorted(capture_ratios)[len(capture_ratios) // 2] if capture_ratios else None
    target_reach_rate = round(target_reached / has_target * 100, 1) if has_target else None

    early_exit_pnls = [float(t.pnl or 0) for t in closed_trades
                       if (t.exit_reason or "manual") not in ("target", "stop_loss") and t.target_price]
    full_exit_pnls = [float(t.pnl or 0) for t in closed_trades
                      if (t.exit_reason or "manual") in ("target",) or not t.target_price]

    graded_exits = [all_grades[t.id] for t in closed_trades if t.id in all_grades and all_grades[t.id].exit_quality]
    grade_map = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
    dimension_scores = None
    if graded_exits:
        exit_vals = [grade_map[g.exit_quality] for g in graded_exits if g.exit_quality in grade_map]
        dimension_scores = {
            "exit_quality_avg": round(sum(exit_vals) / len(exit_vals), 2) if exit_vals else None,
            "graded_count": len(graded_exits),
        }

    return {
        "total_closed": len(closed_trades),
        "exit_reason_breakdown": reason_list,
        "capture_stats": {
            "avg_capture_ratio": avg_capture,
            "median_capture_ratio": round(median_capture, 3) if median_capture is not None else None,
            "target_reach_rate": target_reach_rate,
            "stop_hit_rate": round(stop_hit / has_target * 100, 1) if has_target else None,
            "manual_exit_rate": round(manual_exits / len(closed_trades) * 100, 1) if closed_trades else None,
        },
        "early_exits": early_exits,
        "early_exit_rate": round(len(early_exits) / has_target * 100, 1) if has_target else None,
        "avg_pnl_early_exit": round(sum(early_exit_pnls) / len(early_exit_pnls), 2) if early_exit_pnls else None,
        "avg_pnl_full_exit": round(sum(full_exit_pnls) / len(full_exit_pnls), 2) if full_exit_pnls else None,
        "dimension_scores": dimension_scores,
    }


# ─────────────────────── composite discipline score ───────────────────────

@router.get("/discipline-score")
def composite_discipline_score(
    from_date: Optional[str] = Query(None, description="Start date ISO"),
    to_date: Optional[str] = Query(None, description="End date ISO"),
    db: Session = Depends(get_db),
):
    """Compute a composite discipline score from multiple behavioral signals.

    Components:
    - execution_grade_score: % of A/B grades (0-100)
    - stop_discipline: % of trades with stop_loss set (0-100)
    - plan_adherence: target reach rate + stop hit rate vs manual exits (0-100)
    - journal_consistency: % of trading days with journal entries (0-100)
    - revenge_resistance: inverse of revenge trade rate (0-100)
    Overall is a weighted average of all components.
    """
    start, end = _parse_date_range(from_date, to_date)
    trades_q = _base_trade_query(db, start, end)
    all_trades = trades_q.order_by(Trade.entry_time.asc()).all()

    if not all_trades:
        return {
            "overall_score": None,
            "components": {},
            "grade": None,
            "insights": [],
        }

    trade_ids = [t.id for t in all_trades]
    closed_trades = [t for t in all_trades if t.exit_price is not None]
    all_grades = {g.trade_id: g for g in db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()}
    all_emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    emotion_by_trade: dict[int, list[EmotionLog]] = {}
    for e in all_emotions:
        emotion_by_trade.setdefault(e.trade_id, []).append(e)

    graded = [g for g in all_grades.values() if g.overall_grade]
    grade_map = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
    if graded:
        high_grades = sum(1 for g in graded if g.overall_grade in ("A", "B"))
        execution_grade_score = round(high_grades / len(graded) * 100, 1)
    else:
        execution_grade_score = None

    trades_with_stop = sum(1 for t in all_trades if t.stop_price is not None and float(t.stop_price) > 0)
    stop_discipline = round(trades_with_stop / len(all_trades) * 100, 1) if all_trades else None

    target_reached = 0
    stop_hit = 0
    manual_exits = 0
    has_target_count = 0
    for t in closed_trades:
        if t.target_price:
            has_target_count += 1
            reason = t.exit_reason or "manual"
            if reason == "target":
                target_reached += 1
            elif reason == "stop_loss":
                stop_hit += 1
        reason = t.exit_reason or "manual"
        if reason == "manual":
            manual_exits += 1

    if closed_trades:
        plan_adherence_raw = (target_reached + stop_hit) / len(closed_trades) * 100 if closed_trades else 0
        plan_adherence = round(plan_adherence_raw, 1)
    else:
        plan_adherence = None

    trade_dates = set()
    for t in all_trades:
        if t.entry_time:
            trade_dates.add(t.entry_time.strftime("%Y-%m-%d"))

    journal_dates_q = db.query(DailyJournal.date).filter(DailyJournal.date != None)
    if start:
        journal_dates_q = journal_dates_q.filter(DailyJournal.date >= start.date())
    if end:
        journal_dates_q = journal_dates_q.filter(DailyJournal.date <= end.date())
    journal_dates = {str(d[0]) for d in journal_dates_q.all()}

    if trade_dates:
        journal_consistency = round(len(trade_dates & journal_dates) / len(trade_dates) * 100, 1)
    else:
        journal_consistency = None

    revenge_count = 0
    loss_times = [t.entry_time for t in closed_trades if t.pnl is not None and float(t.pnl) < 0 and t.entry_time]
    for t in all_trades:
        emotion = emotion_by_trade.get(t.id)
        if emotion and any(e.emotion in ("revenge", "fomo") for e in emotion):
            revenge_count += 1
            continue
        if t.entry_time:
            for lt in loss_times:
                if lt < t.entry_time and (t.entry_time - lt).total_seconds() <= 4 * 3600:
                    revenge_count += 1
                    break

    revenge_rate = revenge_count / len(all_trades) * 100 if all_trades else 0
    revenge_resistance = round(max(0, 100 - revenge_rate), 1)

    scores = {}
    weights = {}
    if execution_grade_score is not None:
        scores["execution_grade"] = execution_grade_score
        weights["execution_grade"] = 0.30
    if stop_discipline is not None:
        scores["stop_discipline"] = stop_discipline
        weights["stop_discipline"] = 0.20
    if plan_adherence is not None:
        scores["plan_adherence"] = plan_adherence
        weights["plan_adherence"] = 0.25
    if journal_consistency is not None:
        scores["journal_consistency"] = journal_consistency
        weights["journal_consistency"] = 0.10
    scores["revenge_resistance"] = revenge_resistance
    weights["revenge_resistance"] = 0.15

    if weights:
        total_weight = sum(weights.values())
        overall_score = round(sum(scores[k] * weights[k] for k in scores) / total_weight, 1)
    else:
        overall_score = None

    if overall_score is not None:
        if overall_score >= 85:
            grade = "A"
        elif overall_score >= 70:
            grade = "B"
        elif overall_score >= 55:
            grade = "C"
        elif overall_score >= 40:
            grade = "D"
        else:
            grade = "F"
    else:
        grade = None

    insights: list[dict] = []
    if stop_discipline is not None and stop_discipline < 70:
        insights.append({
            "type": "warning",
            "area": "stop_discipline",
            "message": f"Only {stop_discipline}% of trades have stop losses set. Always define your risk before entering.",
        })
    if plan_adherence is not None and plan_adherence < 50:
        insights.append({
            "type": "warning",
            "area": "plan_adherence",
            "message": f"Plan adherence is {plan_adherence}% — most exits are manual. Consider letting trades reach targets or stops.",
        })
    if revenge_resistance < 70:
        insights.append({
            "type": "warning",
            "area": "revenge_resistance",
            "message": f"Revenge resistance is {revenge_resistance}% — {revenge_count} trades flagged as potential revenge entries.",
        })
    if execution_grade_score is not None and execution_grade_score < 50:
        insights.append({
            "type": "insight",
            "area": "execution_grade",
            "message": f"Execution grades are {execution_grade_score}% A/B. Focus on entry timing and position sizing.",
        })
    if journal_consistency is not None and journal_consistency < 50:
        insights.append({
            "type": "insight",
            "area": "journal_consistency",
            "message": f"Only journaling {journal_consistency}% of trading days. Consistent journaling builds self-awareness.",
        })

    return {
        "overall_score": overall_score,
        "components": scores,
        "grade": grade,
        "insights": insights,
    }
