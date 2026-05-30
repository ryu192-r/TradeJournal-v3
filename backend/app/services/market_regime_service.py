"""Market Regime Intelligence Service.

Deterministic, user-scoped, read-only. Classifies daily market regimes from
existing ``MarketSnapshot`` fields, then correlates closed-trade R-multiples
against those regimes. No new indicators, no LLM scoring.

Confidence tiers match the playbook engine: <20 LOW, 20-49 MEDIUM, 50+ HIGH.
Status rules: expectancy_r > 0.25 -> FAVORABLE, < 0 -> UNFAVORABLE, else NEUTRAL.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.market_snapshot import MarketSnapshot
from app.models.trade import Trade
from app.schemas.market_regime import (
    CurrentRegime,
    MarketRegimeDashboard,
    MarketRegimeType,
    RegimeConfidence,
    RegimePerformance,
    RegimePerformanceResponse,
    RegimeStatus,
    SetupRegimeCell,
    SetupRegimeMatrix,
    SetupRegimeRow,
)

# Classification thresholds (derived from existing snapshot fields only)
HIGH_VIX = 28.0
LOW_VIX = 12.0
HIGH_ATR_PCT = 3.0
BREAKOUT_CHANGE_PCT = 1.5
BREAKOUT_BREADTH = 2.0
REVERSAL_CHANGE_PCT = -1.5
REVERSAL_BREADTH = 0.5
TREND_CHANGE_PCT = 1.0
QUIET_CHANGE_PCT = 0.3

# Status thresholds
FAVORABLE_EXPECTANCY = 0.25

# Confidence sample thresholds
CONFIDENCE_HIGH_N = 50
CONFIDENCE_MEDIUM_N = 20


def _f(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def confidence_from_sample(sample_size: int) -> RegimeConfidence:
    if sample_size >= CONFIDENCE_HIGH_N:
        return RegimeConfidence.HIGH
    if sample_size >= CONFIDENCE_MEDIUM_N:
        return RegimeConfidence.MEDIUM
    return RegimeConfidence.LOW


def status_from_expectancy(expectancy_r: Optional[float]) -> RegimeStatus:
    if expectancy_r is None:
        return RegimeStatus.NEUTRAL
    if expectancy_r > FAVORABLE_EXPECTANCY:
        return RegimeStatus.FAVORABLE
    if expectancy_r < 0:
        return RegimeStatus.UNFAVORABLE
    return RegimeStatus.NEUTRAL


def classify_market_regime(snapshot) -> MarketRegimeType:
    """Classify one daily snapshot into a MarketRegimeType.

    Uses only existing snapshot fields: nifty_trend, nifty_change_pct,
    india_vix, atr_pct, advance_decline_ratio, nifty_close. Returns UNKNOWN
    when there is insufficient data — never invents signals.
    """
    if snapshot is None:
        return MarketRegimeType.UNKNOWN

    trend = (getattr(snapshot, "nifty_trend", None) or "").lower()
    change = _f(getattr(snapshot, "nifty_change_pct", None)) or 0.0
    vix = _f(getattr(snapshot, "india_vix", None)) or 0.0
    atr_pct = _f(getattr(snapshot, "atr_pct", None)) or 0.0
    adr = _f(getattr(snapshot, "advance_decline_ratio", None)) or 0.0
    nifty_close = _f(getattr(snapshot, "nifty_close", None)) or 0.0

    # Insufficient data → UNKNOWN
    if nifty_close == 0 and not trend and change == 0 and vix == 0:
        return MarketRegimeType.UNKNOWN

    # Volatility extreme dominates regardless of direction
    if vix >= HIGH_VIX or atr_pct >= HIGH_ATR_PCT:
        return MarketRegimeType.HIGH_VOLATILITY

    # Breakout: strong directional thrust + broad participation
    if change >= BREAKOUT_CHANGE_PCT and adr >= BREAKOUT_BREADTH:
        return MarketRegimeType.BREAKOUT

    # Reversal: sharp drop with narrow/weak breadth (washout-style)
    if change <= REVERSAL_CHANGE_PCT and 0 < adr < REVERSAL_BREADTH:
        return MarketRegimeType.REVERSAL

    # Directional trend
    if trend == "uptrend" or change >= TREND_CHANGE_PCT:
        return MarketRegimeType.TRENDING_BULL
    if trend == "downtrend" or change <= -TREND_CHANGE_PCT:
        return MarketRegimeType.TRENDING_BEAR

    # Quiet, compressed tape
    if 0 < vix <= LOW_VIX and abs(change) < QUIET_CHANGE_PCT:
        return MarketRegimeType.LOW_VOLATILITY

    # Sideways / muted move
    if trend == "sideways" or abs(change) < TREND_CHANGE_PCT:
        return MarketRegimeType.RANGE_BOUND

    return MarketRegimeType.UNKNOWN


# ─── trade ↔ snapshot matching ──────────────────────────────────


def _user_snapshots(db: Session, user_id: int) -> list[MarketSnapshot]:
    return (
        db.query(MarketSnapshot)
        .filter(MarketSnapshot.user_id == user_id)
        .all()
    )


def _regime_by_date(db: Session, user_id: int) -> dict[date, MarketRegimeType]:
    return {s.date: classify_market_regime(s) for s in _user_snapshots(db, user_id)}


def _closed_trades_with_r(db: Session, user_id: int) -> list[Trade]:
    return (
        db.query(Trade)
        .filter(
            Trade.user_id == user_id,
            Trade.status != "deleted",
            Trade.exit_price.isnot(None),
            Trade.pnl.isnot(None),
            Trade.r_multiple.isnot(None),
        )
        .order_by(Trade.entry_time.asc())
        .all()
    )


def _aggregate_r(r_vals: list[float], pnls: list[float]) -> dict:
    """Aggregate a list of R-multiples into regime/setup performance stats."""
    n = len(r_vals)
    if n == 0:
        return {
            "sample_size": 0, "wins": 0, "losses": 0, "breakeven": 0,
            "win_rate": None, "avg_r": None, "expectancy_r": None,
            "profit_factor": None, "total_pnl": None,
        }

    wins = [r for r in r_vals if r > 0]
    losses = [r for r in r_vals if r < 0]
    breakeven = n - len(wins) - len(losses)

    win_rate = round(len(wins) / n * 100, 1)
    avg_r = round(sum(r_vals) / n, 2)

    avg_winner = sum(wins) / len(wins) if wins else 0.0
    avg_loser = sum(losses) / len(losses) if losses else 0.0
    wr = len(wins) / n
    lr = len(losses) / n
    expectancy_r = round(wr * avg_winner - lr * abs(avg_loser), 2)

    gross_win = sum(wins)
    gross_loss = abs(sum(losses))
    profit_factor = round(gross_win / gross_loss, 2) if gross_loss > 0 else None

    return {
        "sample_size": n,
        "wins": len(wins),
        "losses": len(losses),
        "breakeven": breakeven,
        "win_rate": win_rate,
        "avg_r": avg_r,
        "expectancy_r": expectancy_r,
        "profit_factor": profit_factor,
        "total_pnl": round(sum(pnls), 2) if pnls else None,
    }


# ─── Phase 4: regime performance ────────────────────────────────


def calculate_regime_performance(db: Session, user_id: int) -> RegimePerformanceResponse:
    regime_map = _regime_by_date(db, user_id)
    trades = _closed_trades_with_r(db, user_id)

    buckets: dict[MarketRegimeType, dict[str, list[float]]] = {}
    matched = 0
    for t in trades:
        if not t.entry_time:
            continue
        regime = regime_map.get(t.entry_time.date())
        if regime is None:
            continue
        matched += 1
        b = buckets.setdefault(regime, {"r": [], "pnl": []})
        b["r"].append(float(t.r_multiple))
        if t.pnl is not None:
            b["pnl"].append(float(t.pnl))

    regimes: list[RegimePerformance] = []
    for regime, data in buckets.items():
        agg = _aggregate_r(data["r"], data["pnl"])
        confidence = confidence_from_sample(agg["sample_size"])
        status = status_from_expectancy(agg["expectancy_r"])
        regimes.append(RegimePerformance(
            regime=regime,
            confidence=confidence,
            status=status,
            **agg,
        ))

    regimes.sort(key=lambda r: (r.expectancy_r if r.expectancy_r is not None else -999, r.sample_size), reverse=True)

    favorable = [r.regime for r in regimes if r.status == RegimeStatus.FAVORABLE]
    unfavorable = [r.regime for r in regimes if r.status == RegimeStatus.UNFAVORABLE]

    return RegimePerformanceResponse(
        generated_at=datetime.utcnow().isoformat() + "Z",
        regimes=regimes,
        matched_trades=matched,
        favorable_regimes=favorable,
        unfavorable_regimes=unfavorable,
    )


# ─── Phase 5: setup × regime matrix ─────────────────────────────


def calculate_setup_regime_matrix(db: Session, user_id: int) -> SetupRegimeMatrix:
    regime_map = _regime_by_date(db, user_id)
    trades = _closed_trades_with_r(db, user_id)

    # setup -> regime -> r/pnl lists
    grid: dict[str, dict[MarketRegimeType, dict[str, list[float]]]] = {}
    seen_regimes: set[MarketRegimeType] = set()

    for t in trades:
        if not t.entry_time:
            continue
        regime = regime_map.get(t.entry_time.date())
        if regime is None:
            continue
        setup = t.setup or "Uncategorised"
        seen_regimes.add(regime)
        cell = grid.setdefault(setup, {}).setdefault(regime, {"r": [], "pnl": []})
        cell["r"].append(float(t.r_multiple))
        if t.pnl is not None:
            cell["pnl"].append(float(t.pnl))

    # Stable regime column order
    regime_order = [
        MarketRegimeType.TRENDING_BULL,
        MarketRegimeType.TRENDING_BEAR,
        MarketRegimeType.RANGE_BOUND,
        MarketRegimeType.HIGH_VOLATILITY,
        MarketRegimeType.LOW_VOLATILITY,
        MarketRegimeType.BREAKOUT,
        MarketRegimeType.REVERSAL,
        MarketRegimeType.UNKNOWN,
    ]
    columns = [r for r in regime_order if r in seen_regimes]

    rows: list[SetupRegimeRow] = []
    for setup in sorted(grid.keys()):
        cells: list[SetupRegimeCell] = []
        best: Optional[tuple[MarketRegimeType, float]] = None
        worst: Optional[tuple[MarketRegimeType, float]] = None
        for regime in columns:
            data = grid[setup].get(regime)
            if not data:
                continue
            agg = _aggregate_r(data["r"], data["pnl"])
            cell = SetupRegimeCell(
                regime=regime,
                sample_size=agg["sample_size"],
                avg_r=agg["avg_r"],
                expectancy_r=agg["expectancy_r"],
                win_rate=agg["win_rate"],
                confidence=confidence_from_sample(agg["sample_size"]),
            )
            cells.append(cell)
            exp = agg["expectancy_r"]
            if exp is not None:
                if best is None or exp > best[1]:
                    best = (regime, exp)
                if worst is None or exp < worst[1]:
                    worst = (regime, exp)
        rows.append(SetupRegimeRow(
            setup=setup,
            cells=cells,
            best_regime=best[0] if best else None,
            worst_regime=worst[0] if worst else None,
        ))

    return SetupRegimeMatrix(
        generated_at=datetime.utcnow().isoformat() + "Z",
        regimes=columns,
        rows=rows,
    )


# ─── Phase 7: current regime ────────────────────────────────────


def _data_confidence(snapshot: MarketSnapshot) -> RegimeConfidence:
    """Confidence in the current-regime classification = how many signals exist."""
    signals = 0
    if (snapshot.nifty_trend or "") not in ("", "unknown"):
        signals += 1
    if _f(snapshot.nifty_change_pct) not in (None, 0.0):
        signals += 1
    if _f(snapshot.india_vix):
        signals += 1
    if _f(snapshot.atr_pct):
        signals += 1
    if _f(snapshot.advance_decline_ratio):
        signals += 1
    if signals >= 4:
        return RegimeConfidence.HIGH
    if signals >= 2:
        return RegimeConfidence.MEDIUM
    return RegimeConfidence.LOW


def _regime_reasoning(snapshot: MarketSnapshot, regime: MarketRegimeType) -> list[str]:
    reasons: list[str] = []
    change = _f(snapshot.nifty_change_pct)
    vix = _f(snapshot.india_vix)
    atr_pct = _f(snapshot.atr_pct)
    adr = _f(snapshot.advance_decline_ratio)
    trend = snapshot.nifty_trend

    if trend:
        reasons.append(f"NIFTY trend: {trend}.")
    if change is not None:
        reasons.append(f"NIFTY change: {change:+.2f}%.")
    if vix:
        reasons.append(f"India VIX: {vix:.1f}.")
    if atr_pct:
        reasons.append(f"ATR%: {atr_pct:.2f}.")
    if adr:
        reasons.append(f"Advance/decline ratio: {adr:.2f}.")
    if not reasons:
        reasons.append("Insufficient snapshot data for confident classification.")
    return reasons


def get_current_regime(db: Session, user_id: int) -> Optional[CurrentRegime]:
    snapshot = (
        db.query(MarketSnapshot)
        .filter(MarketSnapshot.user_id == user_id)
        .order_by(desc(MarketSnapshot.date))
        .first()
    )
    if snapshot is None:
        return None

    regime = classify_market_regime(snapshot)

    # Best/worst setup for this regime from the matrix
    best_setup = best_exp = worst_setup = worst_exp = None
    matrix = calculate_setup_regime_matrix(db, user_id)
    for row in matrix.rows:
        for cell in row.cells:
            if cell.regime != regime or cell.expectancy_r is None:
                continue
            if best_exp is None or cell.expectancy_r > best_exp:
                best_exp, best_setup = cell.expectancy_r, row.setup
            if worst_exp is None or cell.expectancy_r < worst_exp:
                worst_exp, worst_setup = cell.expectancy_r, row.setup

    # Status for the active regime = its measured performance status
    perf = calculate_regime_performance(db, user_id)
    status = RegimeStatus.NEUTRAL
    for r in perf.regimes:
        if r.regime == regime:
            status = r.status
            break

    return CurrentRegime(
        regime=regime,
        confidence=_data_confidence(snapshot),
        as_of_date=str(snapshot.date),
        status=status,
        reasoning=_regime_reasoning(snapshot, regime),
        nifty_trend=snapshot.nifty_trend,
        nifty_regime=snapshot.nifty_regime,
        nifty_change_pct=_f(snapshot.nifty_change_pct),
        india_vix=_f(snapshot.india_vix),
        atr_pct=_f(snapshot.atr_pct),
        advance_decline_ratio=_f(snapshot.advance_decline_ratio),
        best_setup=best_setup,
        best_setup_expectancy_r=best_exp,
        worst_setup=worst_setup,
        worst_setup_expectancy_r=worst_exp,
    )


# ─── Dashboard composition ──────────────────────────────────────


def get_market_regime_dashboard(db: Session, user_id: int) -> MarketRegimeDashboard:
    return MarketRegimeDashboard(
        generated_at=datetime.utcnow().isoformat() + "Z",
        current=get_current_regime(db, user_id),
        performance=calculate_regime_performance(db, user_id),
        matrix=calculate_setup_regime_matrix(db, user_id),
    )


# ─── Coaching / recommendation evidence helpers ─────────────────


def get_regime_recommendations(db: Session, user_id: int, min_sample: int = 20) -> list[dict]:
    """Data-only regime recommendations. Emitted only when sample >= min_sample.

    Returns plain dicts (consumed by recommendation/coaching layers) with
    setup, regime, expectancy_r, sample_size, and a message string.
    """
    matrix = calculate_setup_regime_matrix(db, user_id)
    recs: list[dict] = []
    for row in matrix.rows:
        for cell in row.cells:
            if cell.sample_size < min_sample or cell.expectancy_r is None:
                continue
            if cell.expectancy_r < 0:
                recs.append({
                    "setup": row.setup,
                    "regime": cell.regime.value,
                    "expectancy_r": cell.expectancy_r,
                    "sample_size": cell.sample_size,
                    "action": "pause",
                    "message": (
                        f"Pause {row.setup} in {cell.regime.value.replace('_', ' ').lower()} "
                        f"markets — expectancy {cell.expectancy_r:+.2f}R across {cell.sample_size} trades."
                    ),
                })
            elif cell.expectancy_r > FAVORABLE_EXPECTANCY:
                recs.append({
                    "setup": row.setup,
                    "regime": cell.regime.value,
                    "expectancy_r": cell.expectancy_r,
                    "sample_size": cell.sample_size,
                    "action": "focus",
                    "message": (
                        f"Increase focus on {row.setup} during "
                        f"{cell.regime.value.replace('_', ' ').lower()} markets — "
                        f"expectancy {cell.expectancy_r:+.2f}R across {cell.sample_size} trades."
                    ),
                })
    recs.sort(key=lambda r: r["expectancy_r"], reverse=True)
    return recs
