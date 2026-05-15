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

## Consequences
- ✅ Clear separation — UI state doesn't trigger server refetches, server state doesn't pollute UI stores
- ✅ React Query handles caching, stale-time, automatic refetching, mutation invalidation
- ✅ Trade mutations invalidate both `['trades']` and `['capital-dashboard']` (trade changes affect capital)
- ✅ `staleTime: 5 * 60 * 1000` (5 min) and `refetchOnWindowFocus: false` as global defaults
- ⚠️ New server-data feature requires: endpoint in `endpoints.ts`, React Query hook in `hooks/`, query key invalidation on mutations
- ⚠️ Two state management paradigms to understand

## Implementation
- `frontend/src/store/` — Zustand stores (UI state only)
- `frontend/src/hooks/` — React Query hooks (server state)
- `frontend/src/lib/endpoints.ts` — API endpoint functions (single source of truth)
- `frontend/src/App.tsx` — `QueryClient` with `staleTime: 5 * 60 * 1000`
