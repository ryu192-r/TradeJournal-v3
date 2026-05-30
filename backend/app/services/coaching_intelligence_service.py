"""Coaching Intelligence Service — deterministic adaptive coaching engine.

Read-only, user-scoped, no DB mutation. Reuses recommendation_service where possible."""

from datetime import datetime, timedelta, date
from decimal import Decimal
from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session

from app.models.trade import Trade
from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.daily_journal import DailyJournal
from app.models.partial_exit import PartialExit
from app.utils.calculations import compute_aggregate_kpis
from app.services.recommendation_service import (
    get_recommendation_dashboard,
    _confidence_from_sample,
    STD_DECIMAL,
    GRADE_MAP,
)
from app.schemas.coaching_intelligence import (
    CoachingPriority,
    SetupConfidenceScore,
    BehavioralDriftSignal,
    WeeklyCoachingPlan,
    TradeReviewPrompt,
    CoachingIntelligenceDashboard,
)

GRADE_ORDER_MAP = {"A": 5, "B": 4, "C": 3, "D": 2, "F": 1}
GRADE_LABELS = {"entry_quality", "sizing_quality", "stop_quality", "patience", "rule_adherence", "exit_quality", "overall_grade"}
MIN_CLOSED_FOR_JUDGEMENT = 5
MIN_SAMPLE_FOR_DRIFT = 5


def _base_trades(db: Session, user_id: int, start: Optional[datetime], end: Optional[datetime]):
    q = db.query(Trade).filter(Trade.status != "deleted", Trade.user_id == user_id)
    if start:
        q = q.filter(Trade.entry_time >= start)
    if end:
        q = q.filter(Trade.entry_time <= end)
    return q


def _week_boundary(d: Optional[date] = None) -> tuple[date, date]:
    """Return (monday, friday) for the week containing d."""
    if d is None:
        d = date.today()
    mon = d - timedelta(days=d.weekday())
    fri = mon + timedelta(days=4)
    return mon, fri


def _count_journal_days(db: Session, user_id: int, start: datetime, end: datetime) -> set[date]:
    rows = db.query(DailyJournal.date).filter(
        DailyJournal.user_id == user_id,
        DailyJournal.date >= start.date(),
        DailyJournal.date <= end.date(),
    ).all()
    return {r[0] for r in rows}


def _grade_numeric(grade_str: Optional[str]) -> Optional[float]:
    if grade_str and grade_str in GRADE_ORDER_MAP:
        return float(GRADE_ORDER_MAP[grade_str])
    return None


# ─── Setup confidence scoring ───────────────────────────────────


