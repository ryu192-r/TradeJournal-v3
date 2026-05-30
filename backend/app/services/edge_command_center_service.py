"""Edge Command Center — compose recommendations, coaching, trade review V2, and workflow."""

from __future__ import annotations

import hashlib
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
    PlaybookEdgeCommandCenter,
    RegimeCommandCenter,
)
from app.schemas.recommendations import RecommendationDashboardResponse, TradingRecommendation
from app.schemas.trade_review_v2 import TradeReviewBatchResponse, TradeReviewV2Response
from app.services.coaching_intelligence_service import (
    get_coaching_intelligence_dashboard,
    get_setup_confidence_scores,
    get_trade_review_prompts,
)
from app.services.recommendation_service import get_recommendation_dashboard
from app.services.setup_edge_service import get_all_setup_edges, get_top_setup_edge, get_weakest_setup_edge
from app.services.trade_review_v2_service import review_trades_batch_v2

logger = logging.getLogger(__name__)

T = TypeVar("T")


def _stable_id(text: str, prefix: str) -> str:
    return f"{prefix}-{hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]}"

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


def _build_setup_focus(
    scores: list[SetupConfidenceScore],
    edge_by_setup: Optional[dict[str, float]] = None,
) -> list[EdgeSetupFocus]:
    edge_by_setup = edge_by_setup or {}
    cards: list[EdgeSetupFocus] = []
    for s in scores[:12]:
        action = _label_to_setup_action(s.label)
        evidence = [
            f"Confidence score {s.score}/100 ({s.label}).",
            f"Sample size: {s.sample_size} closed trade(s).",
        ]
        exp_r = edge_by_setup.get(s.setup)
        if exp_r is not None:
            sign = "+" if exp_r >= 0 else ""
            evidence.append(f"Expectancy: {sign}{exp_r:.2f}R.")
        if s.win_rate is not None:
            evidence.append(f"Win rate: {s.win_rate:.1f}%.")
        if s.avg_r is not None:
            evidence.append(f"Avg R: {s.avg_r:.2f}.")
        reason = s.notes or f"Setup '{s.setup}' is rated {s.label} from recent closed trades."
        if exp_r is not None:
            sign = "+" if exp_r >= 0 else ""
            reason = f"{s.setup} expectancy {sign}{exp_r:.2f}R — {reason}"
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
                id=_stable_id(risk, "rec-risk"),
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


def _inject_regime_priority(
    priorities: list[EdgePriority],
    market_regime: Optional[RegimeCommandCenter],
) -> list[EdgePriority]:
    """Surface the active market regime + best/worst setup as a command-center priority."""
    if market_regime is None:
        return priorities

    regime_label = market_regime.regime.replace("_", " ").title()
    sev = "warning" if market_regime.status == "UNFAVORABLE" else "info"
    evidence = list(market_regime.reasoning[:2])
    if market_regime.best_setup and market_regime.best_setup_expectancy_r is not None:
        evidence.append(
            f"Best: {market_regime.best_setup} ({market_regime.best_setup_expectancy_r:+.2f}R)"
        )
    if market_regime.worst_setup and market_regime.worst_setup_expectancy_r is not None:
        evidence.append(
            f"Avoid: {market_regime.worst_setup} ({market_regime.worst_setup_expectancy_r:+.2f}R)"
        )

    action = "Trade with the regime — lean into your best regime setup."
    if market_regime.best_setup:
        action = f"Favor {market_regime.best_setup} while {regime_label} persists."

    regime_priority = EdgePriority(
        id="market-regime-current",
        title=f"Current regime: {regime_label}",
        category="focus",
        severity=sev,
        summary=(
            f"Market is {regime_label} ({market_regime.confidence} confidence, "
            f"{market_regime.status.lower()} for your edge)."
        ),
        action=action,
        evidence=evidence,
        related_setup=market_regime.best_setup,
        source="derived",
    )
    return [regime_priority] + priorities


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
    playbook_edge: Optional[PlaybookEdgeCommandCenter] = None,
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

    if playbook_edge:
        for name in playbook_edge.focus_setups[:3]:
            focus.append(f"{name}: focus setup — positive R expectancy")
        for name in playbook_edge.pause_setups[:3]:
            avoid.append(f"Pause {name} — negative R expectancy (20+ trades)")

    if playbook_edge and playbook_edge.highest_expectancy and playbook_edge.highest_expectancy.expectancy_r is not None:
        h = playbook_edge.highest_expectancy
        sign = "+" if h.expectancy_r >= 0 else ""
        strengths.append(f"Best edge: {h.setup_name} ({sign}{h.expectancy_r:.2f}R expectancy)")
    if playbook_edge and playbook_edge.lowest_expectancy and playbook_edge.lowest_expectancy.expectancy_r is not None:
        w = playbook_edge.lowest_expectancy
        risks.append(f"Weakest edge: {w.setup_name} ({w.expectancy_r:.2f}R expectancy)")

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

    edge_by_setup: dict[str, float] = {}
    playbook_edge: Optional[PlaybookEdgeCommandCenter] = None
    edge_data, edge_err = _safe_call("playbook_edge", get_all_setup_edges, db, user_id)
    if edge_data:
        edge_by_setup = {
            m.setup_name: m.expectancy_r for m in edge_data.setups if m.expectancy_r is not None
        }
        top, _ = _safe_call("playbook_edge_top", get_top_setup_edge, db, user_id)
        weakest, _ = _safe_call("playbook_edge_weakest", get_weakest_setup_edge, db, user_id)
        playbook_edge = PlaybookEdgeCommandCenter(
            focus_setups=edge_data.focus_setups,
            pause_setups=edge_data.pause_setups,
            highest_expectancy=top,
            lowest_expectancy=weakest,
        )
    elif edge_err:
        notes.append(edge_err)

    # Market regime intelligence (current regime + best/worst setup for it)
    market_regime: Optional[RegimeCommandCenter] = None
    from app.services.market_regime_service import get_current_regime
    current_regime, regime_err = _safe_call("market_regime", get_current_regime, db, user_id)
    if current_regime is not None:
        market_regime = RegimeCommandCenter(
            regime=current_regime.regime.value,
            confidence=current_regime.confidence.value,
            status=current_regime.status.value,
            as_of_date=current_regime.as_of_date,
            reasoning=current_regime.reasoning,
            best_setup=current_regime.best_setup,
            best_setup_expectancy_r=current_regime.best_setup_expectancy_r,
            worst_setup=current_regime.worst_setup,
            worst_setup_expectancy_r=current_regime.worst_setup_expectancy_r,
        )
    elif regime_err:
        notes.append(regime_err)

    prompts: list[TradeReviewPrompt] = []
    if coaching and coaching.top_trade_review_prompts:
        prompts = coaching.top_trade_review_prompts
    else:
        prompts, prompt_err = _safe_call("review_prompts", get_trade_review_prompts, db, user_id, 5)
        if prompt_err:
            notes.append(prompt_err)
        prompts = prompts or []

    setup_focus = _build_setup_focus(setup_scores, edge_by_setup)
    workflow_status = _build_workflow_status(wf)
    seen_trades: set[int] = set()
    review_queue = _build_review_queue(batch, prompts, seen_trades)
    priorities = _build_priorities(recs, coaching, batch, review_queue, workflow_status)
    priorities = _inject_regime_priority(priorities, market_regime)
    summary = _build_summary(priorities, recs, coaching, review_queue, setup_focus, playbook_edge)

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
        playbook_edge=playbook_edge,
        market_regime=market_regime,
    )
