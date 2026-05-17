"""Broker-specific CSV parsers for trade import.

Supported brokers:
- zerodha: Zerodha Console P&L export (CSV)
- dhan: Dhan tradebook export (CSV)
- generic: App's own CSV template format

Each parser normalizes broker CSV into a common dict format that maps
to our Trade model fields.
"""
import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple


def _to_decimal(s: str) -> Optional[Decimal]:
    s = s.strip().replace(",", "")
    if not s:
        return None
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _to_datetime(s: str) -> Optional[datetime]:
    s = s.strip()
    if not s:
        return None
    for fmt in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",
        "%d-%m-%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
    ]:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _clean_symbol(raw: str) -> str:
    s = raw.strip().upper()
    if not s:
        return s
    prefixes = ["NSE:", "BSE:", "NFO:", "MCX:", "CDS:"]
    for p in prefixes:
        if s.startswith(p):
            s = s[len(p):]
            break
    if " " in s:
        s = s.split()[0]
    return s[:20]


# ───────────────────────── Zerodha Console P&L CSV ─────────────────────────

ZERODHA_HEADERS = [
    "symbol", "entry_price", "quantity", "entry_time",
    "exit_price", "exit_time", "fees", "setup", "tactic",
    "stop_price", "target_price", "r_multiple", "status", "notes",
]


def parse_zerodha_csv(content: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse Zerodha Console P&L CSV export.

    Zerodha P&L CSV columns (typical):
        Symbol, Category, Trade Type, Buy Date, Sell Date,
        Buy Qty, Sell Qty, Buy Rate, Sell Rate, P&L, % Return,
        Brokerage (STT+exchange+other)

    Each row is a closed position. Open positions may appear with
    empty sell fields.
    """
    errors: List[str] = []
    rows: List[Dict[str, str]] = []

    try:
        reader = csv.DictReader(io.StringIO(content))
    except Exception as e:
        return ([f"Failed to parse CSV: {e}"], [])

    if not reader.fieldnames:
        return (["CSV file is empty or has no headers"], [])

    headers = [h.strip().lower() for h in reader.fieldnames]

    col_map = _detect_zerodha_columns(headers)
    if not col_map:
        return (["Unrecognised Zerodha CSV format — missing required columns"], [])

    for i, raw in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw.items() if k}

        try:
            normalized = _normalize_zerodha_row(row, col_map, i)
            if normalized:
                rows.append(normalized)
        except ValueError as e:
            errors.append(str(e))

    return (errors, rows)


def _detect_zerodha_columns(headers: List[str]) -> Optional[Dict[str, str]]:
    """Map lowercase headers to canonical Zerodha column names."""
    mapping: Dict[str, str] = {}

    candidates = {
        "symbol": ["symbol", "scrip", "instrument", "stock", "contract", "name"],
        "buy_date": ["buy date", "buy_date", "entry date", "entry_date", "buy time", "entry time"],
        "sell_date": ["sell date", "sell_date", "exit date", "exit_date", "sell time", "exit time"],
        "buy_qty": ["buy qty", "buy_qty", "buy quantity", "entry qty", "entry_quantity", "qty"],
        "sell_qty": ["sell qty", "sell_qty", "sell quantity"],
        "buy_rate": ["buy rate", "buy_rate", "buy price", "buy_price", "entry price", "entry_price", "avg buy price", "avg. buy price"],
        "sell_rate": ["sell rate", "sell_rate", "sell price", "sell_price", "exit price", "exit_price", "avg sell price", "avg. sell price"],
        "pnl": ["p&l", "pnl", "profit/loss", "profit", "net pnl", "realized pnl"],
        "brokerage": ["brokerage", "charges", "stt", "total charges", "commission"],
    }

    for canon, aliases in candidates.items():
        for h in headers:
            for alias in aliases:
                if h == alias or h.startswith(alias):
                    mapping[canon] = h
                    break
            if canon in mapping:
                break

    if "symbol" not in mapping:
        return None
    if "buy_qty" not in mapping and "sell_qty" not in mapping:
        return None
    if "buy_rate" not in mapping:
        return None

    return mapping


def _normalize_zerodha_row(
    row: Dict[str, str], col_map: Dict[str, str], line: int
) -> Optional[Dict[str, str]]:
    symbol = _clean_symbol(row.get(col_map.get("symbol", ""), ""))
    if not symbol:
        raise ValueError(f"Row {line}: empty symbol")

    entry_price = _to_decimal(row.get(col_map.get("buy_rate", ""), ""))
    if entry_price is None or entry_price <= 0:
        raise ValueError(f"Row {line}: invalid entry_price")

    qty_str = row.get(col_map.get("buy_qty", ""), "") or row.get(col_map.get("sell_qty", ""), "")
    quantity = _to_decimal(qty_str) if qty_str else Decimal("0")
    if quantity is None or quantity <= 0:
        raise ValueError(f"Row {line}: invalid quantity")

    entry_time = _to_datetime(row.get(col_map.get("buy_date", ""), ""))
    if not entry_time:
        entry_time = datetime.now()

    exit_price = _to_decimal(row.get(col_map.get("sell_rate", ""), ""))
    exit_time = _to_datetime(row.get(col_map.get("sell_date", ""), ""))

    fees = _to_decimal(row.get(col_map.get("brokerage", ""), "")) or Decimal("0")

    return {
        "symbol": symbol,
        "direction": "LONG",
        "entry_price": str(entry_price),
        "quantity": str(quantity),
        "entry_time": entry_time.isoformat(),
        "exit_price": str(exit_price) if exit_price else "",
        "exit_time": exit_time.isoformat() if exit_time else "",
        "fees": str(fees),
        "setup": "",
        "tactic": "",
        "stop_price": "",
        "target_price": "",
        "r_multiple": "",
        "status": "open",
        "notes": "",
    }


# ───────────────────────── Dhan tradebook CSV ─────────────────────────

def parse_dhan_csv(content: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse Dhan tradebook CSV export.

    Dhan CSV columns:
        Date (DD/MM/YY), Time (HH:MM:SS), Name, Buy/Sell,
        Order, Exchange, Segment, Quantity/Lot, Trade Price,
        Trade Value, Status

    Same stock may appear multiple times (multiple legs).
    We pair BUY+SELL legs that share the same Name on the same date.
    Trailing empty rows are skipped.
    """
    errors: List[str] = []
    all_rows: List[Dict[str, str]] = []

    try:
        reader = csv.DictReader(io.StringIO(content))
    except Exception as e:
        return ([f"Failed to parse CSV: {e}"], [])

    if not reader.fieldnames:
        return (["CSV file is empty or has no headers"], [])

    headers = [h.strip().lower() for h in reader.fieldnames if h and h.strip()]

    col_map = _detect_dhan_columns(headers)
    if not col_map:
        return (["Unrecognised Dhan CSV format — missing required columns. "
                  "Expected: Date, Time, Name, Buy/Sell, Quantity/Lot, Trade Price"], [])

    for i, raw in enumerate(reader, start=2):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw.items() if k and k.strip()}

        if not row.get(col_map.get("symbol", ""), "").strip():
            continue

        try:
            normalized = _normalize_dhan_row(row, col_map, i)
            if normalized:
                all_rows.append(normalized)
        except ValueError as e:
            errors.append(str(e))

    if not all_rows:
        return (errors or ["No valid rows found in CSV"], [])

    paired = _pair_dhan_legs(all_rows)
    return (errors, paired)


