"""Edge Command Center — compose recommendations, coaching, trade review V2, and workflow."""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any, Callable, Optional, TypeVar

from sqlalchemy.orm import Session

from app.models.performance_os import DailyWorkflow
from app.models.trade import Trade
from app.schemas.coaching_intelligence import (
    CoachingIntelligenceDashboard,
    SetupConfidenceScore,
    TradeReviewPrompt,
    WeeklyCoachingPlan,
)
from app.schemas.edge_command_center import (
    EdgeCommandCenterResponse,
    EdgeCommandCenterSummary,
    EdgeDataQuality,
    EdgePriority,
    EdgeReviewQueueItem,
    EdgeSetupFocus,
    EdgeWorkflowStatus,
)
from app.schemas.recommendations import RecommendationDashboardResponse, TradingRecommendation
from app.schemas.trade_review_v2 import TradeReviewBatchResponse, TradeReviewV2Response
from app.services.coaching_intelligence_service import (
    get_coaching_intelligence_dashboard,
    get_setup_confidence_scores,
    get_trade_review_prompts,
)
from app.services.recommendation_service import get_recommendation_dashboard
from app.services.trade_review_v2_service import review_trades_batch_v2

logger = logging.getLogger(__name__)

T = TypeVar("T")

CRITICAL_MISTAKE_TAGS = frozenset({
    "no_stop", "invalid_stop_side", "rule_break", "revenge_trade", "fomo_trade", "large_negative_r",
})
PHASE_ORDER = ["pre_market", "execution", "review", "behavior"]
PHASE_LABELS = {
    "pre_market": "Pre-market checklist",
    "execution": "Execution phase",
    "review": "Post-market review",
    "behavior": "Behavior review",
}


def _base_trades(db: Session, user_id: int, start: Optional[datetime], end: Optional[datetime]):
    q = db.query(Trade).filter(Trade.user_id == user_id, Trade.status != "deleted")
    if start:
        q = q.filter(Trade.entry_time >= start)
    if end:
        q = q.filter(Trade.entry_time <= end)
    return q


def _safe_call(label: str, fn: Callable[..., T], *args, **kwargs) -> tuple[Optional[T], Optional[str]]:
    try:
        return fn(*args, **kwargs), None
    except Exception as exc:
        logger.warning("edge_command_center_%s_failed: %s", label, exc)
        return None, f"{label} unavailable: {exc}"


def _safe_recommendations(
    db: Session, user_id: int, period_start: Optional[str], period_end: Optional[str],
) -> tuple[Optional[RecommendationDashboardResponse], Optional[str]]:
    return _safe_call(
        "recommendations",
        get_recommendation_dashboard,
        db, user_id, period_start, period_end,
    )


def _safe_coaching(db: Session, user_id: int) -> tuple[Optional[CoachingIntelligenceDashboard], Optional[str]]:
    return _safe_call("coaching", get_coaching_intelligence_dashboard, db, user_id)


def _safe_review_batch(db: Session, user_id: int) -> tuple[Optional[TradeReviewBatchResponse], Optional[str]]:
    return _safe_call("trade_review_v2", review_trades_batch_v2, db, user_id, limit=20, only_closed=True)


def _safe_workflow(db: Session, user_id: int) -> tuple[Optional[DailyWorkflow], Optional[str]]:
    try:
        wf = (
            db.query(DailyWorkflow)
            .filter(DailyWorkflow.user_id == user_id, DailyWorkflow.date == date.today())
            .first()
        )
        return wf, None
    except Exception as exc:
        logger.warning("edge_command_center_workflow_failed: %s", exc)
        return None, f"workflow unavailable: {exc}"


def _label_to_setup_action(label: str) -> str:
    if label in ("priority", "trusted"):
        return "focus"
    if label == "avoid":
        return "avoid"
    if label == "watch":
        return "watch"
    return "develop"


def _setup_action_sort_key(action: str) -> int:
    return {"focus": 0, "avoid": 1, "watch": 2, "develop": 3}.get(action, 4)