def get_setup_confidence_scores(
    db: Session,
    user_id: int,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
) -> list[SetupConfidenceScore]:
    trades = _base_trades(db, user_id, period_start, period_end).all()
    closed = [t for t in trades if t.exit_price is not None and t.pnl is not None]
    if not closed:
        return []

    setup_trades: dict[str, list[Trade]] = defaultdict(list)
    for t in closed:
        s = t.setup or "Uncategorised"
        setup_trades[s].append(t)

    # Load execution grades for stop discipline check
    trade_ids = [t.id for t in closed]
    all_grades = {g.trade_id: g for g in db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all()}

    # Load partial exits for all trades
    all_partials = db.query(PartialExit).filter(
        PartialExit.trade_id.in_(trade_ids),
        PartialExit.realized_pnl.isnot(None),
    ).all()
    partial_pnl_by_trade: dict[int, Decimal] = defaultdict(Decimal)
    for pe in all_partials:
        partial_pnl_by_trade[pe.trade_id] += pe.realized_pnl or Decimal("0")

    results: list[SetupConfidenceScore] = []
    for setup_name, tlist in setup_trades.items():
        n = len(tlist)
        if n < 1:
            continue

        pnls = [t.pnl for t in tlist if t.pnl is not None]
        if not pnls:
            continue
        gross_pnl = sum(pnls, Decimal("0"))
        # Additional partial exit PnL for open trades with same setup
        for t in tlist:
            if t.exit_price is None:
                gross_pnl += partial_pnl_by_trade.get(t.id, Decimal("0"))

        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p < 0]
        win_rate = len(wins) / n if n else 0
        r_vals = [t.r_multiple for t in tlist if t.r_multiple is not None]
        avg_r = float(sum(r_vals) / len(r_vals)) if r_vals else 0.0

        kpis = compute_aggregate_kpis(tlist)
        profit_factor = kpis.get("profit_factor")

        # Consistency: std dev of PnL across trades (lower = more consistent)
        # Use coefficient of variation
        avg_pnl = float(gross_pnl) / n if n else 0
        consistency_score = 50.0  # neutral default
        if avg_pnl != 0 and n >= 3:
            variance = sum((float(p) - avg_pnl) ** 2 for p in pnls) / n
            std = variance ** 0.5
            cv = std / abs(avg_pnl) if avg_pnl else 999
            consistency_score = max(0, 100 - min(cv * 10, 100))

        # Stop discipline for this setup
        grades_for_setup = [all_grades[t.id] for t in tlist if t.id in all_grades and all_grades[t.id].stop_quality]
        stop_discipline = 0.0
        if grades_for_setup:
            stop_vals = [GRADE_ORDER_MAP.get(g.stop_quality, 0) for g in grades_for_setup if g.stop_quality and g.stop_quality in GRADE_ORDER_MAP]
            if stop_vals:
                stop_discipline = sum(stop_vals) / len(stop_vals) * 20  # 0-100

        # ─── Scoring ───
        # sample_score 0-25
        if n >= 30:
            sample_score = 25
        elif n >= 15:
            sample_score = 20
        elif n >= 10:
            sample_score = 15
        elif n >= MIN_CLOSED_FOR_JUDGEMENT:
            sample_score = 10
        else:
            sample_score = max(0, n * 2)

        # expectancy_score 0-30
        if avg_r > 0 and win_rate > 0:
            expectancy_score = min(30, int(avg_r * 8 + win_rate * 15))
        else:
            expectancy_score = 0

        # consistency_score 0-20
        cons_score_dim = min(20, int(consistency_score / 5))

        # risk_score 0-15
        risk_score_dim = min(15, int(stop_discipline / 6.67))

        # recency_score 0-10
        recency_score = 5  # neutral baseline
        recent_5 = [t for t in tlist[-5:] if t.pnl is not None]
        if recent_5:
            recent_wins = [t for t in recent_5 if t.pnl and t.pnl > 0]
            recent_win_rate = len(recent_wins) / len(recent_5)
            recency_score = min(10, int(recent_win_rate * 10))

        total_score = sample_score + expectancy_score + cons_score_dim + risk_score_dim + recency_score

        # ─── Overrides ───
        notes = None
        if n < MIN_CLOSED_FOR_JUDGEMENT:
            total_score = min(total_score, 49)
            notes = f"Only {n} closed trade(s). Sample too small for high confidence."
        if avg_r <= 0 and n >= MIN_CLOSED_FOR_JUDGEMENT:
            total_score = min(total_score, 49)
            notes = "Negative average R-multiple. Edge not confirmed."
        if profit_factor is not None and profit_factor < 1.0:
            total_score = min(total_score, 64)
            notes = "Profit factor below 1.0. Review before increasing size."
        if avg_r <= 0 and total_score >= 50 and n >= MIN_CLOSED_FOR_JUDGEMENT:
            total_score = 49
            notes = "Negative avg R caps maximum score at 'watch'."

        # Label
        if total_score >= 80:
            label = "priority"
        elif total_score >= 65:
            label = "trusted"
        elif total_score >= 50:
            label = "developing"
        elif total_score >= 30:
            label = "watch"
        else:
            label = "avoid"

        results.append(SetupConfidenceScore(
            setup=setup_name,
            score=total_score,
            label=label,
            sample_size=n,
            win_rate=round(win_rate * 100, 1),
            avg_r=round(avg_r, 2),
            total_pnl=round(float(gross_pnl), 2),
            consistency_score=round(consistency_score, 1),
            risk_score=round(risk_score_dim, 1),
            notes=notes,
        ))

    results.sort(key=lambda x: x.score, reverse=True)
    return results


