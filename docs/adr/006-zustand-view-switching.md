# ADR-006: View Switching via Zustand Store (No URL Router)

## Status
Accepted

## Context
The app has 10+ pages (dashboard, analytics, trades, journal, playbook, review, ideas, capital, settings, ai-coach). Traditional URL routing (React Router) adds complexity for a single-user app that doesn't need shareable URLs or deep linking.

## Decision
Frontend uses Zustand `appStore.activeView` for view switching instead of a URL-based router. Sub-views controlled by `tradeFormMode` (`list|create|edit`). Views are conditionally rendered in `App.tsx` based on store state and lazy-loaded with `React.lazy`/`Suspense` so heavy sections do not inflate the initial bundle.

## Consequences
- ✅ Simpler architecture — no route config, no nested layouts
- ✅ Fast view switching (no URL parsing, no route matching)
- ✅ Better initial load — analytics/recharts, coach, trades, and other heavy views are split into on-demand chunks
- ✅ Easy to add new pages: add to union type + conditional render + sidebar entry
- ⚠️ Browser back/forward buttons do not work for navigation
- ⚠️ No shareable URLs — cannot deep-link to a specific page
- ⚠️ First visit to a view may show a short Suspense fallback while that chunk downloads
- ⚠️ All active views still mount/unmount on state change

## Implementation
- `frontend/src/store/appStore.ts` — `activeView`, `tradeFormMode`, `selectedTradeId`
- `frontend/src/App.tsx` — `React.lazy` declarations, `Suspense` fallback, conditional rendering of pages
- `frontend/src/components/layout/Sidebar.tsx` — navigation triggers `setActiveView()`
