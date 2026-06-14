"""Deterministic Improvement Action suggestion engine.

Scans Process Evidence (journal `rules_violated` + execution grades) over a window
and proposes Improvement Actions in `suggested` status. No AI. Stable dedup so
repeated runs do not create duplicates.

See ADR-025 (Trading Improvement Loop). Suggestions never auto-activate; the user
must approve via `PUT status='active'` or `select-focus`.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date as date_type, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.daily_journal import DailyJournal
from app.models.execution_grade import ExecutionGrade
from app.models.performance_os import ImprovementAction
from app.models.trade import Trade

# ── Defaults ───────────────────────────────────────────────────────────────
DEFAULT_WINDOW_DAYS = 30
RULE_VIOLATION_THRESHOLD = 2  # same rule appears N+ times → suggest
WEAK_GRADE_THRESHOLD = 3      # same dimension graded D/F on N+ trades → suggest
WEAK_GRADES = {"D", "F"}

# ── Rule keyword → contract_type mapping ───────────────────────────────────
# Order matters: first match wins.
RULE_PATTERNS: list[tuple[str, str, str]] = [
    # (regex, contract_type, canonical_kind)
    (r"early\s*entry|chased|chasing", "no_early_entry", "early_entry"),
    (r"overtrad|too\s*many\s*trades?", "max_trades", "overtrading"),
    (r"revenge|after\s*loss|tilt", "cooldown_after_loss", "revenge_trade"),
    (r"moved?\s*stop|widened?\s*stop|stop\s*moved?\s*against", "stop_not_widened", "stop_widened"),
]

# Grade dimension → contract_type mapping
GRADE_DIMENSION_CONTRACTS: dict[str, str] = {
    "rule_adherence": "manual_check",
    "patience": "cooldown_after_loss",
    "stop_quality": "stop_not_widened",
    "exit_quality": "manual_check",
}

# Friendly titles per kind
RULE_TITLES: dict[str, str] = {
    "early_entry": "Stop entering before the trigger",
    "overtrading": "Cap daily trade count",
    "revenge_trade": "Cooldown after a loss",
    "stop_widened": "Do not widen the stop",
}

GRADE_TITLES: dict[str, str] = {
    "rule_adherence": "Improve rule adherence",
    "patience": "Improve entry patience",
    "stop_quality": "Improve stop quality",
    "exit_quality": "Improve exit quality",
}


# ── Helpers ────────────────────────────────────────────────────────────────

def _normalize_token(s: str) -> str:
    """Normalize a rule fragment for stable matching."""
    return re.sub(r"\s+", " ", s.strip().lower())


def _split_violations(text: Optional[str]) -> list[str]:
    """Split a `rules_violated` field into normalized tokens.

    Accepts comma-, semicolon-, or newline-separated free text.
    Empty / None → [].
    """
    if not text:
        return []
    parts = re.split(r"[,;\n]+", text)
    return [_normalize_token(p) for p in parts if p.strip()]


def _classify_rule(token: str) -> tuple[str, str]:
    """Return (contract_type, canonical_kind) for a rule token, or fallback."""
    for pattern, contract, kind in RULE_PATTERNS:
        if re.search(pattern, token):
            return contract, kind
    return "manual_check", f"rule:{token[:50]}"


def _existing_action_keys(db: Session, user_id: int) -> set[tuple[str, str]]:
    """All (contract_type, normalized_title) keys already present (any non-retired status)."""
    rows = db.query(
        ImprovementAction.contract_type,
        ImprovementAction.title,
        ImprovementAction.status,
    ).filter(ImprovementAction.user_id == user_id).all()
    keys: set[tuple[str, str]] = set()
    for contract_type, title, status in rows:
        if status == "retired":
            continue
        keys.add((contract_type, _normalize_token(title)))
    return keys


# ── Scanners ───────────────────────────────────────────────────────────────

def _scan_rule_violations(
    db: Session, user_id: int, since: date_type, window_days: int
) -> list[dict]:
    """Build suggestion payloads from repeated journal rule violations."""
    journals = db.query(DailyJournal).filter(
        DailyJournal.user_id == user_id,
        DailyJournal.date >= since,
        DailyJournal.rules_violated.isnot(None),
    ).all()

    # Group by canonical_kind: count occurrences + collect evidence refs
    grouped: dict[str, dict] = defaultdict(lambda: {
        "occurrences": 0,
        "evidence_refs": [],
        "contract_type": None,
        "raw_tokens": Counter(),
    })

    for j in journals:
        for token in _split_violations(j.rules_violated):
            contract_type, kind = _classify_rule(token)
            g = grouped[kind]
            g["occurrences"] += 1
            g["contract_type"] = contract_type
            g["raw_tokens"][token] += 1
            g["evidence_refs"].append({
                "type": "journal",
                "id": j.id,
                "date": j.date.isoformat() if j.date else None,
                "rule": token,
            })

    suggestions: list[dict] = []
    for kind, g in grouped.items():
        if g["occurrences"] < RULE_VIOLATION_THRESHOLD:
            continue
        title = RULE_TITLES.get(kind) or f"Address rule: {g['raw_tokens'].most_common(1)[0][0]}"
        suggestions.append({
            "title": title,
            "description": (
                f"Detected {g['occurrences']} journal rule violation"
                f"{'s' if g['occurrences'] != 1 else ''} matching '{kind}' "
                f"in the last {window_days} days."
            ),
            "contract_type": g["contract_type"],
            "source_evidence": {
                "type": "rule_violation",
                "kind": kind,
                "occurrences": g["occurrences"],
                "window_days": window_days,
                "evidence_refs": g["evidence_refs"],
            },
        })
    return suggestions


def _scan_execution_grades(
    db: Session, user_id: int, since: date_type, window_days: int
) -> list[dict]:
    """Build suggestion payloads from weak execution grades on recent trades."""
    grades = (
        db.query(ExecutionGrade, Trade)
        .join(Trade, Trade.id == ExecutionGrade.trade_id)
        .filter(
            Trade.user_id == user_id,
            Trade.entry_time >= since,
            Trade.status != "deleted",
        )
        .all()
    )

    # For each tracked dimension, count weak grades + collect trade evidence
    dim_data: dict[str, dict] = defaultdict(lambda: {
        "occurrences": 0,
        "evidence_refs": [],
    })

    for grade, trade in grades:
        for dim in GRADE_DIMENSION_CONTRACTS.keys():
            value = getattr(grade, dim, None)
            if value in WEAK_GRADES:
                d = dim_data[dim]
                d["occurrences"] += 1
                d["evidence_refs"].append({
                    "type": "execution_grade",
                    "trade_id": trade.id,
                    "symbol": trade.symbol,
                    "dimension": dim,
                    "grade": value,
                })

    suggestions: list[dict] = []
    for dim, d in dim_data.items():
        if d["occurrences"] < WEAK_GRADE_THRESHOLD:
            continue
        suggestions.append({
            "title": GRADE_TITLES[dim],
            "description": (
                f"Detected {d['occurrences']} weak {dim} grades (D/F) "
                f"in the last {window_days} days."
            ),
            "contract_type": GRADE_DIMENSION_CONTRACTS[dim],
            "source_evidence": {
                "type": "execution_grade",
                "kind": f"grade:{dim}",
                "occurrences": d["occurrences"],
                "window_days": window_days,
                "evidence_refs": d["evidence_refs"],
            },
        })
    return suggestions


# ── Public API ─────────────────────────────────────────────────────────────

def generate_suggestions(
    db: Session,
    user_id: int,
    window_days: int = DEFAULT_WINDOW_DAYS,
    today: Optional[date_type] = None,
) -> list[ImprovementAction]:
    """Scan evidence and create new `suggested` Improvement Actions.

    Stable dedup: skips suggestions whose (contract_type, normalized_title) already
    exists for the user in any non-retired status.

    Returns the list of newly-created (committed) actions.
    """
    if window_days < 1:
        window_days = 1
    today = today or date_type.today()
    since = today - timedelta(days=window_days)

    candidates: list[dict] = []
    candidates.extend(_scan_rule_violations(db, user_id, since, window_days))
    candidates.extend(_scan_execution_grades(db, user_id, since, window_days))

    existing = _existing_action_keys(db, user_id)
    created: list[ImprovementAction] = []

    for c in candidates:
        key = (c["contract_type"], _normalize_token(c["title"]))
        if key in existing:
            continue
        action = ImprovementAction(
            user_id=user_id,
            title=c["title"],
            description=c["description"],
            status="suggested",
            contract_type=c["contract_type"],
            contract_params={},
            source_evidence=c["source_evidence"],
        )
        db.add(action)
        created.append(action)
        existing.add(key)  # dedup within this run too

    if created:
        db.commit()
        for a in created:
            db.refresh(a)
    return created