def _detect_dhan_columns(headers: List[str]) -> Optional[Dict[str, str]]:
    mapping: Dict[str, str] = {}

    candidates = {
        "symbol": ["name", "symbol", "trading symbol", "trading_symbol", "scrip", "instrument", "contract", "stock name", "company"],
        "trade_type": ["buy/sell", "buy sell", "buy_sell", "trade type", "trade_type", "side", "direction", "transaction type", "transaction_type", "action"],
        "quantity": ["quantity/lot", "quantity_lot", "quantity", "qty", "traded qty", "traded_quantity", "fill quantity", "lot size"],
        "price": ["trade price", "trade_price", "price", "traded price", "traded_price", "rate", "avg. price", "avg price", "execution price", "fill price", "ltp"],
        "date": ["date", "trade date", "trade_date", "order date", "order_date"],
        "time": ["time", "trade time", "trade_time", "order time", "order_time"],
        "exchange": ["exchange"],
        "segment": ["segment"],
        "order_type": ["order"],
        "trade_value": ["trade value", "trade_value", "value"],
        "status": ["status"],
    }

    for canon, aliases in candidates.items():
        for h in headers:
            for alias in aliases:
                if h == alias:
                    mapping[canon] = h
                    break
            if canon in mapping:
                break

    required = ["symbol", "quantity", "price"]
    if not all(r in mapping for r in required):
        return None
    return mapping


def _parse_dhan_date(date_str: str, time_str: str) -> Optional[datetime]:
    date_str = date_str.strip()
    time_str = time_str.strip()
    if not date_str:
        return None

    for fmt in [
        "%d/%m/%y",
        "%d/%m/%Y",
        "%d-%m-%y",
        "%d-%m-%Y",
        "%Y-%m-%d",
    ]:
        try:
            d = datetime.strptime(date_str, fmt)
            break
        except ValueError:
            continue
    else:
        return None

    if time_str:
        for tfmt in ["%H:%M:%S", "%H:%M"]:
            try:
                t = datetime.strptime(time_str, tfmt)
                return d.replace(hour=t.hour, minute=t.minute, second=t.second)
            except ValueError:
                continue
    return d


