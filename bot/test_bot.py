#!/usr/bin/env python
"""Test bot imports and basic parsing."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test imports
imports_to_test = [
    ("config", ["BOT_TOKEN", "CHAT_ID", "BACKEND_URL"]),
    ("client", ["BackendClient"]),
    ("parser", ["parse_trade_message", "format_trade_summary", "TradeIntent"]),
    ("middleware", ["require_auth", "error_handler"]),
    ("handlers", ["cmd_start", "cmd_help", "cmd_pnl", "cmd_journal", "cmd_setup", "handle_text_message"]),
    ("utils", ["send_daily_pnl_summary", "send_stop_reminders"]),
    ("bot", ["build_application", "schedule_jobs"]),
]

print("Testing bot module imports...")
for module_name, attrs in imports_to_test:
    try:
        mod = __import__(module_name, fromlist=attrs)
        for attr in attrs:
            if not hasattr(mod, attr):
                print(f"  FAIL: {module_name}.{attr} not found")
                break
        else:
            print(f"  ✅ {module_name}: OK")
    except Exception as e:
        print(f"  ❌ {module_name}: FAIL - {e}")

# Test trade parser
print("\nTesting trade parser...")
from parser import parse_trade_message, format_trade_summary

test_cases = [
    "Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce",
    "Short TATASTEEL 100 at 145.20 SL 148 target 140 breakout",
    "Closed RELIANCE @ 2700",
]

for test in test_cases:
    result = parse_trade_message(test)
    if result:
        print(f"  ✅ '{test[:40]}...' parsed: {result.intent} {result.symbol} {'@' + str(result.entry_price) if result.entry_price else '?'}")
    else:
        print(f"  ❌ '{test[:40]}...' failed to parse")

print("\nAll tests completed.")
