"""Aggregate actionable items from trades, workflow, risk, edge, and coaching."""

from __future__ import annotations

import hashlib
import logging
import re
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.daily_journal import DailyJournal
from app.models.performance_os import ImprovementAction
from app.models.trade import Trade
from app.schemas.actions_inbox import (
    ActionInboxSection,
    ActionItem,
    ActionSeverity,
    ActionsInboxResponse,
    ActionTarget,
    ActionTier,
)
from app.schemas.edge_command_center import EdgeCommandCenterResponse
from app.services.edge_command_center_service import get_edge_command_center
from app.utils.calculations import calculate_trade_metrics, compute_aggregate_kpis
from app.utils.decimal_utils import ensure_decimal

logger = logging.getLogger(__name__)

InterfaceMode = Literal["simple", "pro"]

PRO_PRIORITY_SOURCES = frozenset({"coaching", "recommendation"})
PRO_TYPES = frozenset({"suggestion", "notification"})
MAX_INBOX_ITEMS = 40

SEVERITY_ORDER: dict[str, int] = {"critical": 0, "warning": 1, "info": 2}
_FAR_FUTURE = "9999-12-31T23:59:59Z"


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _slug(text: str, max_len: int = 48) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", (text or "item").lower()).strip("-")
    return (s[:max_len] if s else "item") or "item"


def _stable_hash_id(prefix: str, key: str) -> str:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def _parse_iso(ts: Optional[str]) -> datetime:
    if not ts:
        return datetime.min
    try:
        normalized = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except (TypeError, ValueError):
        return datetime.min


def _sort_items(items: list[ActionItem]) -> list[ActionItem]:
    """Critical first, soonest due first, newest created first."""
    return sorted(
        items,
        key=lambda i: (
            SEVERITY_ORDER.get(i.severity, 9),
            _parse_iso(i.due_at) if i.due_at else datetime.max,
            -_parse_iso(i.created_at).timestamp(),
        ),
    )


def _cap_items(items: list[ActionItem]) -> list[ActionItem]:
    if len(items) <= MAX_INBOX_ITEMS:
        return items
    return _sort_items(items)[:MAX_INBOX_ITEMS]


def _map_operational_severity(sev: str) -> ActionSeverity:
    if sev == "high":
        return "critical"
    if sev == "medium":
        return "warning"
    return "info"


def _map_edge_severity(sev: str) -> ActionSeverity:
    if sev == "critical":
        return "critical"
    if sev in ("warning", "positive"):
        return "warning" if sev == "warning" else "info"
    return "info"


def _trade_created_at(trade: Trade) -> str:
    ts = trade.exit_time or trade.entry_time or datetime.utcnow()
    iso = ts.isoformat()
    return iso + ("Z" if ts.tzinfo is None and not iso.endswith("Z") else "")


def _load_edge(db: Session, user_id: int) -> Optional[EdgeCommandCenterResponse]:
    try:
        return get_edge_command_center(db, user_id)
    except Exception:
        logger.exception("actions_inbox: edge command center unavailable for user %s", user_id)
        return None