def _build_setup_focus(scores: list[SetupConfidenceScore]) -> list[EdgeSetupFocus]:
    cards: list[EdgeSetupFocus] = []
    for s in scores[:12]:
        action = _label_to_setup_action(s.label)
        evidence = [
            f"Confidence score {s.score}/100 ({s.label}).",
            f"Sample size: {s.sample_size} closed trade(s).",
        ]
        if s.win_rate is not None:
            evidence.append(f"Win rate: {s.win_rate:.1f}%.")
        if s.avg_r is not None:
            evidence.append(f"Avg R: {s.avg_r:.2f}.")
        reason = s.notes or f"Setup '{s.setup}' is rated {s.label} from recent closed trades."
        cards.append(EdgeSetupFocus(
            setup=s.setup,
            score=s.score,
            label=s.label,
            action=action,
            reason=reason,
            evidence=evidence,
        ))
    cards.sort(key=lambda c: (_setup_action_sort_key(c.action), -c.score))
    return cards[:6]


def _review_severity(review: TradeReviewV2Response) -> str:
    tags = {t.tag for t in review.mistake_tags}
    if tags & CRITICAL_MISTAKE_TAGS:
        return "critical"
    if review.overall_score < 50:
        return "critical"
    if review.overall_score < 60 or any(t.severity == "warning" for t in review.mistake_tags):
        return "warning"
    return "info"


def _review_reason(review: TradeReviewV2Response) -> str:
    if review.mistake_tags:
        top = review.mistake_tags[0]
        return top.explanation
    if review.overall_score < 60:
        return f"Low execution score ({review.overall_score}/100)."
    return review.verdict.replace("_", " ")


def _build_review_queue(
    batch: Optional[TradeReviewBatchResponse],
    prompts: list[TradeReviewPrompt],
    seen_trade_ids: set[int],
) -> list[EdgeReviewQueueItem]:
    items: list[EdgeReviewQueueItem] = []
    prompt_by_id = {p.trade_id: p for p in prompts}

    if batch:
        for review in batch.reviews:
            tags = [t.tag for t in review.mistake_tags]
            critical_hit = bool(set(tags) & CRITICAL_MISTAKE_TAGS)
            low_score = review.overall_score < 60
            common = batch.summary.common_mistakes if batch.summary else []
            common_hit = any(
                t in common for t in ("no_stop", "rule_break", "revenge_trade", "fomo_trade")
            ) and any(tag in common for tag in tags)
            if not (critical_hit or low_score or common_hit):
                continue
            items.append(EdgeReviewQueueItem(
                trade_id=review.trade_id,
                symbol=review.symbol,
                setup=review.setup,
                reason=_review_reason(review),
                severity=_review_severity(review),
                score=review.overall_score,
                mistake_tags=tags[:6],
            ))
            seen_trade_ids.add(review.trade_id)

    for p in prompts:
        if p.trade_id in seen_trade_ids or len(items) >= 8:
            continue
        items.append(EdgeReviewQueueItem(
            trade_id=p.trade_id,
            symbol=p.symbol,
            setup=p.setup,
            reason=p.why_this_trade or p.prompt,
            severity="warning",
            score=None,
            mistake_tags=p.related_patterns[:4],
        ))
        seen_trade_ids.add(p.trade_id)

    sev_order = {"critical": 0, "warning": 1, "info": 2}
    items.sort(key=lambda i: (sev_order.get(i.severity, 3), i.score if i.score is not None else 100))
    return items[:8]


def _priority_key(p: EdgePriority) -> tuple:
    sev = {"critical": 0, "warning": 1, "info": 2, "positive": 3}.get(p.severity, 4)
    return (sev, p.id)


def _dedupe_priority_key(p: EdgePriority) -> str:
    setup = p.related_setup or ""
    return f"{p.category}:{setup}:{p.title[:40]}"