# ─── Behavioral drift detection ────────────────────────────────


def get_behavioral_drift_signals(
    db: Session,
    user_id: int,
    lookback_days: int = 30,
    baseline_days: int = 90,
) -> list[BehavioralDriftSignal]:
    now = datetime.utcnow()
    recent_start = now - timedelta(days=lookback_days)
    baseline_start = recent_start - timedelta(days=baseline_days)

    recent_trades = _base_trades(db, user_id, recent_start, now).all()
    baseline_trades = _base_trades(db, user_id, baseline_start, recent_start).all()

    recent_closed = [t for t in recent_trades if t.exit_price is not None and t.pnl is not None]
    baseline_closed = [t for t in baseline_trades if t.exit_price is not None and t.pnl is not None]

    recent_ids = [t.id for t in recent_trades]
    signals: list[BehavioralDriftSignal] = []

    if not recent_trades:
        return signals

    # 1. Trade frequency
    recent_days = max(1, (now - recent_start).days)
    baseline_days_actual = max(1, (recent_start - baseline_start).days)
    recent_freq = len(recent_trades) / recent_days
    baseline_freq = len(baseline_trades) / baseline_days_actual if baseline_trades else recent_freq

    if baseline_trades and recent_freq > baseline_freq * 1.5 and len(recent_trades) >= MIN_SAMPLE_FOR_DRIFT:
        change = round((recent_freq - baseline_freq) / baseline_freq * 100, 1) if baseline_freq else 100
        severity = "critical" if change > 200 else "warning" if change > 100 else "info"
        signals.append(BehavioralDriftSignal(
            id="drift-frequency",
            title="Trade frequency increased sharply",
            severity=severity,
            metric="trades_per_day",
            current_value=round(recent_freq, 2),
            baseline_value=round(baseline_freq, 2),
            change=change,
            explanation=f"Trading at {round(recent_freq, 2)} trades/day vs {round(baseline_freq, 2)} baseline. Volume suggests possible overtrading.",
            suggested_action="Review whether each trade meets your criteria. Consider setting a daily limit.",
            related_trade_ids=[t.id for t in recent_trades[-10:]],
        ))

    # 2. Avg R dropped
    if recent_closed and baseline_closed:
        recent_r_vals = [float(t.r_multiple) for t in recent_closed if t.r_multiple is not None]
        baseline_r_vals = [float(t.r_multiple) for t in baseline_closed if t.r_multiple is not None]
        if len(recent_r_vals) >= MIN_SAMPLE_FOR_DRIFT and len(baseline_r_vals) >= MIN_SAMPLE_FOR_DRIFT:
            recent_avg_r = sum(recent_r_vals) / len(recent_r_vals)
            baseline_avg_r = sum(baseline_r_vals) / len(baseline_r_vals)
            if recent_avg_r < baseline_avg_r * 0.5 and baseline_avg_r > 0:
                drop_pct = round((baseline_avg_r - recent_avg_r) / baseline_avg_r * 100, 1)
                severity = "warning" if drop_pct > 75 else "info"
                signals.append(BehavioralDriftSignal(
                    id="drift-avg-r",
                    title="Average R-multiple dropped",
                    severity=severity,
                    metric="avg_r",
                    current_value=round(recent_avg_r, 2),
                    baseline_value=round(baseline_avg_r, 2),
                    change=-drop_pct,
                    explanation=f"Avg R dropped from {round(baseline_avg_r, 2)}R to {round(recent_avg_r, 2)}R. Edge may be eroding.",
                    suggested_action="Review recent losses. Check if setup quality or market regime has changed.",
                    related_trade_ids=[t.id for t in recent_closed[-5:]],
                ))

    # 3. Win rate dropped
    if recent_closed and baseline_closed:
        recent_wr = len([t for t in recent_closed if t.pnl and t.pnl > 0]) / len(recent_closed)
        baseline_wr = len([t for t in baseline_closed if t.pnl and t.pnl > 0]) / len(baseline_closed)
        if len(recent_closed) >= MIN_SAMPLE_FOR_DRIFT and baseline_wr > 0:
            if recent_wr < baseline_wr * 0.6:
                wr_drop = round((baseline_wr - recent_wr) / baseline_wr * 100, 1)
                severity = "critical" if wr_drop > 50 else "warning"
                signals.append(BehavioralDriftSignal(
                    id="drift-win-rate",
                    title="Win rate declined significantly",
                    severity=severity,
                    metric="win_rate",
                    current_value=round(recent_wr * 100, 1),
                    baseline_value=round(baseline_wr * 100, 1),
                    change=-wr_drop,
                    explanation=f"Win rate dropped from {round(baseline_wr * 100, 1)}% to {round(recent_wr * 100, 1)}%.",
                    suggested_action=f"Review last {len(recent_closed)} trades. Look for common pattern in losses. Consider reducing size.",
                    related_trade_ids=[t.id for t in recent_closed[-5:]],
                ))

    # 4. Average loss increased
    if recent_closed and baseline_closed:
        recent_losses = [t for t in recent_closed if t.pnl and t.pnl < 0]
        baseline_losses = [t for t in baseline_closed if t.pnl and t.pnl < 0]
        if len(recent_losses) >= 3 and len(baseline_losses) >= 3:
            recent_avg_loss = abs(sum(t.pnl for t in recent_losses) / len(recent_losses))
            baseline_avg_loss = abs(sum(t.pnl for t in baseline_losses) / len(baseline_losses))
            if baseline_avg_loss > 0 and recent_avg_loss > baseline_avg_loss * 1.5:
                increase_pct = round((recent_avg_loss - baseline_avg_loss) / baseline_avg_loss * 100, 1)
                severity = "critical" if increase_pct > 100 else "warning"
                signals.append(BehavioralDriftSignal(
                    id="drift-avg-loss",
                    title="Average loss size increased",
                    severity=severity,
                    metric="avg_loss",
                    current_value=round(float(recent_avg_loss), 2),
                    baseline_value=round(float(baseline_avg_loss), 2),
                    change=increase_pct,
                    explanation=f"Average loss grew from {round(float(baseline_avg_loss), 2)} to {round(float(recent_avg_loss), 2)}. Stops may be too wide or missing.",
                    suggested_action="Check stop placement on recent losses. Review if position sizing has changed.",
                    related_trade_ids=[t.id for t in recent_losses[:5]],
                ))

    # 5. Emotion shift (revenge/fomo increase)
    if recent_ids:
        recent_emotions = db.query(EmotionLog).filter(
            EmotionLog.trade_id.in_(recent_ids),
            EmotionLog.emotion.in_(["revenge", "fomo"]),
        ).count()
        if recent_emotions >= 3:
            signals.append(BehavioralDriftSignal(
                id="drift-emotion",
                title=f"Emotion alert: {recent_emotions} revenge/FOMO trades",
                severity="warning",
                metric="revenge_fomo_count",
                current_value=recent_emotions,
                explanation=f"{recent_emotions} trades marked with revenge or FOMO emotion. These correlate with poor outcomes.",
                suggested_action="Journal your emotional state before each entry. Take a 15-minute break when feeling intense emotions.",
                related_trade_ids=[r.id for r in recent_trades if r.id in recent_ids][:5],
            ))

    # 6. Execution grade decline
    if recent_ids:
        recent_grades = db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(recent_ids)).all()
        grade_vals = [_grade_numeric(g.overall_grade) for g in recent_grades if g.overall_grade]
        if len(grade_vals) >= MIN_SAMPLE_FOR_DRIFT:
            recent_avg_grade = sum(grade_vals) / len(grade_vals)
            # Compare to all grades (broader baseline)
            all_grade_vals = [_grade_numeric(g.overall_grade) for g in
                             db.query(ExecutionGrade).join(Trade).filter(
                                 Trade.user_id == user_id,
                                Trade.status != "deleted",
                            ).all() if g.overall_grade]
            if all_grade_vals:
                baseline_avg_grade = sum(all_grade_vals) / len(all_grade_vals)
                if recent_avg_grade < baseline_avg_grade - 1.0:
                    signals.append(BehavioralDriftSignal(
                        id="drift-execution-grades",
                        title="Execution grades declining",
                        severity="warning",
                        metric="avg_grade",
                        current_value=round(recent_avg_grade, 2),
                        baseline_value=round(baseline_avg_grade, 2),
                        change=round(recent_avg_grade - baseline_avg_grade, 2),
                        explanation=f"Recent avg grade {round(recent_avg_grade, 2)}/5 vs baseline {round(baseline_avg_grade, 2)}/5. Execution quality degrading.",
                        suggested_action="Focus on pre-trial routine. Check each setup condition before entry.",
                        related_trade_ids=[g.trade_id for g in recent_grades[:5]],
                    ))

    # 7. Journaling consistency
    recent_journal_days = _count_journal_days(db, user_id, recent_start, now)
    trade_days_recent = {t.entry_time.date() for t in recent_trades if t.entry_time}
    if trade_days_recent:
        journal_rate = len(recent_journal_days & trade_days_recent) / len(trade_days_recent) * 100
        if journal_rate < 40 and len(trade_days_recent) >= 3:
            signals.append(BehavioralDriftSignal(
                id="drift-journaling",
                title="Journaling consistency dropped",
                severity="info",
                metric="journal_rate",
                current_value=round(journal_rate, 1),
                baseline_value=80.0,
                change=round(journal_rate - 80, 1),
                explanation=f"Only journaling {round(journal_rate, 1)}% of trading days recently. Journaling builds self-awareness.",
                suggested_action="Set aside 5 minutes after market close to journal. Even brief notes help.",
                related_trade_ids=[t.id for t in recent_trades[:5]],
            ))

    return signals