def _portfolio_risk_warnings(db: Session, user_id: int) -> list[dict]:
    """Lightweight portfolio risk warnings (aligned with operational dashboard)."""
    from app.models.partial_exit import PartialExit
    from sqlalchemy import func

    account = db.query(Account).filter(Account.user_id == user_id).first()
    if not account:
        return []

    open_trades = (
        db.query(Trade)
        .filter(Trade.user_id == user_id, Trade.status != "deleted", Trade.exit_price.is_(None))
        .all()
    )
    if not open_trades:
        return []

    closed = (
        db.query(Trade)
        .filter(Trade.user_id == user_id, Trade.status != "deleted", Trade.pnl.isnot(None))
        .all()
    )
    kpis = compute_aggregate_kpis(closed)
    net_pnl = Decimal(str(kpis.get("net_pnl") or 0))
    initial = ensure_decimal(account.initial_balance or 0)
    net_equity = initial + net_pnl

    trade_ids = [t.id for t in open_trades]
    pe_map: dict[int, Decimal] = {}
    if trade_ids:
        pe_rows = (
            db.query(PartialExit.trade_id, func.coalesce(func.sum(PartialExit.qty), 0))
            .filter(PartialExit.trade_id.in_(trade_ids))
            .group_by(PartialExit.trade_id)
            .all()
        )
        pe_map = {tid: ensure_decimal(qty) for tid, qty in pe_rows}

    deployed = Decimal("0")
    open_risk = Decimal("0")
    for t in open_trades:
        try:
            exited = pe_map.get(t.id, Decimal("0"))
            rem = ensure_decimal(t.quantity) - exited
            if rem <= 0:
                continue
            deployed += ensure_decimal(t.entry_price) * rem
            if t.stop_price:
                calc = calculate_trade_metrics(
                    entry_price=t.entry_price,
                    quantity=rem,
                    stop_price=t.stop_price,
                    direction=t.direction or "LONG",
                )
                if calc.risk_amount is not None:
                    open_risk += calc.risk_amount
        except (TypeError, ValueError, ArithmeticError):
            continue

    warnings: list[dict] = []
    if net_equity > 0:
        heat_pct = float((open_risk / net_equity) * 100)
        deployed_pct = float((deployed / net_equity) * 100)
        if heat_pct > 6:
            warnings.append({
                "severity": "high",
                "code": "portfolio_heat_high",
                "message": f"Portfolio heat is {round(heat_pct, 1)}%",
                "trade_id": None,
            })
        elif heat_pct > 4:
            warnings.append({
                "severity": "medium",
                "code": "portfolio_heat_elevated",
                "message": f"Portfolio heat is {round(heat_pct, 1)}%",
                "trade_id": None,
            })
        if deployed_pct > 80:
            warnings.append({
                "severity": "medium",
                "code": "capital_deployment_high",
                "message": f"Capital deployment is {round(deployed_pct, 1)}%",
                "trade_id": None,
            })

    for t in open_trades:
        if t.stop_price is None:
            warnings.append({
                "severity": "high",
                "code": "missing_stop",
                "message": f"{t.symbol} has no stop loss",
                "trade_id": t.id,
            })
    return warnings


def _unreviewed_closed_trades(db: Session, user_id: int, limit: int = 15) -> list[Trade]:
    return (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id,
            Trade.status != "deleted",
            Trade.exit_price.isnot(None),
            or_(Trade.review_notes.is_(None), Trade.review_notes == ""),
        )
        .order_by(Trade.exit_time.desc().nullslast(), Trade.entry_time.desc())
        .limit(limit)
        .all()
    )


def _journal_rule_actions(db: Session, user_id: int, created_at: str) -> list[ActionItem]:
    today = date.today()
    journal = (
        db.query(DailyJournal)
        .filter(DailyJournal.user_id == user_id, DailyJournal.date == today)
        .first()
    )
    if not journal or not journal.rules_violated:
        return []
    return [
        ActionItem(
            id=f"journal-rule-{today.isoformat()}",
            type="rule_violation",
            title="Journal rule violation logged",
            description=str(journal.rules_violated)[:500],
            severity="warning",
            status="open",
            source="journal",
            created_at=created_at,
            target=ActionTarget(view="journal"),
            tier="simple",
        )
    ]