def _build_priorities(
    recs: Optional[RecommendationDashboardResponse],
    coaching: Optional[CoachingIntelligenceDashboard],
    batch: Optional[TradeReviewBatchResponse],
    review_queue: list[EdgeReviewQueueItem],
    workflow_status: Optional[EdgeWorkflowStatus],
) -> list[EdgePriority]:
    raw: list[EdgePriority] = []

    if batch:
        mistake_counts: Counter[str] = Counter()
        for review in batch.reviews:
            for tag in review.mistake_tags:
                if tag.tag in CRITICAL_MISTAKE_TAGS:
                    mistake_counts[tag.tag] += 1
        for tag, count in mistake_counts.most_common(3):
            raw.append(EdgePriority(
                id=f"v2-risk-{tag}",
                title=f"Critical pattern: {tag.replace('_', ' ')}",
                category="risk",
                severity="critical",
                summary=f"{count} recent trade(s) flagged '{tag.replace('_', ' ')}'.",
                action="Fix this before adding new risk.",
                evidence=[f"Seen in {count} trade review(s)."],
                source="trade_review_v2",
            ))
        if batch.summary and batch.summary.weakest_dimension:
            dim = batch.summary.weakest_dimension.replace("_", " ")
            raw.append(EdgePriority(
                id="v2-weakest-dim",
                title=f"Weakest dimension: {dim}",
                category="review",
                severity="warning",
                summary=f"Batch reviews show {dim} as your weakest execution area.",
                action=f"Focus next session on improving {dim}.",
                evidence=[f"Avg batch score context; weakest: {dim}."],
                source="trade_review_v2",
            ))

    if coaching:
        for drift in coaching.behavioral_drift:
            if drift.severity not in ("critical", "warning"):
                continue
            raw.append(EdgePriority(
                id=f"drift-{drift.id}",
                title=drift.title,
                category="psychology" if "emotion" in drift.metric or "journal" in drift.metric else "risk",
                severity="critical" if drift.severity == "critical" else "warning",
                summary=drift.explanation,
                action=drift.suggested_action,
                evidence=[f"{drift.metric}: {drift.current_value} vs baseline {drift.baseline_value}"],
                related_trade_ids=drift.related_trade_ids[:5],
                source="coaching",
            ))

    if recs:
        sorted_recs = sorted(recs.recommendations, key=lambda r: r.priority_score, reverse=True)
        for rec in sorted_recs[:3]:
            cat = "avoid" if rec.action_type in ("pause_setup", "reduce_size") else "focus"
            if rec.severity == "critical":
                cat = "risk"
            raw.append(EdgePriority(
                id=f"rec-{rec.id}",
                title=rec.title,
                category=cat,
                severity=str(rec.severity.value if hasattr(rec.severity, "value") else rec.severity),
                summary=rec.summary,
                action=rec.suggested_action,
                evidence=[rec.why] + [e.detail or e.metric for e in rec.evidence[:2] if e.detail or e.metric],
                related_trade_ids=rec.related_trade_ids[:5],
                related_setup=rec.related_setup,
                source="recommendation",
            ))
        for risk in recs.summary.risks[:2]:
            raw.append(EdgePriority(
                id=f"rec-risk-{hash(risk) % 10_000}",
                title="Risk watch",
                category="risk",
                severity="warning",
                summary=risk,
                action="Address this risk before increasing size.",
                evidence=[risk],
                source="recommendation",
            ))

    plan: Optional[WeeklyCoachingPlan] = coaching.weekly_plan if coaching else None
    if plan and plan.primary_focus:
        raw.append(EdgePriority(
            id="coach-primary-focus",
            title="Weekly coaching focus",
            category="focus",
            severity="info",
            summary=plan.primary_focus,
            action=plan.priorities[0].action if plan.priorities else plan.primary_focus,
            evidence=[plan.headline] if plan.headline else [],
            source="coaching",
        ))

    if coaching:
        for score in coaching.setup_scores:
            if score.label in ("priority", "trusted"):
                raw.append(EdgePriority(
                    id=f"setup-edge-{score.setup}",
                    title=f"Edge setup: {score.setup}",
                    category="setup",
                    severity="positive",
                    summary=f"{score.setup} is {score.label} ({score.score}/100, n={score.sample_size}).",
                    action="Take only clean A+ versions of this setup.",
                    evidence=[f"Label: {score.label}", f"Score: {score.score}/100"],
                    related_setup=score.setup,
                    source="coaching",
                ))
                break
            if score.label == "avoid":
                raw.append(EdgePriority(
                    id=f"setup-pause-{score.setup}",
                    title=f"Pause setup: {score.setup}",
                    category="avoid",
                    severity="warning",
                    summary=f"{score.setup} is flagged avoid ({score.score}/100).",
                    action="Stop trading this setup until reviewed.",
                    evidence=[f"Sample: {score.sample_size} trades"],
                    related_setup=score.setup,
                    source="coaching",
                ))

    for item in review_queue[:2]:
        raw.append(EdgePriority(
            id=f"review-queue-{item.trade_id}",
            title=f"Review {item.symbol}",
            category="review",
            severity=item.severity,
            summary=item.reason,
            action=f"Open trade #{item.trade_id} and complete review notes.",
            evidence=item.mistake_tags[:3],
            related_trade_ids=[item.trade_id],
            related_setup=item.setup,
            source="trade_review_v2",
        ))

    if workflow_status and not workflow_status.is_complete:
        raw.append(EdgePriority(
            id="workflow-next",
            title="Today's workflow",
            category="workflow",
            severity="info",
            summary=workflow_status.next_step,
            action=workflow_status.next_step,
            evidence=workflow_status.missing_items[:3],
            source="performance_os",
        ))

    if coaching and coaching.next_best_actions:
        raw.append(EdgePriority(
            id="coach-next-action",
            title="Coaching next step",
            category="focus",
            severity="positive",
            summary=coaching.next_best_actions[0],
            action=coaching.next_best_actions[0],
            evidence=coaching.next_best_actions[:2],
            source="coaching",
        ))

    seen_keys: set[str] = set()
    deduped: list[EdgePriority] = []
    for p in sorted(raw, key=_priority_key):
        key = _dedupe_priority_key(p)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(p)
    return deduped[:8]


