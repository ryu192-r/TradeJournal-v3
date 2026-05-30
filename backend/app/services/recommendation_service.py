"""Recommendation engine — turns journal data into actionable trading recommendations."""
from datetime import datetime, timedelta
from decimal import Decimal
from collections import defaultdict
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.utils.calculations import compute_aggregate_kpis
from app.utils.pnl_helpers import get_realized_pnl_events
from app.services.setup_edge_service import get_all_setup_edges
from app.schemas.recommendations import (
    RecommendationDashboardResponse,
    RecommendationSummary,
    TradingRecommendation,
    RecommendationEvidence,
    RecommendationCategory,
    RecommendationSeverity,
    RecommendationActionType,
)
STD_DECIMAL = Decimal("0.01")
GRADE_MAP = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
GRADE_ORDER = ["A", "B", "C", "D", "F"]
MAX_RECOMMENDATIONS = 12
MIN_CLOSED_FOR_SETUP_JUDGEMENT = 5
MIN_CLOSED_FOR_EDGE_PAUSE = 20


def _base_trades(db: Session, user_id: int, start: Optional[datetime], end: Optional[datetime]):
    q = db.query(Trade).filter(Trade.status != "deleted", Trade.user_id == user_id)
    if start:
        q = q.filter(Trade.entry_time >= start)
    if end:
        q = q.filter(Trade.entry_time <= end)
    return q


def _make_rec_id(cat: str, idx: int) -> str:
    return f"{cat}-{idx}"


def _confidence_from_sample(n: int) -> float:
    if n >= 30:
        return 0.9
    if n >= 15:
        return 0.7
    if n >= 5:
        return 0.5
    return 0.3


def get_recommendation_dashboard(
    db: Session,
    user_id: int,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
) -> RecommendationDashboardResponse:
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    if period_start:
        try:
            start = datetime.fromisoformat(period_start)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid period_start: '{period_start}'. Use ISO format (e.g. 2025-01-01).")
    if period_end:
        try:
            end = datetime.fromisoformat(period_end).replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid period_end: '{period_end}'. Use ISO format (e.g. 2025-01-31).")

    trades_q = _base_trades(db, user_id, start, end)
    all_trades = trades_q.order_by(Trade.entry_time.asc()).all()
    closed_trades = [t for t in all_trades if t.exit_price is not None and t.pnl is not None]
    open_trades = [t for t in all_trades if t.exit_price is None]

    recommendations: list[TradingRecommendation] = []
    trade_ids = [t.id for t in all_trades]
    closed_ids = [t.id for t in closed_trades]

    # Fetch partial-exit PnL once and pass down
    realized_events = get_realized_pnl_events(db, user_id, start, end)

    # --- 1. Setup performance recommendations ---
    recs = _setup_recommendations(db, user_id, closed_trades, all_trades, start, end, realized_events)
    recommendations.extend(recs)

    # --- 2. Psychology/emotion recommendations ---
    recs = _emotion_recommendations(db, closed_trades, trade_ids)
    recommendations.extend(recs)

    # --- 3. Execution grade recommendations ---
    recs = _execution_recommendations(db, closed_trades, trade_ids)
    recommendations.extend(recs)

    # --- 4. Overtrading recommendations ---
    recs = _overtrading_recommendations(all_trades, closed_trades)
    recommendations.extend(recs)

    # --- 5. Loss cluster / streak recommendations ---
    recs = _streak_recommendations(closed_trades)
    recommendations.extend(recs)

    # --- 6. Timing pattern recommendations ---
    recs = _timing_recommendations(closed_trades)
    recommendations.extend(recs)

    # --- 7. Risk recommendations ---
    recs = _risk_recommendations(closed_trades, all_trades)
    recommendations.extend(recs)

    # --- 8. Continue behavior recommendations ---
    recs = _continue_recommendations(closed_trades, all_trades)
    recommendations.extend(recs)

    # Sort by priority_score descending, cap at MAX_RECOMMENDATIONS
    recommendations.sort(key=lambda r: r.priority_score, reverse=True)
    recommendations = recommendations[:MAX_RECOMMENDATIONS]

    # Build summary
    summary = _build_summary(recommendations, closed_trades)

    period_label = ""
    if start and end:
        period_label = f"{start.date().isoformat()}/{end.date().isoformat()}"

    return RecommendationDashboardResponse(
        generated_at=datetime.utcnow().isoformat(),
        period_start=start.isoformat() if start else None,
        period_end=end.isoformat() if end else None,
        total_trades=len(all_trades),
        closed_trades=len(closed_trades),
        recommendations=recommendations,
        summary=summary,
    )