def _improvement_focus_reminders(db: Session, user_id: int, created_at: str) -> list[ActionItem]:
    """Reminder-only items for the Improvement Loop (issue #73).

    Read-only — never creates or owns Improvement Actions. Two kinds:
      1. Today's Daily Focus is set + still active → "Focus today" reminder.
      2. Active focus from a past session that was never reviewed (status still
         'active' after its due_session date) → "Overdue review" reminder.

    Both reminders navigate to the Improvement page (view='improvement').
    """
    today = date.today()
    items: list[ActionItem] = []

    today_focus = (
        db.query(ImprovementAction)
        .filter(
            ImprovementAction.user_id == user_id,
            ImprovementAction.is_daily_focus.is_(True),
            ImprovementAction.due_session == today,
            ImprovementAction.status == "active",
        )
        .first()
    )
    if today_focus is not None:
        items.append(ActionItem(
            id=f"improvement-focus-{today_focus.id}-{today.isoformat()}",
            type="focus_reminder",
            title=f"Today's Focus: {today_focus.title}",
            description=(today_focus.description or "Verify the contract at end of session.")[:500],
            severity="info",
            source="improvement",
            created_at=created_at,
            target=ActionTarget(view="improvement"),
            tier="simple",
        ))

    overdue = (
        db.query(ImprovementAction)
        .filter(
            ImprovementAction.user_id == user_id,
            ImprovementAction.is_daily_focus.is_(True),
            ImprovementAction.status == "active",
            ImprovementAction.due_session.isnot(None),
            ImprovementAction.due_session < today,
        )
        .all()
    )
    for action in overdue:
        items.append(ActionItem(
            id=f"improvement-overdue-{action.id}-{action.due_session.isoformat()}",
            type="focus_reminder",
            title=f"Overdue review: {action.title}",
            description=(
                f"Daily Focus from {action.due_session.isoformat()} is still active. "
                "Mark it kept or broken in the Improvement page."
            ),
            severity="warning",
            source="improvement",
            created_at=created_at,
            target=ActionTarget(view="improvement"),
            tier="simple",
        ))

    return items


def _collect_all_items(db: Session, user_id: int) -> list[ActionItem]:
    created_at = _now_iso()
    items: list[ActionItem] = []
    seen_ids: set[str] = set()

    def add(item: ActionItem) -> None:
        if item.id in seen_ids:
            return
        seen_ids.add(item.id)
        items.append(item)

    edge = _load_edge(db, user_id)
    review_trade_ids: set[int] = set()
    if edge is not None:
        review_trade_ids = {i.trade_id for i in (edge.review_queue or [])}

    for trade in _unreviewed_closed_trades(db, user_id):
        if trade.id in review_trade_ids:
            continue
        add(ActionItem(
            id=f"unreviewed-{trade.id}",
            type="trade_review",
            title=f"Review {trade.symbol}",
            description="Closed trade has no review notes yet.",
            severity="warning",
            source="trade",
            related_trade_id=trade.id,
            created_at=_trade_created_at(trade),
            target=ActionTarget(view="trades", trade_id=trade.id),
            tier="simple",
        ))

    if edge is not None:
        for rq in edge.review_queue or []:
            add(ActionItem(
                id=f"review-queue-{rq.trade_id}",
                type="trade_review",
                title=f"{rq.symbol} needs review",
                description=rq.reason or "Scheduled for review",
                severity=_map_edge_severity(rq.severity or "warning"),
                source="review",
                related_trade_id=rq.trade_id,
                created_at=created_at,
                target=ActionTarget(view="review", tab="queue", trade_id=rq.trade_id),
                tier="simple",
            ))

        wf = edge.workflow
        if wf and not wf.is_complete:
            wf_date = wf.date or date.today().isoformat()
            for missing in wf.missing_items or []:
                if not missing:
                    continue
                add(ActionItem(
                    id=f"workflow-missing-{_slug(missing)}-{wf_date}",
                    type="workflow",
                    title=missing,
                    description="Daily Performance OS workflow item incomplete.",
                    severity="warning",
                    source="journal",
                    created_at=created_at,
                    target=ActionTarget(view="perf-os"),
                    tier="simple",
                ))
            next_step = (wf.next_step or "").strip()
            if next_step and next_step != "Complete remaining workflow items":
                add(ActionItem(
                    id=f"workflow-next-{_slug(next_step)}-{wf_date}",
                    type="workflow",
                    title=next_step,
                    description=f"Workflow progress {wf.progress_percent}%",
                    severity="info",
                    source="journal",
                    created_at=created_at,
                    target=ActionTarget(view="perf-os"),
                    tier="simple",
                ))

        summary = edge.summary
        for msg in (summary.risk_warnings if summary else []) or []:
            if not msg:
                continue
            add(ActionItem(
                id=_stable_hash_id("edge-risk", msg),
                type="risk",
                title=msg,
                description="From edge intelligence summary",
                severity="warning",
                source="edge",
                created_at=created_at,
                target=ActionTarget(view="risk"),
                tier="simple",
            ))

        for p in edge.priorities or []:
            tier: ActionTier = "pro" if p.source in PRO_PRIORITY_SOURCES else "simple"
            if p.category in ("review", "risk") and p.severity in ("critical", "warning"):
                tier = "simple"
            action_type = "suggestion"
            if p.category == "risk":
                action_type = "risk"
            elif p.category == "review":
                action_type = "trade_review"
            elif "rule" in (p.title or "").lower() or "violation" in (p.summary or "").lower():
                action_type = "rule_violation"

            trade_id = (p.related_trade_ids or [None])[0] if p.related_trade_ids else None
            view = "edge-center"
            tab = None
            if trade_id:
                view = "trades"
            elif p.category == "review":
                view = "review"
                tab = "queue"
            elif p.source == "coaching":
                view = "coach"
            elif p.source == "recommendation":
                view = "recommendations"

            priority_id = p.id or _stable_hash_id("priority", f"{p.title}:{p.summary}")
            add(ActionItem(
                id=f"priority-{priority_id}",
                type=action_type,
                title=p.title or "Suggested action",
                description=(p.action or p.summary or "")[:500] or None,
                severity=_map_edge_severity(p.severity or "info"),
                source="edge" if p.source in ("derived", "trade_review_v2") else "review",
                related_trade_id=trade_id,
                created_at=created_at,
                target=ActionTarget(view=view, tab=tab, trade_id=trade_id),
                tier=tier,
            ))

        dq = edge.data_quality
        for note in (dq.notes if dq else None) or []:
            if not note:
                continue
            add(ActionItem(
                id=_stable_hash_id("system-note", note),
                type="system",
                title="System notice",
                description=note[:500],
                severity="info",
                source="system",
                created_at=created_at,
                target=ActionTarget(view="settings"),
                tier="pro",
            ))

    for w in _portfolio_risk_warnings(db, user_id):
        code = w.get("code") or _slug(w.get("message", "risk"))
        tid = w.get("trade_id")
        add(ActionItem(
            id=f"risk-{code}" + (f"-{tid}" if tid else ""),
            type="risk",
            title=w.get("message") or "Risk warning",
            description=code,
            severity=_map_operational_severity(w.get("severity") or "medium"),
            source="risk",
            related_trade_id=int(tid) if tid else None,
            created_at=created_at,
            target=ActionTarget(
                view="trades" if tid else "risk",
                trade_id=int(tid) if tid else None,
            ),
            tier="simple",
        ))

    for item in _journal_rule_actions(db, user_id, created_at):
        add(item)

    for item in _improvement_focus_reminders(db, user_id, created_at):
        add(item)

    return items