def _normalize_dhan_row(
    row: Dict[str, str], col_map: Dict[str, str], line: int
) -> Optional[Dict[str, str]]:
    symbol = _clean_symbol(row.get(col_map.get("symbol", ""), ""))
    if not symbol:
        raise ValueError(f"Row {line}: empty symbol")

    side_raw = row.get(col_map.get("trade_type", ""), "BUY").upper().strip()
    side = "BUY" if side_raw in ("BUY", "LONG") else "SELL"

    quantity = _to_decimal(row.get(col_map.get("quantity", ""), ""))
    if quantity is None or quantity <= 0:
        raise ValueError(f"Row {line}: invalid quantity")

    price = _to_decimal(row.get(col_map.get("price", ""), ""))
    if price is None or price <= 0:
        raise ValueError(f"Row {line}: invalid price")

    date_str = row.get(col_map.get("date", ""), "")
    time_str = row.get(col_map.get("time", ""), "")
    dt = _parse_dhan_date(date_str, time_str)
    if not dt:
        dt = datetime.now()

    fees = _to_decimal(row.get(col_map.get("brokerage", ""), "")) or Decimal("0")

    return {
        "symbol": symbol,
        "side": side,
        "quantity": str(quantity),
        "price": str(price),
        "date": dt.isoformat(),
        "order_id": row.get(col_map.get("order_type", ""), "") or f"dhan-{line}",
        "fees": str(fees),
        "_line": str(line),
    }


def _pair_dhan_legs(legs: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Pair BUY/SELL legs into trades. All trades are LONG (Indian equities).
    
    Pairing strategy: For each stock on a given date, match the first BUY
    with the first SELL. Unmatched BUYs become open trades.
    Unmatched SELLs are skipped (shouldn't happen in normal flow).
    """
    from collections import defaultdict

    by_symbol_date: Dict[str, List[Dict[str, str]]] = defaultdict(list)
    for leg in legs:
        date_part = leg["date"][:10]
        key = f"{leg['symbol']}|{date_part}"
        by_symbol_date[key].append(leg)

    trades: List[Dict[str, str]] = []
    for _key, group in by_symbol_date.items():
        buys = [l for l in group if l["side"] == "BUY"]
        sells = [l for l in group if l["side"] == "SELL"]

        pairs = min(len(buys), len(sells))

        for i in range(pairs):
            buy = buys[i]
            sell = sells[i]
            total_fees = str(Decimal(buy.get("fees", "0")) + Decimal(sell.get("fees", "0")))
            trades.append({
                "symbol": buy["symbol"],
                "direction": "LONG",
                "entry_price": buy["price"],
                "quantity": buy["quantity"],
                "entry_time": buy["date"],
                "exit_price": sell["price"],
                "exit_time": sell["date"],
                "fees": total_fees,
                "setup": "",
                "tactic": "",
                "stop_price": "",
                "target_price": "",
                "r_multiple": "",
                "status": "open",
                "notes": "",
            })

        for i in range(pairs, len(buys)):
            buy = buys[i]
            trades.append({
                "symbol": buy["symbol"],
                "direction": "LONG",
                "entry_price": buy["price"],
                "quantity": buy["quantity"],
                "entry_time": buy["date"],
                "exit_price": "",
                "exit_time": "",
                "fees": buy.get("fees", "0"),
                "setup": "",
                "tactic": "",
                "stop_price": "",
                "target_price": "",
                "r_multiple": "",
                "status": "open",
                "notes": "",
            })

    return trades


# ───────────────────────── Generic CSV (app template) ─────────────────────────

GENERIC_REQUIRED = [
    "symbol", "entry_price", "quantity", "entry_time",
]


def parse_generic_csv(content: str) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse app's own generic CSV template."""
    errors: List[str] = []
    valid_rows: List[Dict[str, str]] = []

    try:
        reader = csv.DictReader(io.StringIO(content))
    except Exception as e:
        return ([f"Failed to parse CSV: {e}"], [])

    if not reader.fieldnames:
        return (["CSV file is empty or has no headers"], [])

    headers = [h.strip().lower() for h in reader.fieldnames]
    missing = [c for c in GENERIC_REQUIRED if c not in headers]
    if missing:
        return ([f"Missing required columns: {', '.join(missing)}"], [])

    for i, row in enumerate(reader, start=2):
        normed = {k.strip().lower(): (v.strip() if v else "") for k, v in row.items() if k}

        row_errors: List[str] = []
        for col in GENERIC_REQUIRED:
            if not normed.get(col, ""):
                row_errors.append(f"Row {i}: '{col}' is required")

        for col in ["entry_price", "quantity"]:
            v = _to_decimal(normed.get(col, ""))
            if v is None or v <= 0:
                row_errors.append(f"Row {i}: '{col}' must be a positive number")

        if row_errors:
            errors.extend(row_errors)
        else:
            if "direction" not in normed or not normed["direction"]:
                normed["direction"] = "LONG"
            valid_rows.append(normed)

    return (errors, valid_rows)


# ───────────────────────── Broker registry ─────────────────────────

BROKER_PARSERS = {
    "zerodha": parse_zerodha_csv,
    "dhan": parse_dhan_csv,
    "generic": parse_generic_csv,
}

BROKER_DISPLAY = {
    "zerodha": "Zerodha (Kite)",
    "dhan": "Dhan",
    "generic": "Generic CSV",
}