def get_recommendation_summary(
    db: Session,
    user_id: int,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
) -> RecommendationSummary:
    dashboard = get_recommendation_dashboard(db, user_id, period_start, period_end)
    summary = dashboard.summary
    # Add top 3 if not already present
    top3 = dashboard.recommendations[:3]
    for rec in top3:
        if rec.action_type in ("increase_focus", "continue_behavior") and rec.title not in summary.focus_this_week:
            if len(summary.focus_this_week) < 3:
                summary.focus_this_week.append(rec.title)
        elif rec.action_type in ("reduce_size", "pause_setup") and rec.title not in summary.avoid_this_week:
            if len(summary.avoid_this_week) < 3:
                summary.avoid_this_week.append(rec.title)
    return summary


# ────────── Setup recommendations ──────────


def _setup_recommendations(
    db: Session,
    user_id: int,
    closed_trades: list[Trade],
    all_trades: list[Trade],
    start: Optional[datetime],
    end: Optional[datetime],
    realized_events: list | None = None,
) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if not closed_trades:
        return recs

    edge_map: dict[str, object] = {}
    try:
        edge_data = get_all_setup_edges(db, user_id)
        edge_map = {m.setup_name: m for m in edge_data.setups}
    except Exception:
        edge_map = {}

    # Group by setup
    setup_trades: dict[str, list[Trade]] = defaultdict(list)
    for t in all_trades:
        s = t.setup or "Uncategorised"
        setup_trades[s].append(t)

    setup_closed: dict[str, list[Trade]] = defaultdict(list)
    for t in closed_trades:
        s = t.setup or "Uncategorised"
        setup_closed[s].append(t)

    for setup_name, trades in setup_closed.items():
        n = len(trades)
        all_setup_trades = setup_trades.get(setup_name, [])
        total_n = len(all_setup_trades)

        if n < 1:
            continue

        pnls = [t.pnl for t in trades]
        total_pnl = sum(pnls, Decimal("0"))
        avg_pnl = total_pnl / n if n else Decimal("0")
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        win_rate = len(wins) / n if n else 0
        r_vals = [t.r_multiple for t in trades if t.r_multiple is not None]
        avg_r = sum(r_vals, Decimal("0")) / len(r_vals) if r_vals else Decimal("0")
        kpis = compute_aggregate_kpis(trades)

        # Include partial exit PnL for open trades of this setup
        partial_events = [ev for ev in (realized_events or []) if ev.source == "partial_exit" and (ev.setup or "Uncategorised") == setup_name]
        if partial_events:
            pe_pnl = sum(ev.pnl for ev in partial_events)
            total_pnl += pe_pnl

        confidence = _confidence_from_sample(n)
        gap = n - MIN_CLOSED_FOR_SETUP_JUDGEMENT

        if n <= 4 and n >= 1:
            # Low sample warning
            priority = max(15, 35 - gap * 5)
            recs.append(TradingRecommendation(
                id=_make_rec_id("setup-low-sample", len(recs)),
                category=RecommendationCategory.setup,
                severity=RecommendationSeverity.info,
                action_type=RecommendationActionType.journal_prompt,
                title=f"Sample size too small: {setup_name}",
                summary=f"Only {n} closed trade(s) for {setup_name}. Not enough to judge edge.",
                why=f"Statistical significance requires at least 5 closed trades. Current sample: {n}.",
                suggested_action=f"Keep trading {setup_name} normally. Track performance as sample grows.",
                confidence=0.3,
                evidence=[
                    RecommendationEvidence(metric="closed_count", value=n, benchmark=5, sample_size=n),
                ],
                related_setup=setup_name,
                priority_score=priority,
            ))

        elif n >= 5 and avg_pnl > 0 and (avg_r > Decimal("0.3") if r_vals else avg_pnl > 0) and win_rate >= 0.45:
            # Positive edge — focus more
            score = min(95, 60 + int(avg_r * 10) + int(win_rate * 20))
            expectancy_str = str(round(float(kpis["expectancy"] or 0), 2))
            recs.append(TradingRecommendation(
                id=_make_rec_id("setup-focus", len(recs)),
                category=RecommendationCategory.setup,
                severity=RecommendationSeverity.positive,
                action_type=RecommendationActionType.increase_focus,
                title=f"Focus more on {setup_name}",
                summary=f"{setup_name} has positive expectancy of ₹{expectancy_str} with {round(win_rate * 100, 1)}% win rate across {n} trades.",
                why=f"Avg R {round(float(avg_r), 2)} and win rate {round(win_rate * 100, 1)}% indicate a reliable edge.",
                suggested_action=f"Increase allocation to {setup_name}. Track if edge holds over next 20 trades.",
                confidence=confidence,
                evidence=[
                    RecommendationEvidence(metric="total_pnl", value=str(round(float(total_pnl), 2)), sample_size=n),
                    RecommendationEvidence(metric="win_rate", value=round(win_rate * 100, 1), benchmark=45, sample_size=n),
                    RecommendationEvidence(metric="avg_r", value=round(float(avg_r), 2), benchmark=0.3, sample_size=n),
                    RecommendationEvidence(metric="expectancy", value=expectancy_str, sample_size=n),
                ],
                related_setup=setup_name,
                priority_score=score,
            ))

        elif n >= 5 and total_pnl <= 0 and (avg_r < 0 if r_vals else avg_pnl <= 0 and win_rate < 0.45):
            # Negative edge — reduce/pause
            score = min(90, 60 + int(abs(float(avg_r)) * 15) + int(max(0, 0.5 - win_rate) * 30))
            recs.append(TradingRecommendation(
                id=_make_rec_id("setup-pause", len(recs)),
                category=RecommendationCategory.setup,
                severity=RecommendationSeverity.warning,
                action_type=RecommendationActionType.pause_setup,
                title=f"Reduce or pause {setup_name}",
                summary=f"{setup_name} is negative expectancy with avg R {round(float(avg_r), 2)} across {n} trades.",
                why=f"Total P&L ₹{round(float(total_pnl), 2)} is negative with avg R {round(float(avg_r), 2)}. Edge not confirmed.",
                suggested_action=f"Pause trading {setup_name}. Review past losses to identify what went wrong. Demo trade before going live.",
                confidence=confidence,
                evidence=[
                    RecommendationEvidence(metric="total_pnl", value=str(round(float(total_pnl), 2)), benchmark=">0", sample_size=n),
                    RecommendationEvidence(metric="avg_r", value=round(float(avg_r), 2), benchmark=0, sample_size=n),
                    RecommendationEvidence(metric="win_rate", value=round(win_rate * 100, 1), sample_size=n),
                ],
                related_setup=setup_name,
                priority_score=score,
            ))

        edge_metrics = edge_map.get(setup_name)
        if (
            edge_metrics
            and edge_metrics.sample_size >= MIN_CLOSED_FOR_EDGE_PAUSE
            and edge_metrics.expectancy_r is not None
            and edge_metrics.expectancy_r < 0
            and not any(
                r.related_setup == setup_name and r.action_type == RecommendationActionType.pause_setup
                for r in recs
            )
        ):
            score = min(95, 70 + int(abs(edge_metrics.expectancy_r) * 20))
            recs.append(TradingRecommendation(
                id=_make_rec_id("setup-edge-pause", len(recs)),
                category=RecommendationCategory.setup,
                severity=RecommendationSeverity.warning,
                action_type=RecommendationActionType.pause_setup,
                title=f"Pause {setup_name}",
                summary=f"{setup_name} expectancy {edge_metrics.expectancy_r:.2f}R across {edge_metrics.sample_size} trades.",
                why=f"Negative R expectancy ({edge_metrics.expectancy_r:.2f}R) with {edge_metrics.sample_size} closed trades. Edge not confirmed.",
                suggested_action=f"Pause {setup_name}. Review losing trades and re-demo before live size.",
                confidence=_confidence_from_sample(edge_metrics.sample_size),
                evidence=[
                    RecommendationEvidence(metric="expectancy_r", value=edge_metrics.expectancy_r, benchmark=0, sample_size=edge_metrics.sample_size),
                    RecommendationEvidence(metric="avg_r", value=edge_metrics.avg_r, sample_size=edge_metrics.sample_size),
                    RecommendationEvidence(metric="status", value=edge_metrics.status.value, sample_size=edge_metrics.sample_size),
                ],
                related_setup=setup_name,
                priority_score=score,
            ))

    # Backstop: still emit pause rec for historically negative setups
    # even when they have no closed trades in this selected period.
    for edge_metrics in edge_map.values():
        setup_name = edge_metrics.setup_name
        if (
            edge_metrics.sample_size >= MIN_CLOSED_FOR_EDGE_PAUSE
            and edge_metrics.expectancy_r is not None
            and edge_metrics.expectancy_r < 0
            and not any(
                r.related_setup == setup_name and r.action_type == RecommendationActionType.pause_setup
                for r in recs
            )
        ):
            score = min(95, 70 + int(abs(edge_metrics.expectancy_r) * 20))
            recs.append(TradingRecommendation(
                id=_make_rec_id("setup-edge-pause", len(recs)),
                category=RecommendationCategory.setup,
                severity=RecommendationSeverity.warning,
                action_type=RecommendationActionType.pause_setup,
                title=f"Pause {setup_name}",
                summary=f"{setup_name} expectancy {edge_metrics.expectancy_r:.2f}R across {edge_metrics.sample_size} trades.",
                why=f"Negative R expectancy ({edge_metrics.expectancy_r:.2f}R) with {edge_metrics.sample_size} closed trades. Edge not confirmed.",
                suggested_action=f"Pause {setup_name}. Review losing trades and re-demo before live size.",
                confidence=_confidence_from_sample(edge_metrics.sample_size),
                evidence=[
                    RecommendationEvidence(metric="expectancy_r", value=edge_metrics.expectancy_r, benchmark=0, sample_size=edge_metrics.sample_size),
                    RecommendationEvidence(metric="avg_r", value=edge_metrics.avg_r, sample_size=edge_metrics.sample_size),
                    RecommendationEvidence(metric="status", value=edge_metrics.status.value, sample_size=edge_metrics.sample_size),
                ],
                related_setup=setup_name,
                priority_score=score,
            ))

    return recs