def _build_workflow_status(wf: Optional[DailyWorkflow]) -> EdgeWorkflowStatus:
    today_str = date.today().isoformat()
    if wf is None:
        return EdgeWorkflowStatus(
            date=today_str,
            phase=None,
            is_complete=False,
            progress_percent=0,
            next_step="Start today's Performance OS workflow",
            missing_items=["Workflow not started"],
        )

    checklist = wf.checklist_items or []
    missing: list[str] = []
    checked = 0
    for item in checklist:
        if isinstance(item, dict):
            label = item.get("label", "Checklist item")
            if not item.get("checked"):
                missing.append(label)
            else:
                checked += 1
        else:
            missing.append(str(item))

    phase_done = [wf.pre_market_done, wf.execution_done, wf.review_done, wf.behavior_done]
    for phase, done in zip(PHASE_ORDER, phase_done):
        if not done:
            missing.append(PHASE_LABELS.get(phase, phase))

    total_units = len(checklist) + len(PHASE_ORDER)
    done_units = checked + sum(1 for d in phase_done if d)
    progress = int(round(done_units / total_units * 100)) if total_units else 0
    is_complete = all(phase_done) and (not checklist or checked == len(checklist))

    next_step = "Complete remaining workflow items"
    if wf.phase in PHASE_ORDER:
        idx = PHASE_ORDER.index(wf.phase)
        if idx < len(PHASE_ORDER) - 1 and not phase_done[idx]:
            next_step = f"Finish {PHASE_LABELS.get(wf.phase, wf.phase)}"
        elif not is_complete:
            next_step = f"Advance to {PHASE_LABELS.get(PHASE_ORDER[min(idx + 1, len(PHASE_ORDER) - 1)], 'next phase')}"

    return EdgeWorkflowStatus(
        date=today_str,
        phase=wf.phase,
        is_complete=is_complete,
        progress_percent=min(100, max(0, progress)),
        next_step=next_step,
        missing_items=missing[:8],
    )


def _build_summary(
    priorities: list[EdgePriority],
    recs: Optional[RecommendationDashboardResponse],
    coaching: Optional[CoachingIntelligenceDashboard],
    review_queue: list[EdgeReviewQueueItem],
    setup_focus: list[EdgeSetupFocus],
) -> EdgeCommandCenterSummary:
    focus: list[str] = []
    avoid: list[str] = []
    review: list[str] = []
    risks: list[str] = []
    strengths: list[str] = []

    for p in priorities:
        if p.category == "focus" and p.severity in ("positive", "info"):
            focus.append(p.summary)
        elif p.category == "avoid":
            avoid.append(p.summary)
        elif p.category == "risk" and p.severity in ("critical", "warning"):
            risks.append(p.summary)
        elif p.category == "review":
            review.append(p.summary)

    if recs:
        focus.extend(recs.summary.focus_this_week[:3])
        avoid.extend(recs.summary.avoid_this_week[:3])
        risks.extend(recs.summary.risks[:3])
        strengths.extend(recs.summary.strengths[:3])

    for s in setup_focus:
        if s.action == "focus":
            focus.append(f"{s.setup}: {s.reason}")
        elif s.action == "avoid":
            avoid.append(f"Stop trading {s.setup} until reviewed.")

    for item in review_queue[:4]:
        review.append(f"{item.symbol}: {item.reason}")

    def dedupe(lst: list[str]) -> list[str]:
        out: list[str] = []
        seen: set[str] = set()
        for x in lst:
            if x and x not in seen:
                seen.add(x)
                out.append(x)
        return out

    return EdgeCommandCenterSummary(
        focus_today=dedupe(focus)[:6],
        avoid_today=dedupe(avoid)[:6],
        review_today=dedupe(review)[:6],
        risk_warnings=dedupe(risks)[:6],
        strengths=dedupe(strengths)[:4],
    )


