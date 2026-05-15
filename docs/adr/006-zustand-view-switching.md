# ADR-006: View Switching via Zustand Store (No URL Router)

## Status
Accepted

## Context
The app has 10+ pages (dashboard, analytics, trades, journal, playbook, review, ideas, capital, settings, ai-coach). Traditional URL routing (React Router) adds complexity for a single-user app that doesn't need shareable URLs or deep linking.

## Decision
Frontend uses Zustand `appStore.activeView` for view switching instead of a URL-based router. Sub-views controlled by `tradeFormMode` (`list|create|edit`). All views conditionally rendered in `App.tsx` based on store state.

## Consequences
- ✅ Simpler architecture — no route config, no nested layouts
- ✅ Fast view switching (no URL parsing, no route matching)
- ✅ Easy to add new pages: add to union type + conditional render + sidebar entry
- ⚠️ Browser back/forward buttons do not work for navigation
- ⚠️ No shareable URLs — cannot deep-link to a specific page
- ⚠️ All views mounted/unmounted on state change

## Implementation
- `frontend/src/store/appStore.ts` — `activeView`, `tradeFormMode`, `selectedTradeId`
- `frontend/src/App.tsx` — conditional rendering of all pages
- `frontend/src/components/layout/Sidebar.tsx` — navigation triggers `setActiveView()`