# ────────── Emotion recommendations ──────────


def _emotion_recommendations(
    db: Session, closed_trades: list[Trade], trade_ids: list[int]
) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if not trade_ids:
        return recs

    all_emotions = db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all()
    if not all_emotions:
        return recs

    emotion_by_trade: dict[int, list[EmotionLog]] = defaultdict(list)
    for e in all_emotions:
        emotion_by_trade[e.trade_id].append(e)

    emotion_pnl: dict[str, dict] = defaultdict(lambda: {"count": 0, "wins": 0, "total_pnl": Decimal("0")})
    for t in closed_trades:
        if t.pnl is None:
            continue
        for e in emotion_by_trade.get(t.id, []):
            emotion_pnl[e.emotion]["count"] += 1
            emotion_pnl[e.emotion]["total_pnl"] += t.pnl
            if t.pnl > 0:
                emotion_pnl[e.emotion]["wins"] += 1

    for emotion, data in emotion_pnl.items():
        if data["count"] < 3:
            continue
        win_rate = data["wins"] / data["count"] if data["count"] else 0
        avg_pnl = data["total_pnl"] / data["count"] if data["count"] else Decimal("0")

        # Psychology warning
        if emotion in ("revenge", "fomo") and (avg_pnl < 0 or win_rate < 0.4):
            score = min(85, 50 + int(abs(float(avg_pnl)) / 10) + int((0.5 - win_rate) * 30))
            recs.append(TradingRecommendation(
                id=_make_rec_id("psych-warning", len(recs)),
                category=RecommendationCategory.psychology,
                severity=RecommendationSeverity.warning,
                action_type=RecommendationActionType.improve_rule,
                title=f"Watch {emotion} pattern",
                summary=f"Trading while feeling '{emotion}' correlates with poor outcomes: avg P&L ₹{round(float(avg_pnl), 2)}, win rate {round(win_rate * 100, 1)}%.",
                why=f"{emotion.capitalize()} appears in {data['count']} closed trades and correlates with negative performance.",
                suggested_action=f"When feeling {emotion}, step away for 15 minutes. Journal the feeling before entering. Use a rule: 'No trade when feeling {emotion}.'",
                confidence=_confidence_from_sample(data["count"]),
                evidence=[
                    RecommendationEvidence(metric="avg_pnl", value=round(float(avg_pnl), 2), sample_size=data["count"]),
                    RecommendationEvidence(metric="win_rate", value=round(win_rate * 100, 1), benchmark=40, sample_size=data["count"]),
                ],
                related_setup=None,
                priority_score=score,
            ))

        # Discipline insight for positive emotions
        if emotion in ("calm", "disciplined") and win_rate >= 0.6 and data["count"] >= 3:
            recs.append(TradingRecommendation(
                id=_make_rec_id("positive-emotion", len(recs)),
                category=RecommendationCategory.psychology,
                severity=RecommendationSeverity.positive,
                action_type=RecommendationActionType.continue_behavior,
                title=f"Best state: {emotion}",
                summary=f"Trading while {emotion} yields {round(win_rate * 100, 1)}% win rate across {data['count']} trades.",
                why=f"{emotion.capitalize()} state correlates with strong execution. This is your peak performance zone.",
                suggested_action=f"Aim to recreate the conditions that lead to this mental state before trading.",
                confidence=_confidence_from_sample(data["count"]),
                evidence=[
                    RecommendationEvidence(metric="win_rate", value=round(win_rate * 100, 1), benchmark=60, sample_size=data["count"]),
                ],
                priority_score=max(50, int(win_rate * 60)),
            ))

    return recs


