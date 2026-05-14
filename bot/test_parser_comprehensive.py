#!/usr/bin/env python
"""Comprehensive parser tests."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parser import parse_trade_message, format_trade_summary

test_cases = [
    ("Bought RELIANCE 50 @ 2650 SL 2620 TGT 2750 VWAP bounce", {
        "intent": "entry", "symbol": "RELIANCE", "direction": "LONG",
        "quantity": 50.0, "entry_price": 2650.0, "stop_price": 2620.0,
        "target_price": 2750.0, "notes_contains": "VWAP bounce"
    }),
    ("Short TATASTEEL 100 at 145.20 SL 148 target 140 breakout", {
        "intent": "entry", "symbol": "TATASTEEL", "direction": "SHORT",
        "quantity": 100.0, "entry_price": 145.20, "stop_price": 148.0,
        "target_price": 140.0, "notes_contains": "breakout"
    }),
    ("Long INFY 25 qty entry 1520 stop 1490 tgt 1580 momentum burst", {
        "intent": "entry", "symbol": "INFY", "direction": "LONG",
        "quantity": 25.0, "entry_price": 1520.0, "stop_price": 1490.0,
        "target_price": 1580.0, "notes_contains": "momentum burst"
    }),
    ("Closed RELIANCE @ 2700", {
        "intent": "exit", "symbol": "RELIANCE", "exit_price": 2700.0
    }),
    ("Exited TATASTEEL at 150 SL hit", {
        "intent": "exit", "symbol": "TATASTEEL", "exit_price": 150.0,
        "notes_contains": "SL hit"
    }),
    ("Sold RELIANCE 50 @ 2700", {
        "intent": "exit", "symbol": "RELIANCE", "exit_price": 2700.0
    }),
]

print("Running comprehensive parser tests...")
passed = 0
failed = 0

for i, (text, expected) in enumerate(test_cases, 1):
    result = parse_trade_message(text)
    if not result:
        print(f"❌ Test {i}: Failed to parse '{text[:40]}...'")
        failed += 1
        continue
    
    test_failed = False
    for key, exp_val in expected.items():
        actual = getattr(result, key, None)
        if key == "notes_contains":
            if exp_val not in (result.notes or ""):
                print(f"  ❌ notes='{result.notes}' doesn't contain '{exp_val}'")
                test_failed = True
        elif actual != exp_val:
            print(f"  ❌ {key}: expected {exp_val}, got {actual}")
            test_failed = True
    
    if not test_failed:
        print(f"✅ Test {i}: {text[:50]}...")
        passed += 1
    else:
        failed += 1

print(f"\nResults: {passed}/{passed+failed} tests passed")
if failed > 0:
    sys.exit(1)