# ─── Trade review prompts ──────────────────────────────────────


def get_trade_review_prompts(
    db: Session,
    user_id: int,
    limit: int = 5,
) -> list[TradeReviewPrompt]:
    trades = _base_trades(db, user_id, None, None).order_by(Trade.entry_time.desc()).all()
    closed = [t for t in trades if t.exit_price is not None and t.pnl is not None]
    if not closed:
        return []

    trade_ids = [t.id for t in closed]
    emotion_by_trade: dict[int, list[str]] = defaultdict(list)
    for e in db.query(EmotionLog).filter(EmotionLog.trade_id.in_(trade_ids)).all():
        emotion_by_trade[e.trade_id].append(e.emotion)

    grade_by_trade: dict[int, ExecutionGrade] = {}
    for g in db.query(ExecutionGrade).filter(ExecutionGrade.trade_id.in_(trade_ids)).all():
        grade_by_trade[g.trade_id] = g

    # Priority scoring for trades worth reviewing
    scored: list[tuple[Trade, float, str, list[str]]] = []
    seen_ids = set()

    for t in closed:
        if t.id in seen_ids:
            continue
        seen_ids.add(t.id)
        if not t.pnl:
            continue

        emotions = emotion_by_trade.get(t.id, [])
        grade = grade_by_trade.get(t.id)
        pnl = float(t.pnl)
        reasons: list[str] = []
        score = 0.0

        # Largest loss
        if pnl < 0:
            loss_magnitude = abs(pnl)
            score += loss_magnitude / 100  # normalize
            reasons.append("loss")

        # Biggest missed R
        if t.r_multiple is not None and t.r_multiple < 0 and abs(float(t.r_multiple)) > 3:
            score += 30
            reasons.append("large-negative-r")

        # Revenge/FOMO emotion
        if any(e in ("revenge", "fomo") for e in emotions):
            score += 50
            reasons.append("revenge-fomo")

        # Poor execution grade
        if grade and grade.overall_grade in ("D", "F"):
            score += 40
            reasons.append("poor-grade")

        # Missing stop
        if not t.stop_price or (hasattr(t.stop_price, '__float__') and float(t.stop_price) <= 0):
            score += 20
            reasons.append("no-stop")

        # Unusually large position (relative to typical)
        qty = float(t.quantity) if t.quantity else 0
        avg_qty = sum(float(c.quantity or 0) for c in closed) / len(closed) if closed else 0
        if avg_qty > 0 and qty > avg_qty * 2:
            score += 25
            reasons.append("large-size")

        # Best winner with positive learning
        if pnl > 0 and grade and grade.overall_grade in ("A", "B") and t.r_multiple and float(t.r_multiple) > 2:
            score += 20
            reasons.append("best-winner")

        if score > 0:
            scored.append((t, score, reasons, emotions))

    # Sort by priority score, take top N
    scored.sort(key=lambda x: x[1], reverse=True)
    scored = scored[:limit]

    # Build prompts
    prompts: list[TradeReviewPrompt] = []
    for t, score, reasons, emotions in scored:
        pnl = float(t.pnl or 0)
        r_val = float(t.r_multiple or 0)

        focus_map = {
            "loss": "loss_analysis",
            "large-negative-r": "risk_management",
            "revenge-fomo": "psychology",
            "poor-grade": "execution_quality",
            "no-stop": "discipline",
            "large-size": "position_sizing",
            "best-winner": "positive_reinforcement",
        }
        primary_reason = reasons[0]
        focus_area = focus_map.get(primary_reason, "general")

        # Why this trade
        why_parts = []
        if "loss" in reasons:
            why_parts.append(f"Largest loss (₹{round(abs(pnl), 0):,.0f})")
        if "revenge-fomo" in reasons:
            why_parts.append("Emotional state flagged")
        if "poor-grade" in reasons:
            why_parts.append(f"Execution grade {grade_by_trade[t.id].overall_grade if t.id in grade_by_trade and grade_by_trade[t.id].overall_grade else 'low'}")
        if "best-winner" in reasons:
            why_parts.append("Exemplary trade worth studying")
        why = "; ".join(why_parts) if why_parts else f"PnL: ₹{round(pnl, 0):,.0f}, R: {round(r_val, 2)}"

        # Questions
        questions = []
        if "revenge-fomo" in reasons:
            questions.append("What triggered the emotional state before entering this trade?")
            questions.append("What could you do differently next time you feel this emotion?")
        if "poor-grade" in reasons:
            questions.append("Which specific execution dimension was weakest?")
            questions.append("What one change would have improved the grade?")
        if "loss" in reasons:
            questions.append("Did you follow your stop loss plan?")
            questions.append("Was the setup present or did you force the trade?")
        if "no-stop" in reasons:
            questions.append("Why was no stop defined before entry?")
            questions.append("What is the maximum acceptable loss for this setup?")
        if "large-size" in reasons:
            questions.append("Why was this position larger than usual?")
            questions.append("Does the risk justify the size?")
        if "best-winner" in reasons:
            questions.append("What conditions aligned for this win?")
            questions.append("Can you recreate these conditions consistently?")
        if not questions:
            questions.append("What went well in this trade?")
            questions.append("What would you do differently?")

        prompts.append(TradeReviewPrompt(
            trade_id=t.id,
            symbol=t.symbol,
            setup=t.setup,
            prompt=f"Review {t.symbol}: {why}",
            focus_area=focus_area,
            why_this_trade=why,
            related_patterns=reasons,
            questions=questions,
        ))

    return prompts