# ────────── Execution grade recommendations ──────────


def _execution_recommendations(
    db: Session, closed_trades: list[Trade], trade_ids: list[int]
) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if not trade_ids:
        return recs

    grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()
    if not grades:
        return recs

    dim_vals: dict[str, list[str]] = {
        "entry_quality": [], "sizing_quality": [], "stop_quality": [],
        "patience": [], "rule_adherence": [], "exit_quality": [],
    }
    for g in grades:
        for dim in dim_vals:
            val = getattr(g, dim, None)
            if val and val in GRADE_MAP:
                dim_vals[dim].append(val)

    dim_labels = {
        "entry_quality": "Entry quality",
        "sizing_quality": "Position sizing",
        "stop_quality": "Stop placement",
        "patience": "Patience",
        "rule_adherence": "Rule adherence",
        "exit_quality": "Exit quality",
    }

    dim_avgs: dict[str, float] = {}
    for dim, vals in dim_vals.items():
        if vals:
            numeric = [GRADE_MAP[v] for v in vals if v in GRADE_MAP]
            dim_avgs[dim] = sum(numeric) / len(numeric)

    if not dim_avgs:
        return recs

    # Find worst dimension
    worst_dim = min(dim_avgs, key=dim_avgs.get)
    worst_score = dim_avgs[worst_dim]
    count_dim = len(dim_vals[worst_dim])

    if worst_score < 3.5 and count_dim >= 3:
        label = dim_labels.get(worst_dim, worst_dim.replace("_", " "))
        suggestion_map = {
            "entry_quality": "Set specific entry criteria (time, price, pattern). Use limit orders.",
            "sizing_quality": "Standardize position sizing with a fixed % risk per trade.",
            "stop_quality": "Always define stop loss before entry. Use ATR-based stops.",
            "patience": "Wait for your setup. Do not chase price. Set an alert and wait.",
            "rule_adherence": "Write your rules on a sticky note. Check before each trade.",
            "exit_quality": "Let runners run. Trail stops after target 1. Let winners breathe.",
        }
        suggestion = suggestion_map.get(worst_dim, f"Focus on improving {label}.")

        score = min(80, 50 + int((3.5 - worst_score) * 20))
        recs.append(TradingRecommendation(
            id=_make_rec_id("execution-weakness", len(recs)),
            category=RecommendationCategory.execution,
            severity=RecommendationSeverity.warning if worst_score < 2.5 else RecommendationSeverity.info,
            action_type=RecommendationActionType.improve_rule,
            title=f"Improve {label}",
            summary=f"{label} is the lowest execution dimension at {round(worst_score, 1)}/5 across {count_dim} graded trades.",
            why=f"Avg {label} score {round(worst_score, 1)}/5 is below the 3.5 threshold for competence.",
            suggested_action=suggestion,
            confidence=_confidence_from_sample(count_dim),
            evidence=[
                RecommendationEvidence(metric="avg_score", value=round(worst_score, 1), benchmark=3.5, sample_size=count_dim),
            ],
            priority_score=score,
        ))

    return recs


