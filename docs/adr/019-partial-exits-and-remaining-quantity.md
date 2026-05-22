# ADR-019: Partial Exits and Remaining Quantity

## Status
Accepted

## Context
Open positions may be scaled out before final close. Treating every sale as a full close loses realized PnL detail and makes deployed capital and risk inaccurate.

## Decision
Partial exits are stored as separate `PartialExit` rows attached to an open trade.

Remaining quantity is computed as:

```text
trade.quantity - SUM(partial_exit.qty)
```

Partial exits are allowed only while the parent trade is open. The partial-exit endpoint rejects `qty >= remaining_qty`; a full remaining exit must use the normal trade close path so the parent trade receives `exit_price`, final PnL, and closed status.

## Consequences
- Risk, deployed capital, and live PnL can use remaining quantity.
- Partial realized PnL is visible without prematurely closing the trade.
- Shared formula drift is a risk until remaining quantity calculations are consolidated into a service.

## Implementation
- Backend router: `backend/app/routers/partial_exit.py`
- Model: `backend/app/models/partial_exit.py`
- Frontend hooks: `frontend/src/hooks/usePartialExitQuery.ts`
- Frontend UI: `frontend/src/components/lifecycle/PartialExitForm.tsx`
