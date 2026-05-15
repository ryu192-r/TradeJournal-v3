# ADR-004: All Trades Are LONG (Indian Equities)

## Status
Accepted

## Context
The journal targets Indian retail equity traders who can only go LONG (no shorting in cash segment). Supporting both LONG and SHORT adds complexity to PnL calculation, UI, and analytics.

## Decision
All trades are LONG only:
- DB column `direction` defaults to `"LONG"`
- UI does not show direction selector
- PnL formula: `(exit_price - entry_price) * quantity - fees`
- Pyramid adds to LONG position (weighted-average entry)

## Consequences
- ✅ Simpler PnL calculation
- ✅ Cleaner UI (no direction toggle)
- ✅ Accurate for target market (Indian equities)
- ⚠️ Cannot track F&O short positions
- ⚠️ If shorting is needed later, migration required

## Implementation
- `backend/app/models/trade.py` — `direction = Column(String, default="LONG")`
- `backend/app/services/trade_service.py` — PnL uses LONG formula
- Frontend forms omit direction field