# ────────── Overtrading recommendations ──────────


def _overtrading_recommendations(
    all_trades: list[Trade], closed_trades: list[Trade]
) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if not all_trades:
        return recs

    # Group by day
    daily: dict[str, list[Trade]] = defaultdict(list)
    for t in all_trades:
        if t.entry_time:
            day_key = t.entry_time.strftime("%Y-%m-%d")
            daily[day_key].append(t)

    heavy_days = []
    for day_key, day_trades in daily.items():
        if len(day_trades) >= 4:
            closed_on_day = [t for t in day_trades if t.pnl is not None]
            if closed_on_day:
                total_pnl = sum(t.pnl for t in closed_on_day)
                avg_pnl = total_pnl / len(closed_on_day)
                heavy_days.append({"date": day_key, "count": len(day_trades), "avg_pnl": avg_pnl})

    if heavy_days:
        neg_days = [d for d in heavy_days if d["avg_pnl"] < 0]
        if neg_days and len(neg_days) >= 2:
            worst = min(neg_days, key=lambda d: d["avg_pnl"])
            score = min(75, 40 + len(neg_days) * 10)
            recs.append(TradingRecommendation(
                id=_make_rec_id("overtrading", len(recs)),
                category=RecommendationCategory.psychology,
                severity=RecommendationSeverity.warning,
                action_type=RecommendationActionType.reduce_size,
                title="Reduce on high-volume days",
                summary=f"Heavy days ({len(heavy_days)} with 4+ trades) show negative avg P&L. Quality drops with quantity.",
                why=f"On {worst['date']}, {worst['count']} trades averaged ₹{round(float(worst['avg_pnl']), 2)} — volume eroded edge.",
                suggested_action="Set a daily trade limit (e.g. 3 trades). After 3rd trade, step away for 30 min before considering more.",
                confidence=_confidence_from_sample(len(heavy_days)),
                evidence=[
                    RecommendationEvidence(metric="heavy_days", value=len(heavy_days), sample_size=len(heavy_days)),
                    RecommendationEvidence(metric="neg_pnl_days", value=len(neg_days)),
                ],
                priority_score=score,
            ))

    return recs


