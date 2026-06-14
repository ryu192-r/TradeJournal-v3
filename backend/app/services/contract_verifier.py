"""Deterministic Behavior Contract verifier for Daily Focus Actions.

Evaluates the selected Verifiable Behavior Contract on a trading session and
preselects `kept` / `broken` / `manual` (manual_check). The user confirms or
overrides the result via PUT status. See ADR-025 (Trading Improvement Loop).

Contracts:
    no_early_entry      params: {not_before: "HH:MM", exceptions?: [...]}
    max_trades          params: {max: int}
    cooldown_after_loss params: {minutes: int}
    stop_not_widened    params: {} (any widening = broken)
    manual_check        params: {} (always returns "manual")
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date as date_type, datetime, time as time_type, timedelta
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.performance_os import ImprovementAction
from app.models.stop_history import StopHistory
from app.models.trade import Trade
from app.utils.trade_dates import get_trade_session_date


# Result strings — mirror lifecycle status values where applicable.
RESULT_KEPT = "kept"
RESULT_BROKEN = "broken"
RESULT_MANUAL = "manual"  # not a status; UI must collect user confirmation


@dataclass
class VerificationResult:
    """Preselected verification outcome with Result Evidence.

    `result`: "kept" | "broken" | "manual"
    `evidence`: contract-specific evidence dict (always JSON-safe).
    `summary`: short human-readable string for UI.
    `requires_confirmation`: True when result is "manual" (always for manual_check).
    """
    result: str
    summary: str
    evidence: dict = field(default_factory=dict)
    requires_confirmation: bool = False

    def to_dict(self) -> dict:
        return {
            "result": self.result,
            "summary": self.summary,
            "evidence": self.evidence,
            "requires_confirmation": self.requires_confirmation,
        }


# ── Helpers ───────────────────────────────────────────────────────────────

def _trades_for_session(db: Session, user_id: int, session: date_type) -> list[Trade]:
    """All non-deleted trades placed on the given session date, ordered by entry_time."""
    candidates = db.query(Trade).filter(
        Trade.user_id == user_id,
        Trade.status != "deleted",
    ).all()
    on_session = [t for t in candidates if get_trade_session_date(t) == session]
    on_session.sort(key=lambda t: t.entry_time or datetime.min)
    return on_session


def _parse_hhmm(s: Any) -> Optional[time_type]:
    if not isinstance(s, str):
        return None
    try:
        h, m = s.split(":")
        return time_type(int(h), int(m))
    except (ValueError, AttributeError):
        return None


def _trade_ref(t: Trade) -> dict:
    return {
        "trade_id": t.id,
        "symbol": t.symbol,
        "entry_time": t.entry_time.isoformat() if t.entry_time else None,
    }


def _is_loss(t: Trade) -> bool:
    if t.pnl is None:
        return False
    try:
        return Decimal(str(t.pnl)) < 0
    except Exception:
        return False


# ── Per-contract verifiers ────────────────────────────────────────────────

def _verify_no_early_entry(
    db: Session, action: ImprovementAction, session: date_type
) -> VerificationResult:
    params = action.contract_params or {}
    not_before = _parse_hhmm(params.get("not_before"))
    exceptions = params.get("exceptions") or []

    if not_before is None:
        return VerificationResult(
            result=RESULT_MANUAL,
            summary="No 'not_before' time configured — please confirm manually.",
            evidence={"reason": "missing_param: not_before"},
            requires_confirmation=True,
        )

    trades = _trades_for_session(db, action.user_id, session)
    violations = []
    for t in trades:
        if not t.entry_time:
            continue
        entry_clock = t.entry_time.time()
        if entry_clock < not_before:
            # Exceptions allow entries after a softer window with a captured reason.
            allowed = False
            for ex in exceptions:
                ex_after = _parse_hhmm(ex.get("after") if isinstance(ex, dict) else None)
                if ex_after is not None and entry_clock >= ex_after:
                    allowed = True
                    break
            if not allowed:
                violations.append({
                    **_trade_ref(t),
                    "entry_clock": entry_clock.strftime("%H:%M"),
                })

    if violations:
        return VerificationResult(
            result=RESULT_BROKEN,
            summary=f"{len(violations)} trade(s) entered before {not_before.strftime('%H:%M')}.",
            evidence={
                "not_before": not_before.strftime("%H:%M"),
                "violations": violations,
                "checks_performed": len(trades),
            },
        )
    return VerificationResult(
        result=RESULT_KEPT,
        summary=f"All {len(trades)} entr{'y' if len(trades) == 1 else 'ies'} respected the {not_before.strftime('%H:%M')} cutoff.",
        evidence={
            "not_before": not_before.strftime("%H:%M"),
            "checks_performed": len(trades),
        },
    )


def _verify_max_trades(
    db: Session, action: ImprovementAction, session: date_type
) -> VerificationResult:
    params = action.contract_params or {}
    max_allowed = params.get("max")
    if not isinstance(max_allowed, int) or max_allowed < 0:
        return VerificationResult(
            result=RESULT_MANUAL,
            summary="No 'max' trade count configured — please confirm manually.",
            evidence={"reason": "missing_param: max"},
            requires_confirmation=True,
        )

    trades = _trades_for_session(db, action.user_id, session)
    count = len(trades)
    if count > max_allowed:
        return VerificationResult(
            result=RESULT_BROKEN,
            summary=f"{count} trades placed — limit was {max_allowed}.",
            evidence={
                "max": max_allowed,
                "count": count,
                "trades": [_trade_ref(t) for t in trades],
            },
        )
    return VerificationResult(
        result=RESULT_KEPT,
        summary=f"{count} of {max_allowed} trades — under cap.",
        evidence={
            "max": max_allowed,
            "count": count,
            "trades": [_trade_ref(t) for t in trades],
        },
    )


def _verify_cooldown_after_loss(
    db: Session, action: ImprovementAction, session: date_type
) -> VerificationResult:
    params = action.contract_params or {}
    minutes = params.get("minutes")
    if not isinstance(minutes, int) or minutes <= 0:
        return VerificationResult(
            result=RESULT_MANUAL,
            summary="No 'minutes' cooldown configured — please confirm manually.",
            evidence={"reason": "missing_param: minutes"},
            requires_confirmation=True,
        )

    trades = _trades_for_session(db, action.user_id, session)
    cooldown = timedelta(minutes=minutes)
    violations = []
    for prev in trades:
        if not _is_loss(prev) or prev.exit_time is None:
            continue
        # Check entries after this loss closed
        for nxt in trades:
            if nxt.id == prev.id or nxt.entry_time is None:
                continue
            if nxt.entry_time <= prev.exit_time:
                continue
            gap = nxt.entry_time - prev.exit_time
            if gap < cooldown:
                violations.append({
                    "loss_trade": _trade_ref(prev),
                    "next_trade": _trade_ref(nxt),
                    "gap_minutes": int(gap.total_seconds() // 60),
                })
                break  # one violation per loss is enough to mark broken

    if violations:
        return VerificationResult(
            result=RESULT_BROKEN,
            summary=f"{len(violations)} entry(ies) opened within {minutes}-minute cooldown after a loss.",
            evidence={
                "minutes": minutes,
                "violations": violations,
                "checks_performed": len(trades),
            },
        )
    return VerificationResult(
        result=RESULT_KEPT,
        summary=f"All entries respected the {minutes}-minute cooldown after losses.",
        evidence={
            "minutes": minutes,
            "checks_performed": len(trades),
        },
    )


def _verify_stop_not_widened(
    db: Session, action: ImprovementAction, session: date_type
) -> VerificationResult:
    trades = _trades_for_session(db, action.user_id, session)
    if not trades:
        return VerificationResult(
            result=RESULT_KEPT,
            summary="No trades placed — nothing could widen.",
            evidence={"checks_performed": 0},
        )

    violations = []
    checks = 0
    for t in trades:
        entry = t.entry_price
        if entry is None:
            continue
        history = (
            db.query(StopHistory)
            .filter(StopHistory.trade_id == t.id)
            .order_by(StopHistory.timestamp.asc())
            .all()
        )
        if not history:
            continue
        checks += 1
        # Initial baseline: explicit "initial" entry, else first entry, else original_stop_price.
        initial_price: Optional[Decimal] = None
        for h in history:
            if h.stop_type == "initial" and h.price is not None:
                initial_price = Decimal(str(h.price))
                break
        if initial_price is None and history[0].price is not None:
            initial_price = Decimal(str(history[0].price))
        if initial_price is None and t.original_stop_price is not None:
            initial_price = Decimal(str(t.original_stop_price))
        if initial_price is None:
            continue

        entry_dec = Decimal(str(entry))
        # LONG: stop is below entry. Farther from entry = lower price = widening.
        # Use signed distance: entry - stop. Larger value = wider risk.
        baseline_distance = entry_dec - initial_price
        for h in history:
            if h.price is None:
                continue
            new_distance = entry_dec - Decimal(str(h.price))
            if new_distance > baseline_distance:
                violations.append({
                    **_trade_ref(t),
                    "initial_stop": str(initial_price),
                    "widened_stop": str(h.price),
                    "stop_type": h.stop_type,
                    "timestamp": h.timestamp.isoformat() if h.timestamp else None,
                })
                break

    if violations:
        return VerificationResult(
            result=RESULT_BROKEN,
            summary=f"{len(violations)} trade(s) had the stop widened from initial.",
            evidence={"violations": violations, "checks_performed": checks},
        )
    return VerificationResult(
        result=RESULT_KEPT,
        summary=f"No stops widened across {checks} trade(s) with stop history.",
        evidence={"checks_performed": checks},
    )


def _verify_manual_check(
    db: Session, action: ImprovementAction, session: date_type
) -> VerificationResult:
    return VerificationResult(
        result=RESULT_MANUAL,
        summary="Manual check — confirm whether the action was kept or broken.",
        evidence={},
        requires_confirmation=True,
    )


# ── Dispatch ───────────────────────────────────────────────────────────────

_VERIFIERS = {
    "no_early_entry": _verify_no_early_entry,
    "max_trades": _verify_max_trades,
    "cooldown_after_loss": _verify_cooldown_after_loss,
    "stop_not_widened": _verify_stop_not_widened,
    "manual_check": _verify_manual_check,
}


def verify_contract(
    db: Session,
    action: ImprovementAction,
    session: Optional[date_type] = None,
) -> VerificationResult:
    """Evaluate the contract on the action's due_session (or the given session).

    Does NOT mutate the action; the caller persists kept/broken via PUT.
    """
    target_date = session or action.due_session
    if target_date is None:
        return VerificationResult(
            result=RESULT_MANUAL,
            summary="No due session set — confirm manually.",
            evidence={"reason": "missing_due_session"},
            requires_confirmation=True,
        )
    verifier = _VERIFIERS.get(action.contract_type)
    if verifier is None:
        return VerificationResult(
            result=RESULT_MANUAL,
            summary=f"Unknown contract type '{action.contract_type}' — confirm manually.",
            evidence={"contract_type": action.contract_type},
            requires_confirmation=True,
        )
    return verifier(db, action, target_date)
