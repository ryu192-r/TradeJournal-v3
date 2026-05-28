"""Shared trade calculation utilities — single source of truth for P&L, R-multiple, risk/reward.

All functions accept raw values and return computed results with validation.
Direction-aware: LONG and SHORT handled correctly.
Never raises — returns None where calculation is impossible.
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional, List


@dataclass
class TradeCalculationResult:
    risk_per_unit: Optional[Decimal] = None
    reward_per_unit: Optional[Decimal] = None
    risk_amount: Optional[Decimal] = None
    planned_reward_amount: Optional[Decimal] = None
    risk_reward_ratio: Optional[Decimal] = None
    pnl_per_unit: Optional[Decimal] = None
    gross_pnl: Optional[Decimal] = None
    net_pnl: Optional[Decimal] = None
    r_multiple: Optional[Decimal] = None
    is_valid_for_risk_reward: bool = False
    is_valid_for_pnl: bool = False
    warnings: List[str] = field(default_factory=list)


def _safe_decimal(v) -> Optional[Decimal]:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return v
    try:
        return Decimal(str(v))
    except Exception:
        return None


def calculate_trade_metrics(
    entry_price=None,
    exit_price=None,
    quantity=None,
    fees=None,
    stop_price=None,
    target_price=None,
    direction="LONG",
) -> TradeCalculationResult:
    result = TradeCalculationResult()
    warnings: List[str] = []

    entry = _safe_decimal(entry_price)
    exit_ = _safe_decimal(exit_price)
    qty = _safe_decimal(quantity)
    fees_val = _safe_decimal(fees) if fees is not None else Decimal("0")
    stop = _safe_decimal(stop_price)
    target = _safe_decimal(target_price)

    if entry is None or entry <= 0:
        warnings.append("Invalid or missing entry_price")
        result.warnings = warnings
        return result
    if qty is None or qty <= 0:
        warnings.append("Invalid or missing quantity")
        result.warnings = warnings
        return result

    is_long = direction.upper() == "LONG"

    # ── P&L (actual) ──
    if exit_ is not None:
        result.pnl_per_unit = (exit_ - entry) if is_long else (entry - exit_)
        result.gross_pnl = result.pnl_per_unit * qty
        result.net_pnl = result.gross_pnl - fees_val
        result.is_valid_for_pnl = True

    # ── Risk (planned) ──
    if stop is not None:
        if is_long:
            result.risk_per_unit = entry - stop
        else:
            result.risk_per_unit = stop - entry

        if result.risk_per_unit is not None and result.risk_per_unit <= Decimal("0"):
            warnings.append("Stop loss is at or above entry (invalid for risk calculation)")
            result.risk_per_unit = None
        else:
            result.risk_amount = result.risk_per_unit * qty

    # ── Reward (planned) ──
    if target is not None:
        if is_long:
            result.reward_per_unit = target - entry
        else:
            result.reward_per_unit = entry - target

        if result.reward_per_unit is not None and result.reward_per_unit <= Decimal("0"):
            warnings.append("Target price is at or below entry (invalid for reward calculation)")
            result.reward_per_unit = None
        else:
            result.planned_reward_amount = result.reward_per_unit * qty

    # ── Risk:Reward ratio (planned, not actual) ──
    if result.risk_per_unit is not None and result.reward_per_unit is not None:
        if result.risk_per_unit != Decimal("0"):
            result.risk_reward_ratio = result.reward_per_unit / result.risk_per_unit
            result.is_valid_for_risk_reward = True
        else:
            warnings.append("Risk per unit is zero — cannot compute risk:reward ratio")

    # ── R-multiple (actual P&L / planned risk) ──
    if result.net_pnl is not None and result.risk_per_unit is not None and result.risk_per_unit != Decimal("0"):
        result.r_multiple = result.net_pnl / result.risk_amount

    result.warnings = warnings
    return result


def calculate_trade_leg_pnl(
    direction,
    entry_price,
    exit_price,
    quantity,
    fees=Decimal("0"),
) -> Optional[Decimal]:
    """Direction-aware P&L for a single trade leg (partial or full).

    LONG:  (exit - entry) * qty - fees
    SHORT: (entry - exit) * qty - fees

    Fees are subtracted (not allocated) — caller must allocate
    proportional fees before calling.
    """
    entry = _safe_decimal(entry_price)
    exit_ = _safe_decimal(exit_price)
    qty = _safe_decimal(quantity)
    fee = _safe_decimal(fees) if fees is not None else Decimal("0")

    if entry is None or exit_ is None or qty is None:
        return None
    if entry <= 0 or qty <= 0:
        return None

    is_long = (direction or "LONG").upper() == "LONG"
    pnl_per_unit = (exit_ - entry) if is_long else (entry - exit_)
    return (pnl_per_unit * qty) - fee


def compute_pnl_value(
    entry_price,
    exit_price,
    quantity,
    fees=None,
    direction="LONG",
) -> Optional[Decimal]:
    """Simple PnL: (exit - entry) * qty - fees. Returns None if any input is invalid."""
    return calculate_trade_leg_pnl(direction, entry_price, exit_price, quantity, fees)


def compute_r_multiple(net_pnl, risk_amount) -> Optional[Decimal]:
    """R-multiple = actual PnL / planned risk amount."""
    pnl = _safe_decimal(net_pnl)
    risk = _safe_decimal(risk_amount)
    if pnl is None or risk is None or risk == Decimal("0"):
        return None
    return pnl / risk


def compute_live_pnl(
    entry_price,
    ltp,
    quantity,
    remaining_qty=None,
    fees=None,
    direction="LONG",
) -> Optional[Decimal]:
    """Live/paper PnL for open positions using last traded price. Proportionally splits fees."""
    entry = _safe_decimal(entry_price)
    ltp_val = _safe_decimal(ltp)
    qty = _safe_decimal(quantity)
    rem = _safe_decimal(remaining_qty) if remaining_qty is not None else qty
    fee = _safe_decimal(fees) if fees is not None else Decimal("0")

    if entry is None or ltp_val is None or qty is None or rem is None:
        return None
    if qty <= 0:
        return None

    is_long = direction.upper() == "LONG"
    pnl_per_unit = (ltp_val - entry) if is_long else (entry - ltp_val)
    fee_ratio = rem / qty if qty > 0 else Decimal("1")
    return (pnl_per_unit * rem) - (fee * fee_ratio)


def compute_streaks(trades) -> dict:
    """Compute win/loss streak info from a list of trades with pnl attribute."""
    result = {
        "current_type": None,
        "current_count": 0,
        "longest_win": 0,
        "longest_loss": 0,
    }
    current_type = None
    current_count = 0

    for t in trades:
        pnl_val = getattr(t, "pnl", None)
        if pnl_val is None:
            continue
        outcome = "win" if float(pnl_val) > 0 else "loss"
        if outcome == current_type:
            current_count += 1
        else:
            if current_type == "win":
                if current_count > result["longest_win"]:
                    result["longest_win"] = current_count
            elif current_type == "loss":
                if current_count > result["longest_loss"]:
                    result["longest_loss"] = current_count
            current_type = outcome
            current_count = 1

    if current_type == "win":
        if current_count > result["longest_win"]:
            result["longest_win"] = current_count
    elif current_type == "loss":
        if current_count > result["longest_loss"]:
            result["longest_loss"] = current_count

    result["current_type"] = current_type
    result["current_count"] = current_count
    return result


def compute_aggregate_kpis(trades_with_pnl) -> dict:
    """Compute win_rate, profit_factor, expectancy, avg_r from a list of trades that have pnl attribute."""
    closed = [t for t in trades_with_pnl if getattr(t, "pnl", None) is not None]
    if not closed:
        return {
            "trade_count": 0,
            "net_pnl": None,
            "gross_profit": None,
            "gross_loss": None,
            "win_rate": None,
            "profit_factor": None,
            "expectancy": None,
            "avg_r": None,
        }

    pnls = [float(t.pnl) for t in closed]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    r_values = [float(t.r_multiple) for t in closed if getattr(t, "r_multiple", None) is not None]

    trade_count = len(closed)
    win_count = len(wins)
    loss_count = len(losses)
    gross_profit = sum(wins) if wins else 0.0
    gross_loss = abs(sum(losses)) if losses else 0.0
    net_pnl = round(sum(pnls), 2)
    win_rate = round(win_count / trade_count * 100, 1) if trade_count > 0 else None

    profit_factor = None
    if gross_loss > 0:
        profit_factor = round(gross_profit / gross_loss, 2)

    wr = win_rate / 100 if win_rate else 0
    avg_win = gross_profit / win_count if win_count > 0 else 0
    avg_loss = gross_loss / loss_count if loss_count > 0 else 0
    expectancy = round((wr * avg_win) - ((1 - wr) * avg_loss), 2)

    avg_r = round(sum(r_values) / len(r_values), 2) if r_values else None

    return {
        "trade_count": trade_count,
        "net_pnl": net_pnl,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "avg_r": avg_r,
    }