# ────────── Streak recommendations ──────────


def _streak_recommendations(closed_trades: list[Trade]) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if len(closed_trades) < 3:
        return recs

    sorted_trades = sorted(closed_trades, key=lambda t: t.entry_time or datetime.min)
    current_streak = 0
    max_loss_streak = 0
    seq: list[Trade] = []
    for t in sorted_trades:
        if t.pnl is not None and t.pnl < 0:
            current_streak += 1
            if current_streak > max_loss_streak:
                max_loss_streak = current_streak
                seq.append(t)
        else:
            current_streak = 0

    if max_loss_streak >= 3:
        score = min(80, 40 + max_loss_streak * 10)
        recs.append(TradingRecommendation(
            id=_make_rec_id("loss-streak", len(recs)),
            category=RecommendationCategory.psychology,
            severity=RecommendationSeverity.warning,
            action_type=RecommendationActionType.reduce_size,
            title=f"Loss streak: {max_loss_streak} consecutive",
            summary=f"Max {max_loss_streak} consecutive losing trades. Consider a size reduction rule.",
            why=f"Consecutive losses of {max_loss_streak} indicate tilt risk. The 3-loss rule is a proven risk control.",
            suggested_action=f"After {max_loss_streak - 1} consecutive losses, reduce size by 50%. After {max_loss_streak}, stop for the day.",
            confidence=_confidence_from_sample(len(closed_trades)),
            evidence=[
                RecommendationEvidence(metric="max_consecutive_losses", value=max_loss_streak, benchmark=3, sample_size=len(closed_trades)),
            ],
            priority_score=score,
        ))

    return recs