def _pick_headline(
    priorities: list[EdgePriority],
    closed_trades: int,
    data_quality: EdgeDataQuality,
) -> str:
    if priorities and priorities[0].severity == "critical":
        return priorities[0].title
    if closed_trades < 5:
        return "Build your edge dataset"
    if priorities:
        return priorities[0].title
    if data_quality.has_coaching:
        return "Your command center is warming up"
    return "What should you do now?"


def _pick_primary_focus(priorities: list[EdgePriority], coaching: Optional[CoachingIntelligenceDashboard]) -> str:
    if priorities:
        return priorities[0].summary
    if coaching and coaching.weekly_plan:
        return coaching.weekly_plan.primary_focus
    return "Close and review trades to unlock personalized edge guidance."


def _pick_next_best_action(
    priorities: list[EdgePriority],
    coaching: Optional[CoachingIntelligenceDashboard],
    workflow: Optional[EdgeWorkflowStatus],
) -> str:
    if priorities:
        return priorities[0].action
    if coaching and coaching.next_best_actions:
        return coaching.next_best_actions[0]
    if workflow:
        return workflow.next_step
    return "Log your next trade with setup, stop, and journal context."


def get_edge_command_center(
    db: Session,
    user_id: int,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
) -> EdgeCommandCenterResponse:
    """Compose unified command center. Read-only, no AI, no DB mutation."""
    now = datetime.utcnow()
    end = period_end or now
    start = period_start or (end - timedelta(days=90))

    period_start_str = start.isoformat() + "Z"
    period_end_str = end.isoformat() + "Z"
    period_start_iso = start.date().isoformat() if hasattr(start, "date") else str(start)[:10]
    period_end_iso = end.date().isoformat() if hasattr(end, "date") else str(end)[:10]

    trades = _base_trades(db, user_id, start, end).all()
    closed_trades = [t for t in trades if t.exit_price is not None]
    total = len(trades)
    closed = len(closed_trades)

    notes: list[str] = []
    recs, err = _safe_recommendations(db, user_id, period_start_str, period_end_str)
    if err:
        notes.append(err)
    coaching, err = _safe_coaching(db, user_id)
    if err:
        notes.append(err)
    batch, err = _safe_review_batch(db, user_id)
    if err:
        notes.append(err)
    wf, err = _safe_workflow(db, user_id)
    if err:
        notes.append(err)

    setup_scores: list[SetupConfidenceScore] = []
    if coaching and coaching.setup_scores:
        setup_scores = coaching.setup_scores
    else:
        setup_result, setup_err = _safe_call(
            "setup_scores", get_setup_confidence_scores, db, user_id, start, end,
        )
        setup_scores = setup_result or []
        if setup_err:
            notes.append(setup_err)

    prompts: list[TradeReviewPrompt] = []
    if coaching and coaching.top_trade_review_prompts:
        prompts = coaching.top_trade_review_prompts
    else:
        prompts, prompt_err = _safe_call("review_prompts", get_trade_review_prompts, db, user_id, 5)
        if prompt_err:
            notes.append(prompt_err)
        prompts = prompts or []

    setup_focus = _build_setup_focus(setup_scores)
    workflow_status = _build_workflow_status(wf)
    seen_trades: set[int] = set()
    review_queue = _build_review_queue(batch, prompts, seen_trades)
    priorities = _build_priorities(recs, coaching, batch, review_queue, workflow_status)
    summary = _build_summary(priorities, recs, coaching, review_queue, setup_focus)

    if closed < 5:
        notes.append("Fewer than 5 closed trades in period — guidance is directional, not statistical.")

    data_quality = EdgeDataQuality(
        closed_trades=closed,
        total_trades=total,
        has_recommendations=recs is not None and bool(recs.recommendations),
        has_coaching=coaching is not None,
        has_trade_reviews=batch is not None and batch.count > 0,
        notes=notes,
    )

    headline = _pick_headline(priorities, closed, data_quality)
    primary_focus = _pick_primary_focus(priorities, coaching)
    next_action = _pick_next_best_action(priorities, coaching, workflow_status)

    return EdgeCommandCenterResponse(
        generated_at=now.isoformat() + "Z",
        period_start=period_start_iso,
        period_end=period_end_iso,
        headline=headline,
        primary_focus=primary_focus,
        next_best_action=next_action,
        priorities=priorities,
        setup_focus=setup_focus,
        review_queue=review_queue,
        workflow=workflow_status,
        summary=summary,
        data_quality=data_quality,
    )