# ─── Weekly coaching plan ──────────────────────────────────────


def get_weekly_coaching_plan(
    db: Session,
    user_id: int,
    week_start: Optional[date] = None,
) -> WeeklyCoachingPlan:
    mon, fri = _week_boundary(week_start)
    plan_start = datetime.combine(mon, datetime.min.time())
    plan_end = datetime.combine(fri, datetime.max.time())
    now_str = datetime.utcnow().isoformat()

    # Get setup scores
    scores = get_setup_confidence_scores(db, user_id, plan_start, plan_end)

    # Get behavioral drift (longer lookback)
    drift = get_behavioral_drift_signals(db, user_id, lookback_days=30, baseline_days=90)

    # Get recommendation dashboard for cross-referencing
    rec_dashboard = get_recommendation_dashboard(db, user_id, plan_start.isoformat(), plan_end.isoformat())

    # Trades this week
    week_trades = _base_trades(db, user_id, plan_start, plan_end).all()
    closed_week = [t for t in week_trades if t.exit_price is not None and t.pnl is not None]

    # Build priorities from scores, drift, and recs
    priorities: list[CoachingPriority] = []

    # Setup-related priorities
    low_scores = [s for s in scores if s.label in ("avoid", "watch")]
    for s in low_scores[:2]:
        priorities.append(CoachingPriority(
            id=f"setup-{s.setup.lower().replace(' ', '-')}",
            title=f"Review {s.setup} performance",
            category="setup",
            severity="info" if s.label == "watch" else "warning",
            reason=f"{s.setup} has a confidence score of {s.score} ({s.label}).",
            evidence=f"Win rate: {s.win_rate}%, Avg R: {s.avg_r}, Sample: {s.sample_size} trades",
            action=f"Review {s.sample_size} {s.setup} trades. {s.notes or ''}",
            due_context="This week",
        ))

    high_scores = [s for s in scores if s.label in ("trusted", "priority")]
    for s in high_scores[:2]:
        priorities.append(CoachingPriority(
            id=f"setup-focus-{s.setup.lower().replace(' ', '-')}",
            title=f"Focus on {s.setup}",
            category="setup",
            severity="positive",
            reason=f"{s.setup} scored {s.score} ({s.label}). Positive edge confirmed.",
            evidence=f"Win rate: {s.win_rate}%, Avg R: {s.avg_r}, Sample: {s.sample_size} trades, Total P&L: ₹{s.total_pnl}",
            action=f"Increase allocation to {s.setup}. Track over next 20 trades.",
            due_context="Ongoing",
        ))

    # Drift-related priorities
    for d in drift[:3]:
        sev = d.severity
        priorities.append(CoachingPriority(
            id=d.id,
            title=d.title,
            category="behavioral",
            severity="warning" if sev == "critical" else sev,
            reason=d.explanation,
            evidence=f"{d.metric}: {d.current_value} vs {d.baseline_value} (change: {d.change})",
            action=d.suggested_action,
            related_trade_ids=d.related_trade_ids,
        ))

    # Recommendation-driven priorities
    for rec in rec_dashboard.recommendations[:3]:
        if rec.action_type in ("reduce_size", "pause_setup", "improve_rule"):
            priorities.append(CoachingPriority(
                id=f"rec-{rec.id}",
                title=rec.title,
                category="recommendation",
                severity=rec.severity.value,
                reason=rec.why,
                evidence=rec.summary,
                action=rec.suggested_action,
                related_recommendation_ids=[rec.id],
            ))

    # Review prompts (text only, not full TradeReviewPrompt)
    review_prompts_text = []
    if closed_week and len(closed_week) >= 2:
        week_losses = [t for t in closed_week if t.pnl and t.pnl < 0]
        if week_losses:
            worst = min(week_losses, key=lambda t: t.pnl or 0)
            review_prompts_text.append(f"Why did {worst.symbol} become the week's worst trade? What was different?")
        best = max(closed_week, key=lambda t: t.pnl or 0)
        review_prompts_text.append(f"What went right on {best.symbol}? Can you identify the conditions to recreate?")

    review_prompts_text.append("How many trades met all your entry criteria before execution?")
    review_prompts_text.append("Did you exit any trade early due to fear rather than a clear signal?")

    # Rules for next week
    rules: list[str] = []
    if any(d.id == "drift-frequency" for d in drift):
        rules.append("No more than 3 trades per day. Stop after 3 losses.")
    if any(d.id == "drift-avg-r" for d in drift):
        rules.append("Review each setup's stop distance before entry.")
    if any(s.label in ("avoid", "watch") for s in scores):
        worst_setup = min(scores, key=lambda s: s.score) if scores else None
        if worst_setup:
            rules.append(f"Pause {worst_setup} until further review.")
    if not rules:
        rules.append("Continue following your trading plan.")
        rules.append("Journal every trade entry and exit.")
    rules.append("Log emotion before each trade.")

    # Size adjustments
    size_adj: list[str] = []
    if scores:
        low_conf = [s for s in scores if s.label in ("avoid", "watch")]
        if low_conf:
            size_adj.append(f"Reduce size on {', '.join(s.setup for s in low_conf[:2])}")
        high_conf = [s for s in scores if s.label in ("trusted", "priority")]
        if high_conf:
            size_adj.append(f"Consider increasing size on {', '.join(s.setup for s in high_conf[:2])}")
    if drift and drift[0].severity in ("warning", "critical"):
        size_adj.append("Reduce overall position size until drift resolves.")
    if not size_adj:
        size_adj.append("Maintain current position sizing.")

    # Determine headline and primary focus
    if drift:
        primary_focus = drift[0].title
    elif low_scores:
        primary_focus = f"Review {low_scores[0].setup} — confidence score {low_scores[0].score}"
    else:
        primary_focus = "Maintain current approach and track consistency"

    total_pnl_week = round(sum(float(t.pnl or 0) for t in closed_week), 2)
    headline = f"Week {mon.isoformat()}: "
    if not closed_week:
        headline += "No closed trades. Focus on preparation and journaling."
    elif total_pnl_week > 0:
        headline += f"Positive week (₹{total_pnl_week:,.2f}). {primary_focus}."
    else:
        headline += f"Tough week (₹{total_pnl_week:,.2f}). {primary_focus}."

    # Summary markdown
    summary_lines = [f"## Weekly Coaching Plan ({mon.isoformat()} - {fri.isoformat()})", ""]
    summary_lines.append(f"**{headline}**")
    summary_lines.append("")
    summary_lines.append(f"**Primary Focus:** {primary_focus}")
    summary_lines.append("")
    if priorities:
        summary_lines.append("### Priorities")
        for p in priorities[:5]:
            summary_lines.append(f"- [{p.severity}] {p.title}: {p.reason}")
        summary_lines.append("")
    if scores:
        summary_lines.append("### Setup Confidence")
        for s in scores[:5]:
            summary_lines.append(f"- {s.setup}: {s.score}/100 ({s.label}) — {s.sample_size} trades, {s.win_rate}% WR, {s.avg_r}R avg")
        summary_lines.append("")
    if rules:
        summary_lines.append("### Rules for Next Week")
        for r in rules[:3]:
            summary_lines.append(f"- {r}")
    summary_lines.append("")
    if size_adj:
        summary_lines.append("### Size Adjustments")
        for a in size_adj[:3]:
            summary_lines.append(f"- {a}")

    return WeeklyCoachingPlan(
        generated_at=now_str,
        week_start=mon.isoformat(),
        week_end=fri.isoformat(),
        headline=headline,
        primary_focus=primary_focus,
        priorities=priorities,
        setup_scores=scores,
        behavioral_drift=drift,
        review_prompts=review_prompts_text,
        rules_for_next_week=rules[:5],
        recommended_size_adjustments=size_adj[:3],
        summary_markdown="\n".join(summary_lines),
    )