# ────────── Timing recommendations ──────────


def _timing_recommendations(closed_trades: list[Trade]) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if len(closed_trades) < 5:
        return recs

    # Time of day analysis
    tod: dict[int, dict] = defaultdict(lambda: {"count": 0, "pnl": Decimal("0")})
    for t in closed_trades:
        if t.entry_time and t.pnl is not None:
            hour = t.entry_time.hour
            tod[hour]["count"] += 1
            tod[hour]["pnl"] += t.pnl

    if tod:
        best_hour = max(tod.items(), key=lambda x: x[1]["pnl"] / x[1]["count"] if x[1]["count"] else Decimal("-inf"))
        worst_hour = min(tod.items(), key=lambda x: x[1]["pnl"] / x[1]["count"] if x[1]["count"] else Decimal("inf"))

        if worst_hour[1]["count"] >= 3 and worst_hour[1]["pnl"] < 0:
            avg_worst = worst_hour[1]["pnl"] / worst_hour[1]["count"]
            score = min(65, 30 + int(abs(float(avg_worst)) / 5))
            recs.append(TradingRecommendation(
                id=_make_rec_id("timing-warning", len(recs)),
                category=RecommendationCategory.timing,
                severity=RecommendationSeverity.info,
                action_type=RecommendationActionType.journal_prompt,
                title=f"Avoid {worst_hour[0]:02d}:00 slot",
                summary=f"Trades entered around {worst_hour[0]:02d}:00 average ₹{round(float(avg_worst), 2)} across {worst_hour[1]['count']} trades.",
                why=f"The {worst_hour[0]:02d}:00 hour consistently underperforms. This may be a market transition period.",
                suggested_action=f"Review trades in the {worst_hour[0]:02d}:00 hour. Consider waiting for clearer signals during this period.",
                confidence=_confidence_from_sample(worst_hour[1]["count"]),
                evidence=[
                    RecommendationEvidence(metric="avg_pnl", value=round(float(avg_worst), 2), sample_size=worst_hour[1]["count"]),
                    RecommendationEvidence(metric="trade_count", value=worst_hour[1]["count"]),
                ],
                priority_score=score,
            ))

    return recs


# ────────── Risk recommendations ──────────


def _risk_recommendations(
    closed_trades: list[Trade], all_trades: list[Trade]
) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if not closed_trades:
        return recs

    # Stop loss discipline
    with_stop = sum(1 for t in all_trades if t.stop_price and t.stop_price > 0)
    stop_rate = with_stop / len(all_trades) if all_trades else 0

    if stop_rate < 0.5 and len(all_trades) >= 5:
        score = min(85, 50 + int((0.5 - stop_rate) * 60))
        recs.append(TradingRecommendation(
            id=_make_rec_id("risk-stop", len(recs)),
            category=RecommendationCategory.risk,
            severity=RecommendationSeverity.warning,
            action_type=RecommendationActionType.improve_rule,
            title="Define stops before entry",
            summary=f"Only {round(stop_rate * 100, 1)}% of trades have a stop loss defined.",
            why=f"Trades without stops expose you to unlimited downside. Missing on {100 - round(stop_rate * 100, 1)}% of trades.",
            suggested_action="Add a hard rule: no entry without a stop loss. Use ATR-based stops for new setups.",
            confidence=_confidence_from_sample(len(all_trades)),
            evidence=[
                RecommendationEvidence(metric="stop_discipline", value=round(stop_rate * 100, 1), benchmark=80, sample_size=len(all_trades)),
            ],
            priority_score=score,
        ))

    # Large losses (2x+ average loss)
    losers = [t for t in closed_trades if t.pnl and t.pnl < 0]
    if len(losers) >= 5:
        loser_pnls = [t.pnl or Decimal("0") for t in losers]
        avg_loss = sum(loser_pnls) / len(losers)
        large_losses = [t for t in losers if t.pnl and t.pnl < avg_loss * 2]
        if len(large_losses) >= 2:
            pct_large = len(large_losses) / len(losers) * 100
            score = min(80, 40 + int(pct_large))


            recs.append(TradingRecommendation(
                id=_make_rec_id("risk-large-losses", len(recs)),
                category=RecommendationCategory.risk,
                severity=RecommendationSeverity.warning if pct_large > 20 else RecommendationSeverity.info,
                action_type=RecommendationActionType.reduce_size,
                title="Large losses exceed average",
                summary=f"{len(large_losses)} of {len(losers)} losses ({round(pct_large, 1)}%) are more than 2x the average loss.",
                why=f"Large losses suggest position size or stop placement issues. When losses exceed 2x avg, edge erosion accelerates.",
                suggested_action="Reduce position size. Ensure each loss is within 1R. Review large-loss trades for pattern.",
                confidence=_confidence_from_sample(len(losers)),
                evidence=[
                    RecommendationEvidence(metric="large_loss_pct", value=round(pct_large, 1), benchmark=20, sample_size=len(losers)),
                ],
                priority_score=score,
            ))

    return recs


