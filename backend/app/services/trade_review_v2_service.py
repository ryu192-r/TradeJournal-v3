"""Trade Review Engine V2 — deterministic, read-only structured trade reviews."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.emotion_log import EmotionLog
from app.models.execution_grade import ExecutionGrade
from app.models.partial_exit import PartialExit
from app.models.setup_playbook import SetupPlaybook
from app.models.stop_history import StopHistory
from app.models.trade import Trade
from app.models.trade_timeline import TradeTimeline
from app.schemas.trade_review_v2 import (
    MistakeTag,
    ReviewDimensionScore,
    TradeReviewBatchResponse,
    TradeReviewBatchSummary,
    TradeReviewV2Response,
)
from app.services.coaching_intelligence_service import (
    _has_positive_stop,
    get_setup_confidence_scores,
)
from app.utils.calculations import calculate_trade_metrics

GRADE_SCORES = {"A": 95, "B": 80, "C": 65, "D": 45, "F": 25}
NEGATIVE_EMOTIONS = {"revenge", "fomo"}
CAUTION_EMOTIONS = {"fearful", "euphoric", "hesitant"}
MAX_RISK_PCT_OF_ENTRY = Decimal("0.15")  # 15% entry-to-stop distance flags oversized risk


def _score_label(score: int) -> str:
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "good"
    if score >= 55:
        return "average"
    if score >= 40:
        return "weak"
    return "critical"


def _grade_to_score(grade: Optional[str], default: int = 60) -> int:
    if grade and grade in GRADE_SCORES:
        return GRADE_SCORES[grade]
    return default


def _clamp(score: int, lo: int = 0, hi: int = 100) -> int:
    return max(lo, min(hi, score))


def _load_trade(db: Session, user_id: int, trade_id: int) -> Trade:
    trade = (
        db.query(Trade)
        .filter(Trade.id == trade_id, Trade.user_id == user_id, Trade.status != "deleted")
        .first()
    )
    if not trade:
        raise ValueError("Trade not found")
    return trade


def _trade_evidence_bundle(db: Session, trade: Trade) -> dict:
    """Load child records for an already user-scoped trade."""
    tid = trade.id
    return {
        "trade": trade,
        "partial_exits": db.query(PartialExit).filter(PartialExit.trade_id == tid).order_by(PartialExit.exit_time).all(),
        "execution_grade": db.query(ExecutionGrade).filter(ExecutionGrade.trade_id == tid).first(),
        "emotion_logs": db.query(EmotionLog).filter(EmotionLog.trade_id == tid).order_by(EmotionLog.timestamp).all(),
        "stop_history": db.query(StopHistory).filter(StopHistory.trade_id == tid).order_by(StopHistory.timestamp).all(),
        "timeline": db.query(TradeTimeline).filter(TradeTimeline.trade_id == tid).order_by(TradeTimeline.timestamp).all(),
        "playbook": (
            db.query(SetupPlaybook).filter(SetupPlaybook.name == trade.setup).first()
            if trade.setup
            else None
        ),
    }


def _risk_per_share(trade: Trade) -> Optional[Decimal]:
    entry = trade.entry_price
    stop = trade.stop_price
    if entry is None or stop is None:
        return None
    try:
        entry_d = Decimal(str(entry))
        stop_d = Decimal(str(stop))
    except Exception:
        return None
    if entry_d <= 0:
        return None
    direction = (trade.direction or "LONG").upper()
    if direction == "LONG":
        return entry_d - stop_d
    return stop_d - entry_d


def _setup_confidence_map(db: Session, user_id: int) -> dict[str, dict]:
    scores = get_setup_confidence_scores(db, user_id)
    return {s.setup: {"score": s.score, "label": s.label, "sample_size": s.sample_size} for s in scores}


def _score_setup_adherence(
    trade: Trade,
    grade: Optional[ExecutionGrade],
    setup_conf: Optional[dict],
    playbook: Optional[SetupPlaybook],
) -> ReviewDimensionScore:
    evidence: list[str] = []
    score = 75
    improvement: Optional[str] = None

    if not trade.setup:
        score = 45
        evidence.append("No setup tag on trade — cannot review against playbook.")
        improvement = "Tag every trade with the playbook setup before entry."
    elif not playbook:
        score = min(score, 65)
        evidence.append(f"Setup '{trade.setup}' has no matching playbook entry.")
        improvement = "Create or link a playbook entry for this setup."
    else:
        evidence.append(f"Setup '{trade.setup}' linked to playbook ({playbook.trade_count or 0} historical trades).")
        if playbook.rules:
            evidence.append(f"Playbook defines {len(playbook.rules)} rule(s).")

    if grade and grade.rule_adherence:
        gs = _grade_to_score(grade.rule_adherence)
        evidence.append(f"Rule adherence grade: {grade.rule_adherence}.")
        if grade.rule_adherence in ("A", "B"):
            score = _clamp(int(score * 0.4 + gs * 0.6))
        elif grade.rule_adherence in ("D", "F"):
            score = _clamp(int(score * 0.5 + gs * 0.5))
            improvement = improvement or "Re-read playbook rules before the next trade in this setup."

    if setup_conf:
        label = setup_conf.get("label", "")
        conf_score = setup_conf.get("score", 50)
        evidence.append(f"Setup confidence: {label} ({conf_score}/100, n={setup_conf.get('sample_size', 0)}).")
        if label in ("priority", "trusted"):
            score = _clamp(score + 8)
        elif label == "developing":
            pass
        elif label == "watch":
            score = _clamp(score - 10)
        elif label == "avoid":
            score = _clamp(score - 18)
            improvement = improvement or "Avoid or reduce size on setups flagged as avoid."

    if trade.review_notes:
        evidence.append("Review notes present.")
    elif trade.exit_price is not None:
        evidence.append("No review notes recorded post-exit.")

    return ReviewDimensionScore(
        dimension="setup_adherence",
        score=_clamp(score),
        label=_score_label(_clamp(score)),
        reason="How well the trade matched your defined setup and playbook rules.",
        evidence=evidence,
        improvement=improvement,
    )


def _score_entry_quality(
    trade: Trade,
    grade: Optional[ExecutionGrade],
    timeline: list[TradeTimeline],
    has_stop: bool,
) -> ReviewDimensionScore:
    evidence: list[str] = []
    improvement: Optional[str] = None
    score = 70

    if grade and grade.entry_quality:
        score = _grade_to_score(grade.entry_quality)
        evidence.append(f"Entry quality grade: {grade.entry_quality}.")
    else:
        evidence.append("No execution grade for entry quality.")
        score = 58

    if not has_stop:
        score = _clamp(score - 20)
        evidence.append("No stop defined — entry lacked a risk anchor.")
        improvement = "Define stop before entry; entry without stop is a process violation."

    risk = _risk_per_share(trade)
    entry_d = Decimal(str(trade.entry_price)) if trade.entry_price else None
    if risk is not None and entry_d and entry_d > 0:
        risk_pct = abs(risk) / entry_d
        evidence.append(f"Entry-to-stop distance: {float(risk_pct * 100):.1f}% of entry.")
        if risk_pct > MAX_RISK_PCT_OF_ENTRY:
            score = _clamp(score - 15)
            evidence.append("Stop distance is wide relative to entry — oversized risk per share.")
            improvement = improvement or "Tighten stop or reduce size when risk per share is large."

    if not trade.notes and not trade.target_price:
        score = _clamp(score - 8)
        evidence.append("No entry plan notes or target — entry thesis unclear.")

    stop_events = [e for e in timeline if e.event_type == "stop_updated"]
    if stop_events:
        evidence.append(f"{len(stop_events)} stop update(s) on timeline.")

    return ReviewDimensionScore(
        dimension="entry_quality",
        score=_clamp(score),
        label=_score_label(_clamp(score)),
        reason="Quality of entry timing, planning, and alignment with risk plan.",
        evidence=evidence,
        improvement=improvement,
    )


def _score_exit_quality(
    trade: Trade,
    grade: Optional[ExecutionGrade],
    partials: list[PartialExit],
    is_open: bool,
) -> ReviewDimensionScore:
    evidence: list[str] = []
    improvement: Optional[str] = None

    if is_open:
        return ReviewDimensionScore(
            dimension="exit_quality",
            score=55,
            label="average",
            reason="Trade still open — exit quality cannot be fully assessed.",
            evidence=["Trade has no final exit yet.", "Partial exits and stop discipline still apply."],
            improvement="Define exit plan (target/trail rules) before closing.",
        )

    score = 70
    if grade and grade.exit_quality:
        score = _grade_to_score(grade.exit_quality)
        evidence.append(f"Exit quality grade: {grade.exit_quality}.")
    else:
        evidence.append("No execution grade for exit quality.")
        score = 58

    r_val = float(trade.r_multiple) if trade.r_multiple is not None else None
    pnl = float(trade.pnl) if trade.pnl is not None else None

    if r_val is not None:
        evidence.append(f"Realized R-multiple: {r_val:.2f}.")
        if r_val <= -2:
            score = _clamp(score - 20)
            evidence.append("Large negative R — exit did not protect capital.")
        elif r_val >= 2:
            score = _clamp(score + 10)

    if pnl is not None:
        evidence.append(f"Net P&L: ₹{pnl:,.0f}.")
        if pnl > 0 and r_val is not None and 0 < r_val < 0.5:
            score = _clamp(score - 10)
            evidence.append("Winner but low R — may have exited early vs plan.")
            improvement = improvement or "Compare exit to target; consider scaling rules."

    if partials:
        profitable_partials = sum(1 for p in partials if p.realized_pnl and float(p.realized_pnl) > 0)
        evidence.append(f"{len(partials)} partial exit(s); {profitable_partials} profitable leg(s).")
        if profitable_partials > 0:
            score = _clamp(score + 5)

    if trade.exit_reason:
        evidence.append(f"Exit reason: {trade.exit_reason}.")
        if trade.exit_reason == "stop_loss" and pnl is not None and pnl < 0:
            evidence.append("Stopped out as planned — discipline preserved.")

    return ReviewDimensionScore(
        dimension="exit_quality",
        score=_clamp(score),
        label=_score_label(_clamp(score)),
        reason="How well the exit matched plan, R outcome, and partial-exit discipline.",
        evidence=evidence,
        improvement=improvement,
    )


def _score_risk_discipline(
    trade: Trade,
    grade: Optional[ExecutionGrade],
    stop_history: list[StopHistory],
    partials: list[PartialExit],
    has_stop: bool,
) -> ReviewDimensionScore:
    evidence: list[str] = []
    improvement: Optional[str] = None
    score = 75

    if not has_stop:
        score = 25
        evidence.append("No stop price defined — critical risk violation.")
        improvement = "Always define stop before entry."
        return ReviewDimensionScore(
            dimension="risk_discipline",
            score=score,
            label="critical",
            reason="Stop, sizing, and stop-management discipline.",
            evidence=evidence,
            improvement=improvement,
        )

    if grade:
        if grade.stop_quality:
            score = int(score * 0.5 + _grade_to_score(grade.stop_quality) * 0.5)
            evidence.append(f"Stop quality grade: {grade.stop_quality}.")
        if grade.sizing_quality:
            score = int(score * 0.5 + _grade_to_score(grade.sizing_quality) * 0.5)
            evidence.append(f"Sizing quality grade: {grade.sizing_quality}.")

    risk = _risk_per_share(trade)
    entry_d = Decimal(str(trade.entry_price)) if trade.entry_price else None
    if risk is not None and entry_d and entry_d > 0 and abs(risk) / entry_d > MAX_RISK_PCT_OF_ENTRY:
        score = _clamp(score - 12)
        evidence.append("Risk per share is large vs entry — position risk may be oversized.")

    if len(stop_history) >= 2:
        direction = (trade.direction or "LONG").upper()
        moved_against = False
        for i in range(1, len(stop_history)):
            prev_p = Decimal(str(stop_history[i - 1].price))
            curr_p = Decimal(str(stop_history[i].price))
            if direction == "LONG" and curr_p < prev_p:
                moved_against = True
            elif direction != "LONG" and curr_p > prev_p:
                moved_against = True
        if moved_against:
            score = _clamp(score - 15)
            evidence.append("Stop was moved against the trade (widened risk).")
            improvement = improvement or "Only trail or tighten stops per plan — do not widen risk."

    if partials:
        de_risk = any(p.realized_pnl and float(p.realized_pnl) > 0 for p in partials)
        if de_risk:
            score = _clamp(score + 6)
            evidence.append("Partial exit(s) reduced exposure with realized profit.")

    return ReviewDimensionScore(
        dimension="risk_discipline",
        score=_clamp(score),
        label=_score_label(_clamp(score)),
        reason="Stop, sizing, and stop-management discipline.",
        evidence=evidence,
        improvement=improvement,
    )


def _score_psychology(
    trade: Trade,
    grade: Optional[ExecutionGrade],
    emotions: list[EmotionLog],
) -> ReviewDimensionScore:
    evidence: list[str] = []
    improvement: Optional[str] = None
    score = 72

    emotion_names = [e.emotion.lower() for e in emotions if e.emotion]
    if not emotion_names:
        evidence.append("No emotion logs — neutral psychology score (not penalized heavily).")
        score = 62
    else:
        evidence.append(f"Emotions logged: {', '.join(sorted(set(emotion_names)))}.")
        if any(e in NEGATIVE_EMOTIONS for e in emotion_names):
            score = _clamp(score - 30)
            improvement = "Do not enter during revenge or FOMO — pause and reset."
        elif any(e in CAUTION_EMOTIONS for e in emotion_names):
            score = _clamp(score - 12)

    if grade:
        if grade.patience and grade.patience in ("A", "B"):
            score = _clamp(score + 8)
            evidence.append(f"Patience grade: {grade.patience}.")
        elif grade.patience in ("D", "F"):
            score = _clamp(score - 12)
            evidence.append(f"Patience grade: {grade.patience}.")

    return ReviewDimensionScore(
        dimension="psychology",
        score=_clamp(score),
        label=_score_label(_clamp(score)),
        reason="Emotional state and patience during the trade.",
        evidence=evidence,
        improvement=improvement,
    )


def _score_playbook_alignment(
    trade: Trade,
    playbook: Optional[SetupPlaybook],
    setup_conf: Optional[dict],
    is_open: bool,
) -> ReviewDimensionScore:
    evidence: list[str] = []
    improvement: Optional[str] = None
    score = 70

    if not trade.setup:
        score = 40
        evidence.append("No setup — playbook alignment not possible.")
    elif not playbook:
        score = 55
        evidence.append("Setup tagged but no playbook record.")
    else:
        evidence.append(f"Playbook active: {playbook.is_active}.")
        if playbook.win_rate:
            evidence.append(f"Historical win rate: {playbook.win_rate}.")
        if playbook.avg_r:
            evidence.append(f"Historical avg R: {playbook.avg_r}.")

    if setup_conf:
        label = setup_conf.get("label", "")
        if label in ("priority", "trusted"):
            score = _clamp(score + 10)
        elif label in ("watch", "avoid"):
            score = _clamp(score - 15)
            improvement = "Trade used a low-confidence setup — reduce size or skip."

    if not is_open and trade.pnl is not None:
        pnl = float(trade.pnl)
        if pnl < 0 and setup_conf and setup_conf.get("label") in ("watch", "avoid"):
            score = _clamp(score - 10)
            evidence.append("Loss in a low-confidence setup — expected variance but process concern.")

    return ReviewDimensionScore(
        dimension="playbook_alignment",
        score=_clamp(score),
        label=_score_label(_clamp(score)),
        reason="Alignment with playbook stats and setup confidence tier.",
        evidence=evidence,
        improvement=improvement,
    )


def _compute_overall(dimensions: list[ReviewDimensionScore]) -> int:
    weights = {
        "setup_adherence": 0.20,
        "entry_quality": 0.20,
        "exit_quality": 0.20,
        "risk_discipline": 0.25,
        "psychology": 0.15,
    }
    by_dim = {d.dimension: d.score for d in dimensions if d.dimension in weights}
    if not by_dim:
        return 50
    total = sum(by_dim[k] * weights[k] for k in weights)
    return _clamp(int(round(total)))


def _determine_verdict(
    overall: int,
    trade: Trade,
    is_open: bool,
    mistake_tags: list[MistakeTag],
    risk_dim: Optional[ReviewDimensionScore],
) -> str:
    if is_open:
        return "incomplete_open_trade"
    critical_tags = {t.tag for t in mistake_tags if t.severity == "critical"}
    if "no_stop" in critical_tags or (risk_dim and risk_dim.score < 40):
        return "risk_violation_trade"
    if "rule_break" in critical_tags:
        return "rule_break_trade"
    pnl = float(trade.pnl) if trade.pnl is not None else 0
    if overall >= 85:
        return "excellent_execution"
    if overall >= 70:
        return "good_execution"
    if pnl > 0 and overall < 70:
        return "flawed_but_profitable"
    return "poor_execution"


def _build_mistake_tags(
    trade: Trade,
    bundle: dict,
    dimensions: list[ReviewDimensionScore],
    setup_conf: Optional[dict],
    is_open: bool,
) -> list[MistakeTag]:
    tags: list[MistakeTag] = []
    seen: set[str] = set()

    def add(
        tag: str,
        severity: str,
        category: str,
        explanation: str,
        suggested_fix: str,
    ) -> None:
        if tag in seen:
            return
        seen.add(tag)
        tags.append(
            MistakeTag(
                tag=tag,
                severity=severity,
                category=category,
                explanation=explanation,
                suggested_fix=suggested_fix,
            )
        )

    grade: Optional[ExecutionGrade] = bundle["execution_grade"]
    emotions = bundle["emotion_logs"]
    stop_history = bundle["stop_history"]
    has_stop = _has_positive_stop(trade.stop_price)

    if not trade.setup:
        add("no_setup", "warning", "setup", "Trade has no setup tag.", "Tag setup before entry.")
    if not has_stop:
        add(
            "no_stop",
            "critical",
            "risk",
            "This was a risk violation: no stop was defined.",
            "Define stop before entry on every trade.",
        )

    risk = _risk_per_share(trade)
    entry_d = Decimal(str(trade.entry_price)) if trade.entry_price else None
    if risk is not None and entry_d and entry_d > 0 and abs(risk) / entry_d > MAX_RISK_PCT_OF_ENTRY:
        add(
            "oversized_risk",
            "warning",
            "risk",
            "Stop distance implies oversized risk per share.",
            "Reduce size or tighten stop to fit risk budget.",
        )

    if grade:
        if grade.entry_quality in ("D", "F"):
            add("poor_entry", "warning", "entry", f"Entry quality graded {grade.entry_quality}.", "Review entry checklist.")
        if grade.exit_quality in ("D", "F") and not is_open:
            add("poor_exit", "warning", "exit", f"Exit quality graded {grade.exit_quality}.", "Compare exit to target/stop plan.")
        if grade.rule_adherence in ("D", "F"):
            add("rule_break", "critical", "process", f"Rule adherence graded {grade.rule_adherence}.", "Re-read playbook rules before next trade.")
    else:
        add("no_execution_grade", "info", "process", "No execution grade recorded.", "Grade execution after close.")

    emotion_names = {e.emotion.lower() for e in emotions if e.emotion}
    if "revenge" in emotion_names:
        add("revenge_trade", "critical", "psychology", "Revenge emotion logged.", "Pause trading after losses.")
    if "fomo" in emotion_names:
        add("fomo_trade", "critical", "psychology", "FOMO emotion logged.", "Wait for confirmation; skip chase entries.")
    if "fearful" in emotion_names and not is_open:
        add("fear_exit", "warning", "psychology", "Fear logged during trade.", "Check if fear drove early exit.")
    if "euphoric" in emotion_names:
        add("greed_exit", "warning", "psychology", "Euphoria logged — watch for oversizing/holding too long.", "Stick to exit plan.")

    if setup_conf and setup_conf.get("label") in ("watch", "avoid"):
        add(
            "low_confidence_setup",
            "warning",
            "setup",
            f"Setup confidence is '{setup_conf.get('label')}'.",
            "Reduce size or skip until setup stats improve.",
        )

    if trade.r_multiple is not None and float(trade.r_multiple) <= -2:
        add(
            "large_negative_r",
            "critical",
            "risk",
            f"R-multiple was {float(trade.r_multiple):.2f}.",
            "Review stop placement and sizing.",
        )

    if not trade.notes and not trade.review_notes:
        add("no_journal_context", "info", "process", "Limited notes for context.", "Journal thesis and outcome.")

    if not trade.review_notes and not is_open:
        add("no_review_notes", "info", "process", "No post-trade review notes.", "Add review notes after close.")

    if len(stop_history) >= 2:
        direction = (trade.direction or "LONG").upper()
        for i in range(1, len(stop_history)):
            prev_p = Decimal(str(stop_history[i - 1].price))
            curr_p = Decimal(str(stop_history[i].price))
            widened = (direction == "LONG" and curr_p < prev_p) or (direction != "LONG" and curr_p > prev_p)
            if widened:
                add(
                    "moved_stop_against_plan",
                    "warning",
                    "risk",
                    "Stop history shows risk was widened.",
                    "Do not move stop away from entry.",
                )
                break

    r_val = float(trade.r_multiple) if trade.r_multiple is not None else None
    if not is_open and r_val is not None and trade.pnl and float(trade.pnl) > 0 and 0 < r_val < 0.5:
        add("early_exit", "info", "exit", "Positive P&L but R below 0.5 — possible early exit.", "Compare to target R.")

    dim_by_name = {d.dimension: d for d in dimensions}
    for dim_name, dim in dim_by_name.items():
        if dim.score < 40 and dim_name == "risk_discipline" and "no_stop" not in seen:
            add(
                f"weak_{dim_name}",
                "critical",
                "risk",
                dim.reason,
                dim.improvement or "Improve risk discipline.",
            )

    return tags


def _build_guidance(
    trade: Trade,
    mistake_tags: list[MistakeTag],
    dimensions: list[ReviewDimensionScore],
    is_open: bool,
) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    what: list[str] = []
    rules: list[str] = []
    questions: list[str] = []
    strengths: list[str] = []
    weaknesses: list[str] = []

    tag_set = {t.tag for t in mistake_tags}

    if "no_stop" in tag_set:
        what.append("Define stop before entry.")
        rules.append("No entry without a written stop price.")
    if "no_setup" in tag_set:
        what.append("Skip trade if setup is missing.")
        rules.append("Every trade must map to one playbook setup.")
    if "low_confidence_setup" in tag_set:
        what.append("Reduce risk or position size when setup confidence is watch/avoid.")
    if "revenge_trade" in tag_set or "fomo_trade" in tag_set:
        what.append("Do not enter during revenge/FOMO state.")
        rules.append("After 2 consecutive losses, pause 30 minutes.")
    if "moved_stop_against_plan" in tag_set:
        what.append("Never widen stop — only trail or tighten per plan.")
    if "early_exit" in tag_set:
        what.append("Scale out only according to predefined target levels.")
    if "large_negative_r" in tag_set:
        what.append("Cut loss at planned stop — do not hold hoping for recovery.")

    for dim in dimensions:
        if dim.score >= 80:
            strengths.append(f"{dim.dimension.replace('_', ' ').title()}: {dim.reason} ({dim.score}/100)")
        elif dim.score < 55:
            weaknesses.append(f"{dim.dimension.replace('_', ' ').title()}: {dim.reason} ({dim.score}/100)")
            if dim.improvement:
                what.append(dim.improvement)

    if not is_open and not trade.review_notes:
        what.append("Journal the trade immediately after exit.")
        questions.append("What would you repeat on the next similar setup?")
        questions.append("What single change would improve the grade?")

    if is_open:
        questions.append("Is current stop still valid vs entry thesis?")
        questions.append("What is the exit trigger if price reverses?")
    else:
        questions.append("Did exit match the plan (stop/target/scale)?")
        questions.append("Was position size appropriate for setup confidence?")

    for t in mistake_tags[:3]:
        if t.severity in ("critical", "warning"):
            questions.append(f"How will you prevent '{t.tag.replace('_', ' ')}' next time?")

    def dedupe(lst: list[str]) -> list[str]:
        out: list[str] = []
        seen_l: set[str] = set()
        for x in lst:
            if x not in seen_l:
                seen_l.add(x)
                out.append(x)
        return out

    return dedupe(strengths), dedupe(weaknesses), dedupe(what), dedupe(rules), dedupe(questions)


def review_trade_v2(db: Session, user_id: int, trade_id: int) -> TradeReviewV2Response:
    """Generate deterministic review for one trade. Read-only."""
    trade = _load_trade(db, user_id, trade_id)
    bundle = _trade_evidence_bundle(db, trade)
    setup_conf_map = _setup_confidence_map(db, user_id)
    setup_conf = setup_conf_map.get(trade.setup or "") or setup_conf_map.get("Uncategorised")

    is_open = trade.exit_price is None
    has_stop = _has_positive_stop(trade.stop_price)
    grade = bundle["execution_grade"]

    dimensions = [
        _score_setup_adherence(trade, grade, setup_conf, bundle["playbook"]),
        _score_entry_quality(trade, grade, bundle["timeline"], has_stop),
        _score_exit_quality(trade, grade, bundle["partial_exits"], is_open),
        _score_risk_discipline(trade, grade, bundle["stop_history"], bundle["partial_exits"], has_stop),
        _score_psychology(trade, grade, bundle["emotion_logs"]),
        _score_playbook_alignment(trade, bundle["playbook"], setup_conf, is_open),
    ]

    overall = _compute_overall(dimensions)
    mistake_tags = _build_mistake_tags(trade, bundle, dimensions, setup_conf, is_open)
    risk_dim = next((d for d in dimensions if d.dimension == "risk_discipline"), None)
    verdict = _determine_verdict(overall, trade, is_open, mistake_tags, risk_dim)

    strengths, weaknesses, what, rules, questions = _build_guidance(
        trade, mistake_tags, dimensions, is_open
    )

    metrics = calculate_trade_metrics(
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        quantity=trade.quantity,
        fees=trade.fees,
        stop_price=trade.stop_price,
        target_price=trade.target_price,
        direction=trade.direction or "LONG",
    )

    evidence_payload = {
        "has_execution_grade": grade is not None,
        "emotion_count": len(bundle["emotion_logs"]),
        "partial_exit_count": len(bundle["partial_exits"]),
        "stop_history_count": len(bundle["stop_history"]),
        "timeline_event_count": len(bundle["timeline"]),
        "setup_confidence_label": setup_conf.get("label") if setup_conf else None,
        "computed_r_multiple": float(metrics.r_multiple) if metrics.r_multiple is not None else None,
    }

    status = "open" if is_open else "closed"
    if trade.status == "deleted":
        status = "deleted"

    return TradeReviewV2Response(
        trade_id=trade.id,
        symbol=trade.symbol,
        setup=trade.setup,
        direction=trade.direction or "LONG",
        status=status,
        reviewed_at=datetime.utcnow().isoformat() + "Z",
        overall_score=overall,
        overall_label=_score_label(overall),
        verdict=verdict,
        dimension_scores=dimensions,
        mistake_tags=mistake_tags,
        strengths=strengths[:5],
        weaknesses=weaknesses[:5],
        what_should_have_happened=what[:8],
        next_time_rules=rules[:6],
        review_questions=questions[:6],
        evidence=evidence_payload,
        source="deterministic_v2",
    )


def summarize_trade_reviews_v2(reviews: list[TradeReviewV2Response]) -> dict:
    if not reviews:
        return {
            "avg_score": 0.0,
            "common_mistakes": [],
            "strongest_dimension": None,
            "weakest_dimension": None,
        }

    avg_score = sum(r.overall_score for r in reviews) / len(reviews)
    tag_counts: Counter[str] = Counter()
    dim_totals: dict[str, list[int]] = defaultdict(list)

    for r in reviews:
        for t in r.mistake_tags:
            tag_counts[t.tag] += 1
        for d in r.dimension_scores:
            if d.dimension in (
                "setup_adherence",
                "entry_quality",
                "exit_quality",
                "risk_discipline",
                "psychology",
            ):
                dim_totals[d.dimension].append(d.score)

    common = [tag for tag, _ in tag_counts.most_common(5)]
    dim_avgs = {k: sum(v) / len(v) for k, v in dim_totals.items() if v}
    strongest = max(dim_avgs, key=dim_avgs.get) if dim_avgs else None
    weakest = min(dim_avgs, key=dim_avgs.get) if dim_avgs else None

    return {
        "avg_score": round(avg_score, 1),
        "common_mistakes": common,
        "strongest_dimension": strongest,
        "weakest_dimension": weakest,
    }


def review_trades_batch_v2(
    db: Session,
    user_id: int,
    limit: int = 20,
    only_closed: bool = True,
) -> TradeReviewBatchResponse:
    q = (
        db.query(Trade)
        .filter(Trade.user_id == user_id, Trade.status != "deleted")
        .order_by(Trade.entry_time.desc())
    )
    if only_closed:
        q = q.filter(Trade.exit_price.isnot(None))

    trades = q.limit(limit).all()
    reviews = [review_trade_v2(db, user_id, t.id) for t in trades]
    summary_dict = summarize_trade_reviews_v2(reviews)

    return TradeReviewBatchResponse(
        generated_at=datetime.utcnow().isoformat() + "Z",
        count=len(reviews),
        reviews=reviews,
        summary=TradeReviewBatchSummary(**summary_dict),
    )
