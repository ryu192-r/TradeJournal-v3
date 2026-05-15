# ADR-012: Trade Status Lifecycle with Validated Transitions

## Status
Accepted

## Context
Trades move through a lifecycle (draft → reviewed → analytics). Not all transitions should be allowed (e.g., cannot go from `analytics` directly to `draft` without review). Soft delete preserves data for analytics and capital reconciliation.

## Decision
Trades have status lifecycle with enforced valid transitions defined in `VALID_TRANSITIONS`. Soft delete sets `status = "deleted"` rather than removing the row. Capital dashboard filters `Trade.status != "deleted"` for PnL and deployed capital.

## Consequences
- ✅ Enforced transitions prevent invalid state changes
- ✅ Soft delete preserves data — deleted trades excluded from queries, not removed
- ✅ Capital reconciliation accounts for soft-deleted trades (excluded from deployed capital)
- ⚠️ Adding new status requires updating `VALID_TRANSITIONS`, Pydantic validator, and frontend type
- ⚠️ Deleted trades still occupy DB rows (acceptable for audit trail)

## Implementation
- `backend/app/routers/trades.py` — `VALID_TRANSITIONS` dict, `_validate_status_transition()`
- `backend/app/schemas/trade.py` — `validate_status` field validator
- `frontend/src/types/index.ts` — `BackendTradeStatus = 'draft' | 'reviewed' | 'analytics'`
- `backend/app/models/trade.py` — status column default `'draft'`
- `backend/app/routers/capital_dashboard.py` — filters `Trade.status != "deleted"`
