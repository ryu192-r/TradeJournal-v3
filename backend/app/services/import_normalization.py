"""Shared import normalization helpers.

Handles symbol, direction, decimal, datetime normalization for CSV + API imports.
All timestamps stored as naive IST. No UTC double-conversion.
"""

import re
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, Any

IST = timezone(timedelta(hours=5, minutes=30))


def _to_ist_naive(dt: datetime) -> datetime:
    """Convert any datetime to naive IST (strip timezone after converting)."""
    if dt.tzinfo is not None:
        dt = dt.astimezone(IST)
    return dt.replace(tzinfo=None)


# ─── Symbol ─────────────────────────

def normalize_symbol(raw: str) -> str:
    """Trim, upper, remove known exchange prefixes. Reject blank."""
    if not raw:
        raise ValueError("symbol cannot be blank")
    s = raw.strip().upper()
    if not s:
        raise ValueError("symbol cannot be blank")
    prefixes = ("NSE:", "BSE:", "NFO:", "MCX:", "CDS:")
    for p in prefixes:
        if s.startswith(p):
            s = s[len(p):]
            break
    # Keep F&O month/strike if part of symbol (e.g. NIFTY25500CE)
    # Remove trailing descriptors after space if present
    if " " in s:
        s = s.split()[0]
    if not s:
        raise ValueError("symbol cannot be blank")
    return s[:20]


# ─── Direction ─────────────────────────

def normalize_direction(raw: Optional[str]) -> str:
    """Support BUY/SELL/LONG/SHORT. Reject unknown. Default LONG for blank.
    Import callers must explicitly set based on broker context.
    """
    if raw is None:
        return "LONG"
    s = str(raw).strip().upper()
    if s in ("BUY", "LONG"):
        return "LONG"
    if s in ("SELL", "SHORT"):
        raise ValueError("SHORT positions not supported for Indian equities")
    raise ValueError(f"Unknown direction '{raw}' — expected BUY, SELL, LONG")


# ─── Decimal ─────────────────────────

def parse_decimal(raw: Any, field_name: str = "value") -> Optional[Decimal]:
    """Parse optional decimal. Reject negative where field_name is price/qty.
    Returns None for blank input.
    """
    if raw is None:
        return None
    if isinstance(raw, Decimal):
        v = raw
    else:
        s = str(raw).strip().replace(",", "").replace("$", "").replace("₹", "")
        if s == "":
            return None
        try:
            v = Decimal(s)
        except InvalidOperation:
            raise ValueError(f"{field_name} is not a valid number: '{raw}'")
    if field_name in ("entry_price", "exit_price") and v is not None and v <= 0:
        raise ValueError(f"{field_name} must be > 0")
    if field_name == "quantity" and v is not None and v <= 0:
        raise ValueError(f"{field_name} must be > 0")
    if field_name in ("fees", "stop_price", "target_price") and v is not None and v < 0:
        raise ValueError(f"{field_name} must be >= 0")
    return v


# ─── Datetime ─────────────────────────

DATETIME_FORMATS = [
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%d-%m-%Y %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y %H:%M",
    "%d/%m/%Y %H:%M",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d/%m/%y %H:%M:%S",
    "%d/%m/%y %H:%M",
    "%d/%m/%y",
    "%d-%m-%y %H:%M:%S",
    "%d-%m-%y",
]


ISO_TZ_RE = re.compile(r"[+-]\d{2}:\d{2}$")


def parse_datetime(raw: Any, default_to_now: bool = False, field_name: str = "time") -> Optional[datetime]:
    """Parse datetime accepting multiple formats + ISO with timezone.
    Returns naive IST. Rejects unparseable unless default_to_now.
    """
    if raw is None:
        if default_to_now:
            return _to_ist_naive(datetime.now(IST))
        return None

    s = str(raw).strip()
    if not s:
        if default_to_now:
            return _to_ist_naive(datetime.now(IST))
        return None

    # ISO with timezone (e.g. 2024-01-15T09:20:00Z or +05:30)
    if "T" in s:
        try:
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return _to_ist_naive(dt)
        except ValueError:
            pass

    for fmt in DATETIME_FORMATS:
        try:
            dt = datetime.strptime(s, fmt)
            return _to_ist_naive(dt)
        except ValueError:
            continue

    if default_to_now:
        return _to_ist_naive(datetime.now(IST))
    raise ValueError(f"{field_name} unparseable: '{raw}'")


# ─── Row normalizer ─────────────────────────

def normalize_import_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Convert raw CSV/API row dict into validated trade_data dict.
    Raises ValueError with clear message on bad data.
    """
    symbol = normalize_symbol(row.get("symbol", ""))
    direction = normalize_direction(row.get("direction"))

    entry_price = parse_decimal(row.get("entry_price"), field_name="entry_price")
    if entry_price is None:
        raise ValueError("entry_price required")

    quantity = parse_decimal(row.get("quantity"), field_name="quantity")
    if quantity is None:
        raise ValueError("quantity required")

    entry_time = parse_datetime(row.get("entry_time"), default_to_now=False, field_name="entry_time")
    if entry_time is None:
        raise ValueError("entry_time required")

    exit_price = parse_decimal(row.get("exit_price"), field_name="exit_price")
    exit_time = parse_datetime(row.get("exit_time"), default_to_now=False, field_name="exit_time")

    fees = parse_decimal(row.get("fees"), field_name="fees") or Decimal("0")

    # Consistency: closed trade must have both exit_price and exit_time
    if exit_price is not None and exit_time is None:
        raise ValueError("exit_time required when exit_price present")
    if exit_time is not None and exit_price is None:
        raise ValueError("exit_price required when exit_time present")

    if exit_time is not None and entry_time is not None and exit_time < entry_time:
        raise ValueError("exit_time cannot be before entry_time")

    stop_price = parse_decimal(row.get("stop_price"), field_name="stop_price")
    target_price = parse_decimal(row.get("target_price"), field_name="target_price")
    r_multiple = parse_decimal(row.get("r_multiple"), field_name="r_multiple")

    out: Dict[str, Any] = {
        "symbol": symbol,
        "direction": direction,
        "entry_price": entry_price,
        "quantity": quantity,
        "entry_time": entry_time,
        "exit_price": exit_price,
        "exit_time": exit_time,
        "fees": fees,
        "stop_price": stop_price,
        "target_price": target_price,
        "r_multiple": r_multiple,
        "notes": row.get("notes") or None,
        "setup": row.get("setup") or None,
        "tactic": row.get("tactic") or None,
        "tags": row.get("tags") or None,
        "user_id": row.get("user_id"),
    }
    # Forward optional identity fields
    for key in ("import_source", "import_fingerprint", "external_order_id"):
        if key in row and row[key]:
            out[key] = row[key]
    return out
