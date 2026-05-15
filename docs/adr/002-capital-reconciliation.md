# ADR-002: Capital Reconciliation via Adjustment Events

## Status
Accepted

## Context
When trades are created, updated, deleted, or pyramided, the account's `current_balance` can drift from the computed target. Silent overwrites lose audit history. Manual reconciliation is error-prone.

## Decision
Reconciliation computes:
```
target = initial + deposits - withdrawals + realized_pnl - deployed_capital
```

If `delta = target - current_balance` is non-zero, an `adjustment` capital event is created with the delta amount. This preserves a full audit trail — no silent overwrites.

Reconciliation runs:
- **Automatically**: on all trade mutations (create, update, delete, pyramid, merge, CSV import, broker import)
- **Manually**: `POST /capital-events/accounts/{id}/reconcile`

## Consequences
- ✅ Full audit trail of all balance changes
- ✅ No silent overwrites — every adjustment is visible
- ✅ Automatic sync prevents drift
- ✅ Manual reconcile available for user-initiated sync
- ⚠️ Adjustment events accumulate over time (can be filtered/viewed)
- ⚠️ Reconciliation is batched — one event per operation, not per trade

## Implementation
- `backend/app/routers/capital_events.py` — `_reconcile_account()`
- `backend/app/routers/trades.py` — `_auto_reconcile()` calls after mutations
- `frontend/src/pages/CapitalPage.tsx` — Reconcile button + toast feedback
- `frontend/src/lib/endpoints.ts` — `reconcileAccount()`
