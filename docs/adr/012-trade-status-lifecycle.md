# ADR-012: Trade Status Derived From Exit Price

## Status

Accepted

## Context

The original trade lifecycle used workflow states (`draft`, `reviewed`, `analytics`) plus soft delete. That created ambiguity because a trade's position state is not a manual workflow state: in this product, a trade is open when it has no exit price and closed when it has an exit price.

The domain model now treats `exit_price` as the source of truth for open/closed state.

## Decision

Trades use a minimal persisted status column for compatibility and soft delete:

- `open` when `exit_price IS NULL`
- `closed` when `exit_price IS NOT NULL`
- `deleted` for soft-deleted rows

Application logic derives open/closed from `exit_price` everywhere user-facing. Clients do not set `status` directly. The backend auto-sets status on create/update via `_auto_set_status()` and backfills old `draft`/`reviewed`/`analytics` rows on startup.

## Consequences

- Open/closed behavior is deterministic and matches trader expectations.
- Old workflow statuses no longer affect list filters, badges, or detail display.
- Soft delete remains available for auditability and capital reconciliation.
- Review workflow now uses review fields (`review_notes`, `review_tags`) instead of status transitions.
- Existing databases need backfill for old status values.

## Implementation

- `backend/app/routers/trades.py` — `_auto_set_status()`, status filter by `exit_price`, soft delete via `DELETE /trades/{id}`
- `backend/app/main.py` — `_backfill_trade_statuses()` startup backfill
- `backend/app/schemas/trade.py` — clients cannot set status in create/update schemas
- `frontend/src/pages/TradesPage.tsx` — badges and filters derive from `exit_price`
- `frontend/src/components/trades/TradeDetailSwipeContent.tsx` — detail status derives from `exit_price`
