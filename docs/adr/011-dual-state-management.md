# ADR-011: Dual State Management (Zustand for UI, React Query for Server State)

## Status
Accepted

## Context
Frontend needs to manage both UI state (sidebar, active view, theme, form mode) and server state (trade lists, dashboard KPIs, analytics). Mixing them in one store leads to cache invalidation bugs and unnecessary re-renders.

## Decision
Split state management:
- **Zustand stores** (`appStore`, `authStore`, `toastStore`) — UI/client state only
- **TanStack React Query** — server state (trades, analytics, journal, capital)
- Custom hooks (`useTradesQuery`, `useTradeMutation`, `useDashboardQuery`) encapsulate React Query calls
- Domain-level invalidation helpers centralize refresh behavior:
  - `invalidateTradeDomain()` for trade-impacting mutations
  - `invalidateCapitalDomain()` for capital-event mutations

## Consequences
- ✅ Clear separation — UI state doesn't trigger server refetches, server state doesn't pollute UI stores
- ✅ React Query handles caching, stale-time, automatic refetching, mutation invalidation
- ✅ Trade-domain mutations refresh all dependent data: trades, trade detail, capital dashboard/events, analytics, journal weekly stats, and setup playbook stats
- ✅ Queries refetch on mount, window focus, and reconnect so returning to a view shows fresh data
- ✅ Global `staleTime` is short (`60s`) to reduce stale UI while still avoiding aggressive request spam
- ⚠️ New server-data feature requires: endpoint in `endpoints.ts`, React Query hook in `hooks/`, and domain invalidation helper updates when mutations affect related views
- ⚠️ Two state management paradigms to understand

## Implementation
- `frontend/src/store/` — Zustand stores (UI state only)
- `frontend/src/hooks/` — React Query hooks (server state)
- `frontend/src/lib/endpoints.ts` — API endpoint functions (single source of truth)
- `frontend/src/lib/queryInvalidation.ts` — shared domain invalidation helpers
- `frontend/src/App.tsx` — `QueryClient` defaults (`staleTime: 60s`, refetch on mount/focus/reconnect)
