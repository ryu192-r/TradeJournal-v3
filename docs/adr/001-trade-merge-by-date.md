# ADR-001: Trade Merge by (Symbol, Date)

## Status
Accepted

## Context
Traders often execute multiple trades in the same symbol on the same day. Without deduplication, these would appear as separate entries, inflating trade count and distorting analytics.

## Decision
Trades for the same `(symbol, date)` are automatically merged on create/import:
- **Entry price**: weighted average
- **Exit price**: weighted average
- **Quantity**: summed
- **Fees**: summed
- **PnL**: recomputed from merged values
- **Entry time**: earliest of merged trades

Different dates = separate trades (no cross-day merging).

Backfill existing duplicates via `POST /trades/merge-duplicates`.

## Consequences
- ✅ Prevents duplicate entries from broker imports
- ✅ Accurate trade count and analytics
- ✅ Weighted-average prices reflect real cost basis
- ⚠️ Users cannot see individual legs of a merged trade
- ⚠️ Merge is irreversible (no unmerge)

## Implementation
- `TradeService.merge_or_create()` — create-time merge
- `TradeService._merge_trade()` — merge logic
- `POST /trades/merge-duplicates` — backfill endpoint
