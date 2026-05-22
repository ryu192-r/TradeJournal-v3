# ADR-017: Operational Dashboard Aggregate Endpoint

## Status
Accepted

## Context
The dashboard needs KPIs, open positions, risk, capital, streaks, alerts, and equity curve data at first paint. Calling many endpoints from the browser creates waterfall latency and blank states during refresh.

## Decision
Use `GET /api/v1/dashboard/operational` as the primary dashboard payload.

The endpoint returns:
- KPI summary.
- Open trades with remaining quantity.
- Risk summary and warnings.
- Capital summary, including realized and unrealized equity.
- Streak summary.
- Realized equity curve.

Lifecycle, playbook, and market highlights are exposed through `GET /api/v1/dashboard/intelligence` and can load as supporting data.

## Consequences
- Dashboard first paint depends on one primary request.
- Shared dashboard formulas live server-side and are easier to test.
- Endpoint size grows as the command center evolves, so payload additions should stay summary-level.

## Implementation
- Backend router: `backend/app/routers/operational_dashboard.py`
- Frontend hook: `frontend/src/hooks/useOperationalDashboardQuery.ts`
- Frontend page: `frontend/src/pages/DashboardPage.tsx`