# ────────── Continue behavior recommendations ──────────


def _continue_recommendations(
    closed_trades: list[Trade], all_trades: list[Trade]
) -> list[TradingRecommendation]:
    recs: list[TradingRecommendation] = []
    if len(closed_trades) < 10:
        return recs

    kpis = compute_aggregate_kpis(closed_trades)
    win_rate = kpis.get("win_rate")
    net_pnl = kpis.get("net_pnl")
    profit_factor = kpis.get("profit_factor")
    avg_r = kpis.get("avg_r")

    if (
        win_rate is not None and win_rate >= 55
        and net_pnl is not None and net_pnl > 0
        and profit_factor is not None and profit_factor >= 1.5
        and avg_r is not None and avg_r > 0.3
    ):
        recs.append(TradingRecommendation(
            id=_make_rec_id("continue-behavior", len(recs)),
            category=RecommendationCategory.execution,
            severity=RecommendationSeverity.positive,
            action_type=RecommendationActionType.continue_behavior,
            title="Consistent edge confirmed",
            summary=f"Overall win rate {round(win_rate, 1)}%, profit factor {round(profit_factor, 2)}, avg R {round(avg_r, 2)} across {len(closed_trades)} trades.",
            why="All key metrics are positive and above threshold. Your trading process is working.",
            suggested_action="Keep following your process. Focus on consistency. Small refinements > big changes.",
            confidence=0.8,
            evidence=[
                RecommendationEvidence(metric="win_rate", value=round(win_rate, 1), benchmark=55, sample_size=len(closed_trades)),
                RecommendationEvidence(metric="profit_factor", value=round(profit_factor, 2), benchmark=1.5, sample_size=len(closed_trades)),
                RecommendationEvidence(metric="avg_r", value=round(avg_r, 2), benchmark=0.3, sample_size=len(closed_trades)),
            ],
            priority_score=60,
        ))

    return recs


# ────────── Summary builder ──────────


def _build_summary(
    recommendations: list[TradingRecommendation],
    closed_trades: list[Trade],
) -> RecommendationSummary:
    strengths: list[str] = []
    risks: list[str] = []
    focus: list[str] = []
    avoid: list[str] = []

    for rec in recommendations:
        if rec.action_type in ("continue_behavior",):
            strengths.append(rec.title)
        if rec.action_type in ("increase_focus",):
            focus.append(rec.title)
        if rec.action_type in ("pause_setup", "reduce_size", "improve_rule"):
            avoid.append(rec.title)
        if rec.severity in ("warning", "critical"):
            risks.append(rec.title)

    # Deduplicate
    strengths = list(dict.fromkeys(strengths))
    risks = list(dict.fromkeys(risks))
    focus = list(dict.fromkeys(focus))
    avoid = list(dict.fromkeys(avoid))

    if not closed_trades:
        strengths.append("Build consistency through journaling")
        risks.append("No closed trade data yet — avoid drawing conclusions")
        focus.append("Trade your plan and close at least 5 trades for meaningful feedback")
        avoid.append("Do not overtrade to rush sample size")

    return RecommendationSummary(
        strengths=strengths[:5],
        risks=risks[:5],
        focus_this_week=focus[:3],
        avoid_this_week=avoid[:3],
    )
