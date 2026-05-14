"""Free-form natural language trade parser for Telegram messages.

Parses trade entry and trade exit messages:

Entry examples:
    "Bought RELIANCE 50 @ 2650.50 SL 2620 TGT 2750 VWAP bounce"
    "Short TATASTEEL 100 at 145.20 SL 148 target 140 breakout"
    "Long INFY 25 qty entry 1520 stop 1490 tgt 1580 momentum burst"

Exit examples:
    "Closed RELIANCE @ 2700"
    "Exited TATASTEEL at 150 SL hit"
    "Sold RELIANCE 50 @ 2700"
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog

logger = structlog.get_logger()

IST = timezone(timedelta(hours=5, minutes=30))

# Common NSE symbols for recognition
KNOWN_SYMBOLS: set[str] = {
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "TATASTEEL",
    "WIPRO", "SBIN", "BHARTIARTL", "ITC", "KOTAKBANK", "LT", "HCLTECH",
    "AXISBANK", "ASIANPAINT", "MARUTI", "BAJFINANCE", "HDFC", "TITAN",
    "SUNPHARMA", "ULTRACEMCO", "WABAG", "ONGC", "NTPC", "COALINDIA",
    "POWERGRID", "IOCL", "BPCL", "HPCL", "GAIL", "ADANIENT", "ADANIPORTS",
    "ADANIGREEN", "ADANITRANS", "JSWSTEEL", "HINDALCO", "VEDL", "TATAMOTORS",
    "M&M", "DABUR", "COLPAL", "NESTLEIND", "PAGEIND", "BRITANNIA",
    "PIDILITIND", "GRASIM", "DIVISLAB", "CIPLA", "DRREDDY", "BIOCON",
    "LUPIN", "AUROPHARMA", "TORNTPHARM", "ALKEM", "TATAPOWER", "HAL",
    "BEL", "BHEL", "IRFC", "RVNL", "ZOMATO", "NYKAA", "PAYTM",
    "POLICYBNR", "DELHIVERY", "CONCOR", "IRCTC", "NAUKRI",
}

BUY_KEYWORDS: set[str] = {"bought", "buy", "long", "l", "entry"}
SELL_KEYWORDS: set[str] = {"sold", "sell", "short", "shorted", "s"}
EXIT_KEYWORDS: set[str] = {"closed", "exited", "exit"}

SL_RE = re.compile(r"(?:(?:SL|stop(?:\.?loss)?|stoploss)\.?)\s*:?\s*(\d[\d,]*(?:\.\d+)?)", re.IGNORECASE)
TGT_RE = re.compile(r"(?:(?:TGT|target)\.?)\s*:?\s*(\d[\d,]*(?:\.\d+)?)", re.IGNORECASE)


class TradeIntent:
    """Parsed trade intent with metadata."""

    def __init__(self) -> None:
        self.intent: str = "entry"  # "entry" | "exit"
        self.symbol: str | None = None
        self.direction: str | None = None
        self.quantity: float | None = None
        self.entry_price: float | None = None
        self.exit_price: float | None = None
        self.stop_price: float | None = None
        self.target_price: float | None = None
        self.entry_time: str | None = None
        self.notes: str = ""


def parse_trade_message(text: str) -> TradeIntent | None:
    """Attempt to parse a free-form trade message."""
    text_stripped = text.strip()
    if not text_stripped:
        return None

    tokens = text_stripped.split()
    intent = TradeIntent()

    # Normalize tokens for easier matching
    if _is_exit_message(tokens):
        intent.intent = "exit"
        return _parse_exit(tokens, text_stripped, intent)

    # Detect direction
    direction = _detect_direction(tokens)
    if not direction:
        logger.info("no_direction_detected", text=text_stripped)
        return None
    intent.direction = direction

    # Detect symbol
    symbol = _detect_symbol(tokens)
    if not symbol:
        logger.info("no_symbol_detected", text=text_stripped)
        return None
    intent.symbol = symbol

    # Detect quantity and entry price
    qty, entry_price = _detect_qty_price(tokens)
    intent.entry_price = entry_price
    if qty:
        intent.quantity = qty

    # Detect stop loss
    intent.stop_price = _detect_stop(tokens)

    # Detect target
    intent.target_price = _detect_target(tokens)

    # Set entry time if not already set (IST timezone)
    if not hasattr(intent, 'entry_time') or intent.entry_time is None:
        intent.entry_time = datetime.now(IST).isoformat()

    # Remaining text as notes
    intent.notes = _extract_notes(tokens)

    return intent


def _is_exit_message(tokens: list[str]) -> bool:
    """Check if message is a trade exit/closure."""
    first_word = tokens[0].lower().strip(".,!?")
    if first_word in EXIT_KEYWORDS:
        return True
    # "SOLD RELIANCE @ 2700" could be closing a long
    if first_word in {"sold", "sell"}:
        return True
    return False


def _parse_exit(tokens: list[str], text: str, intent: TradeIntent) -> TradeIntent:
    """Parse exit message like 'Closed RELIANCE @ 2700' or 'Exited TATASTEEL at 150 SL hit'."""
    # Find symbol
    symbol = _detect_symbol(tokens)
    if symbol:
        intent.symbol = symbol

    # For exit messages, look for @ followed by the LARGEST number (the price)
    # Not the smaller one (which might be quantity)
    at_matches = re.findall(r"@\s*(\d[\d,]*(?:\.\d+)?)", text)
    if at_matches:
        # Take the largest number as exit price (prices are usually larger than quantities)
        prices = [float(m.replace(",", "")) for m in at_matches]
        intent.exit_price = max(prices)
    elif "at" in [t.lower() for t in tokens]:
        # Handle "at 150" pattern
        at_keyword_match = re.search(r"\bat\s+(\d[\d,]*(?:\.\d+)?)", text, re.IGNORECASE)
        if at_keyword_match:
            # Look for multiple numbers and pick the most likely exit price
            all_numbers = re.findall(r"\d[\d,]*(?:\.\d+)?", text)
            numbers = [float(n.replace(",", "")) for n in all_numbers]
            # Filter out numbers used for SL/TGT
            stop = _detect_stop(tokens)
            target = _detect_target(tokens)
            price_candidates = [n for n in numbers if n != stop and n != target]
            if price_candidates:
                intent.exit_price = max(price_candidates)

    # Check for SL/stop mentions in notes
    has_sl = bool(re.search(r"\bSL\b|stop\s*hit|stoploss", text, re.IGNORECASE))
    if has_sl:
        intent.notes = "SL hit"

    return intent


def _detect_direction(tokens: list[str]) -> str | None:
    """Return 'LONG' or 'SHORT' based on keywords."""
    for token in tokens:
        cleaned = token.lower().strip(".,!?")
        if cleaned in BUY_KEYWORDS:
            return "LONG"
        if cleaned in SELL_KEYWORDS:
            return "SHORT"
    return None


def _detect_symbol(tokens: list[str]) -> str | None:
    """Find a recognized stock symbol in the message."""
    # First pass: exact match against known symbols
    for token in tokens:
        upper = token.upper().strip(".,!?")
        if upper in KNOWN_SYMBOLS:
            return upper

    # Second pass: any uppercase word 2-12 chars (likely symbol)
    skip_words = {"qty", "quantity", "shares", "lots", "at", "the", "and", "for"}
    for token in tokens:
        cleaned = token.strip(".,!?")
        if re.match(r"^[A-Z]{2,12}$", cleaned):
            if cleaned.lower() not in skip_words:
                return cleaned.upper()

    return None


def _detect_qty_price(tokens: list[str]) -> tuple[float | None, float | None]:
    """Extract quantity and price from message.
    
    Handles:
    - "50 @ 2650.50" -> qty=50, price=2650.50
    - "100 at 145.20" -> qty=100, price=145.20
    - "entry 1520" -> price=1520 (fallback using "entry" keyword)
    """
    text = " ".join(tokens)
    
    # Pattern: number followed by @ or at then number
    qty_price_match = re.search(
        r"(\d[\d,]*(?:\.\d+)?)\s+(?:@|at)\s*(\d[\d,]*(?:\.\d+)?)", text, re.IGNORECASE
    )
    if qty_price_match:
        qty_str = qty_price_match.group(1).replace(",", "")
        price_str = qty_price_match.group(2).replace(",", "")
        
        qty = float(qty_str)
        price = float(price_str)
        
        # Heuristic: quantity is usually integer and smaller
        if qty == int(qty) and qty <= 10000:
            return qty, price
        return price, qty

    # Pattern: "entry" keyword followed by number
    entry_match = re.search(r"\bentry\s+(\d[\d,]*(?:\.\d+)?)", text, re.IGNORECASE)
    if entry_match:
        # Try to find quantity before symbol
        symbol_match = re.search(r"(?:LONG|SHORT|bought|sell|short|buy)\s+\w+\s+(\d+)", text, re.IGNORECASE)
        if symbol_match:
            qty = float(symbol_match.group(1))
            return qty, float(entry_match.group(1).replace(",", ""))
        return None, float(entry_match.group(1).replace(",", ""))

    # Simple fallback: first number could be quantity, second price
    numbers = re.findall(r"\d[\d,]*(?:\.\d+)?", text)
    # Remove numbers that are part of SL/TGT
    filtered = []
    for n in numbers:
        val = float(n.replace(",", ""))
        if val != _detect_stop(tokens) and val != _detect_target(tokens):
            filtered.append(val)
    
    if len(filtered) >= 2:
        # Heuristic: first small integer is qty, second is price
        if filtered[0] == int(filtered[0]) and filtered[0] <= 10000:
            return filtered[0], filtered[1]
        return filtered[1], filtered[0]
    elif len(filtered) == 1:
        return None, filtered[0]

    return None, None


def _detect_stop(tokens: list[str]) -> float | None:
    """Extract stop loss price."""
    text = " ".join(tokens)
    match = SL_RE.search(text)
    if match:
        return float(match.group(1).replace(",", ""))
    return None


def _detect_target(tokens: list[str]) -> float | None:
    """Extract target price."""
    text = " ".join(tokens)
    match = TGT_RE.search(text)
    if match:
        return float(match.group(1).replace(",", ""))
    return None


def _extract_notes(tokens: list[str]) -> str:
    """Extract remaining text as trade notes."""
    skip = {"qty", "quantity", "shares", "lots", "at", "the", "and", "for"}
    skip_prices = re.compile(r"^(\d[\d,]*(?:\.\d+)?|@\s*\d)")
    skip_keywords = BUY_KEYWORDS | SELL_KEYWORDS | EXIT_KEYWORDS | {"SL", "TGT", "stop", "target", "stop.loss", "stoploss"}
    # Also skip "entry" and "stop" as keywords when they precede numbers
    skip_keywords.add("entry")

    notes_tokens = []
    i = 0
    while i < len(tokens):
        t = tokens[i]
        cleaned = t.lower().strip(".,!?")
        if cleaned in skip or cleaned in skip_keywords:
            # If keyword precedes a number, skip both
            if i + 1 < len(tokens) and re.match(r"^\d", tokens[i+1]):
                i += 2
            else:
                i += 1
            continue
        if skip_prices.match(t):
            i += 1
            continue
        notes_tokens.append(t)
        i += 1

    return " ".join(notes_tokens)


def format_trade_summary(intent: TradeIntent) -> str:
    """Format a parsed trade intent into a confirmation summary for Telegram."""
    if intent.intent == "exit":
        return _format_exit_summary(intent)

    lines = [
        "📊 *Trade Draft Created*",
        "",
        f"Symbol: `{intent.symbol}`",
        f"Direction: {'🟢 LONG' if intent.direction == 'LONG' else '🔴 SHORT'}",
        f"Entry: ₹{intent.entry_price:.2f}",
    ]
    if intent.quantity:
        lines.append(f"Quantity: {intent.quantity:.0f}")
    if intent.stop_price:
        lines.append(f"Stop Loss: ₹{intent.stop_price:.2f}")
        risk = abs(intent.entry_price - intent.stop_price)
        lines.append(f"Risk per share: ₹{risk:.2f}")
    if intent.target_price:
        lines.append(f"Target: ₹{intent.target_price:.2f}")
        if intent.stop_price:
            risk = abs(intent.entry_price - intent.stop_price)
            reward = abs(intent.target_price - intent.entry_price)
            if risk > 0:
                r_mult = reward / risk
                lines.append(f"R:R ratio: {r_mult:.1f}:1")
    if intent.notes:
        lines.append(f"Notes: {intent.notes}")
    lines.append("")
    lines.append("Status: *Draft* — review in web app to finalize")
    return "\n".join(lines)


def _format_exit_summary(intent: TradeIntent) -> str:
    """Format an exit confirmation."""
    lines = [
        "🔴 *Trade Exit Recorded*",
        "",
        f"Symbol: `{intent.symbol}`",
    ]
    if intent.exit_price:
        lines.append(f"Exit Price: ₹{intent.exit_price:.2f}")
    if intent.notes:
        lines.append(f"Reason: {intent.notes}")
    lines.append("")
    lines.append("Review in web app to finalize P&L")
    return "\n".join(lines)
