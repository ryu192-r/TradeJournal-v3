# ADR-007: Decimal Serialization as Strings

## Status
Accepted

## Context
JavaScript `number` is IEEE 754 double-precision float, which loses precision for financial values. Python `Decimal` is arbitrary-precision. Converting `Decimal` → `float` → JSON → `number` can corrupt prices like `2650.50` in edge cases.

## Decision
All monetary and numeric values (prices, quantities, PnL, fees) are serialized as **strings** in JSON responses. Backend uses `Decimal` internally, `str` externally. Frontend `ApiTrade` type declares all numeric fields as `string`.

## Consequences
- ✅ No precision loss — exact decimal values preserved
- ✅ Frontend must parse strings back to numbers via `parseFloat()` or `parseDecimal()`
- ✅ Any new endpoint returning monetary values must follow this pattern
- ✅ `ensure_decimal()` coerces incoming floats to `Decimal` via `Decimal(str(v))` to avoid float-to-Decimal precision loss
- ⚠️ Frontend code must remember to parse strings before arithmetic
- ⚠️ Pydantic warnings about `Expected decimal` — benign but noisy

## Implementation
- `backend/app/schemas/trade.py` — `serialize_decimal` validator on `TradeResponse`
- `backend/app/utils/decimal_utils.py` — `ensure_decimal(v)` converts float via `Decimal(str(v))`
- `frontend/src/types/index.ts` — `ApiTrade` declares `entry_price: string`, `pnl: string`, etc.
- `frontend/src/utils/format.ts` — `parseDecimal()` safely parses backend string decimals
