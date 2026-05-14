#!/usr/bin/env python
"""Test handler payload building logic."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timezone, timedelta
from parser import parse_trade_message

IST = timezone(timedelta(hours=5, minutes=30))

# Test payload building (mimics what handler does)
test_messages = [
    "Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce",
    "Short TATASTEEL 100 at 145.20 SL 148 target 140 breakout",
    "Long INFY 25 qty entry 1520 stop 1490 tgt 1580 momentum burst",
]

print("Testing payload building for TradeCreate API...")
for msg in test_messages:
    parsed = parse_trade_message(msg)
    if not parsed:
        print(f"  FAILED to parse: {msg[:50]}...")
        continue

    # Build payload matching TradeCreate schema
    payload = {
        "symbol": parsed.symbol,
        "direction": parsed.direction,
        "entry_price": parsed.entry_price,
        "quantity": parsed.quantity or 1,
        "entry_time": parsed.entry_time or datetime.now(IST).isoformat(),
        "notes": parsed.notes,
    }
    if parsed.stop_price is not None:
        payload["stop_price"] = parsed.stop_price
    if parsed.target_price is not None:
        payload["target_price"] = parsed.target_price

    print(f"  PAYLOAD: {payload}")
    print()

    # Validate required fields
    required = ["symbol", "direction", "entry_price", "quantity", "entry_time"]
    missing = [f for f in required if payload.get(f) is None]
    if missing:
        print(f"  FAILED missing: {missing}")

print("All payload tests completed.")
