"""
Lifecycle Analytics Router — emotion aggregation, execution grade analytics,
behavioral analytics, and revenge trade detection.

GET  /api/v1/lifecycle/emotion-summary    — emotion frequency + PnL by emotion
GET  /api/v1/lifecycle/grade-summary      — grade distribution + avg PnL by grade
GET  /api/v1/lifecycle/behavioral          — emotion-grade correlations + discipline score
GET  /api/v1/lifecycle/revenge-trades      — detect revenge trades programmatically
"""

from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.db.database import get_db
from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.trade_timeline import TradeTimeline

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
    trade_ids = [t.id for t in trades_q.all()]

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

    emotion_pnl: dict[str, dict] = {}
    for emotion_type in set(r.emotion for r in rows):
        trade_ids_with_emotion = [
            log.trade_id for log in db.query(EmotionLog.trade_id)
            .filter(EmotionLog.trade_id.in_(trade_ids), EmotionLog.emotion == emotion_type)
            .distinct().all()
        ]
        trades_with = db.query(Trade).filter(
            Trade.id.in_(trade_ids_with_emotion), Trade.exit_price.isnot(None)
        ).all()
        pnls = [float(t.pnl or 0) for t in trades_with]
        wins = [p for p in pnls if p > 0]
        emotion_pnl[emotion_type] = {
            "trade_count": len(trades_with),
            "total_pnl": str(Decimal(str(sum(pnls))).quantize(Decimal("0.01"))),
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
    trade_ids = [t.id for t in trades_q.all()]

    if not trade_ids:
        return {"grade_distribution": {}, "dimension_averages": {}, "grade_pnl": [], "avg_overall": None}

    grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()

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

        trade = next((t for t in trades_q.all() if t.id == g.trade_id), None)
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

    if not all_trades:
        return {"revenge_trades": [], "total_flagged": 0, "avg_pnl_flagged": None, "avg_pnl_unflagged": None}

    trade_ids = [t.id for t in all_trades]
    all_emotions = {e.trade_id: e for e in db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()}

    revenge_trades_list = []
    loss_times = []
    for t in all_trades:
        if t.exit_price is not None and t.pnl is not None and t.pnl < 0:
            loss_times.append(t.entry_time)

    for t in all_trades:
        revenge_emotion = False
        emotion = all_emotions.get(t.id)
        if emotion and emotion.emotion in ("revenge", "fomo"):
            revenge_emotion = True

        within_window = False
        for loss_time in loss_times:
            if loss_time < t.entry_time and (t.entry_time - loss_time).total_seconds() <= hours_window * 3600:
                within_window = True
                break

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

    flagged_pnls = []
    unflagged_pnls = []
    flagged_ids = {r["trade_id"] for r in revenge_trades_list}
    for t in all_trades:
        if t.id in flagged_ids:
            flagged_pnls.append(float(t.pnl or 0))
        else:
            unflagged_pnls.append(float(t.pnl or 0))

    loss_times_sorted = sorted(loss_times)
    for rt in revenge_trades_list:
        trade = next((t for t in all_trades if t.id == rt["trade_id"]), None)
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