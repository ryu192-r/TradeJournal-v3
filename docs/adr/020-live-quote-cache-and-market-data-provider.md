# ADR-020: Live Quote Cache and Market Data Provider

## Status
Accepted

## Context
Open-position dashboards need live prices for unrealized PnL, but the app is self-hosted and should not depend on every frontend view calling a market-data provider directly.

## Decision
Live quotes are cached in the `live_quotes` table and refreshed through backend sync endpoints.

The backend:
- Collects symbols from open trades.
- Fetches quotes through `market_data_service`.
- Upserts cached quote rows.
- Returns provider status and quote freshness metadata.

The frontend reads cached quotes and displays freshness states: `fresh`, `stale`, `failed`, or `not_synced`.

## Consequences
- The UI can show stale or failed quote states instead of silently showing missing LTP.
- Market provider failures are isolated to sync, not every page render.
- Future providers should be added behind `market_data_service`, not directly in UI components.

## Implementation
- Backend router: `backend/app/routers/market_context.py`
- Provider service: `backend/app/services/market_data_service.py`
- Model: `backend/app/models/live_quote.py`
- Frontend hooks: `frontend/src/hooks/useMarketContextQuery.ts`
- Frontend surfaces: Dashboard live positions, Trades LTP cells, Market watchlist.