def _filter_by_mode(items: list[ActionItem], mode: InterfaceMode) -> list[ActionItem]:
    if mode == "pro":
        return items
    return [i for i in items if i.tier == "simple" and i.type not in PRO_TYPES]


def _build_sections(items: list[ActionItem]) -> list[ActionInboxSection]:
    order = [
        ("focus_reminder", "Improvement loop"),
        ("trade_review", "Pending trade reviews"),
        ("workflow", "Daily workflow"),
        ("journal", "Journal"),
        ("risk", "Risk warnings"),
        ("rule_violation", "Rule violations"),
        ("suggestion", "Suggested actions"),
        ("notification", "Insights"),
        ("system", "System"),
    ]
    by_type: dict[str, list[ActionItem]] = defaultdict(list)
    for item in items:
        if item.status == "open":
            by_type[item.type].append(item)

    sections: list[ActionInboxSection] = []
    for type_id, title in order:
        group = _sort_items(by_type.get(type_id, []))
        if group:
            sections.append(ActionInboxSection(id=type_id, title=title, items=group))
    return sections


def get_actions_inbox(
    db: Session,
    user_id: int,
    interface_mode: InterfaceMode = "simple",
) -> ActionsInboxResponse:
    """Single source of truth for open actionable items."""
    all_items = _collect_all_items(db, user_id)
    filtered = _filter_by_mode(all_items, interface_mode)
    open_items = _sort_items(_cap_items([i for i in filtered if i.status == "open"]))
    return ActionsInboxResponse(
        generated_at=_now_iso(),
        interface_mode=interface_mode,
        open_count=len(open_items),
        items=open_items,
        sections=_build_sections(open_items),
    )