# ─── Dashboard ─────────────────────────────────────────────────


def get_coaching_intelligence_dashboard(
    db: Session,
    user_id: int,
) -> CoachingIntelligenceDashboard:
    now_str = datetime.utcnow().isoformat()
    weekly_plan = get_weekly_coaching_plan(db, user_id)
    review_prompts = get_trade_review_prompts(db, user_id, limit=5)
    scores = get_setup_confidence_scores(db, user_id)

    next_actions: list[str] = []
    if weekly_plan.priorities:
        next_actions.append(weekly_plan.priorities[0].action)
    if len(weekly_plan.priorities) > 1:
        next_actions.append(weekly_plan.priorities[1].action)
    if weekly_plan.rules_for_next_week:
        next_actions.append(f"Rule: {weekly_plan.rules_for_next_week[0]}")
    if review_prompts:
        next_actions.append(f"Review {review_prompts[0].symbol}: {review_prompts[0].focus_area}")
    if not next_actions:
        next_actions.append("Close 5+ trades to generate coaching intelligence.")

    return CoachingIntelligenceDashboard(
        generated_at=now_str,
        weekly_plan=weekly_plan,
        top_trade_review_prompts=review_prompts,
        setup_scores=scores,
        behavioral_drift=weekly_plan.behavioral_drift,
        next_best_actions=next_actions,
    )
