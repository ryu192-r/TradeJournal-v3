# ADR-009: Router Registration Order (broker_import Before trades)

## Status
Accepted

## Context
The `trades` router has a `/{trade_id}` catch-all route (integer path param). The `broker_import` router adds sub-routes under `/trades/` (e.g., `/trades/brokers`, `/trades/import/...`). FastAPI matches routes in registration order.

## Decision
In `base.py`, `broker_import` router is registered **before** the `trades` router. Any new sub-routes under `/trades/` that are not numeric IDs must also be registered before the `trades` router.

## Consequences
- ✅ `/trades/brokers` matches broker_import router, not `/{trade_id}`
- ✅ Clear ordering rule for future routes
- ⚠️ Silent breakage if order is changed — `/trades/brokers` would match `trade_id = "brokers"` (string-to-int fails)
- ⚠️ Adding new sub-routes requires awareness of this ordering constraint

## Implementation
- `backend/app/routers/base.py`:
  ```python
  api_router.include_router(broker_import.router, prefix="/trades", tags=["broker-import"])
  api_router.include_router(trades.router, tags=["trades"])  # has /{trade_id} catch-all
  ```
