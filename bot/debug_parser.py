#!/usr/bin/env python
"""Debug parser issue with short positions."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parser import parse_trade_message, _detect_qty_price, _detect_entry_only

test = 'Short TATASTEEL 100 at 145.20 SL 148 target 140 breakout'
result = parse_trade_message(test)

print(f'Input: {test}')
print(f'quantity: {result.quantity}')
print(f'entry_price: {result.entry_price}')
print(f'stop_price: {result.stop_price}')
print(f'target_price: {result.target_price}')
print()

# Debug qty/price detection
tokens = test.split()
qty, price = _detect_qty_price(tokens)
print(f'_detect_qty_price => qty:{qty}, price:{price}')

alt = _detect_entry_only(tokens)
print(f'_detect_entry_only => {alt}')

# The problem: "100" matches number after symbol, but there's also "145.20" with "at"
# Need better pattern to find entry price with "at" keyword
