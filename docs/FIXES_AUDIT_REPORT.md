# Fixes Audit Report

Status updated: 2026-05-31

## Fixed Critical Issues

- Security: removed unsafe default production secrets from `docker-compose.yml`; production now requires explicit DB/auth secrets and `.env.example` documents required values.
  - Fixed in `63cff78`.

- Security: added SSRF protection for AI provider `base_url`; HTTPS is required by default, localhost/private/link-local/metadata/docker-internal targets are blocked, and local URLs require `DEBUG=true` or explicit opt-in.
  - Fixed in `63cff78`.

- Security: made AI provider settings user-safe; settings are per-user, API keys are not exposed in responses, and empty `api_key` payloads preserve existing keys unless explicitly removed.
  - Fixed in `63cff78`.

## Fixed Medium Issues

- Stale API: removed the broken old trade-idea update route that called a nonexistent service method; `PUT /{idea_id}` is the canonical update route.
  - Fixed in `1a6b115`.

- Stale API/security: aligned AI settings frontend/backend contract around `has_api_key`; frontend no longer expects raw `api_key`, and saves do not wipe existing keys unless replaced or removed.
  - Fixed in `1a6b115`.

- Security: added backend password validation with minimum length and weak-password rejection, aligned with frontend validation.
  - Fixed in `1a6b115`.

- Security documentation: documented current `localStorage` token risk and future httpOnly-cookie migration path.
  - Fixed in `1a6b115`.

- Query efficiency: removed N+1 partial-exit queries from the trade list by batch loading partial exits for visible trade IDs while preserving response shape.
  - Fixed in `af06d18`.

- Query efficiency: improved capital reconciliation by aggregating partial-exit quantity and realized PnL for all open trades in one grouped query.
  - Fixed in `af06d18`.

- Query efficiency: operational dashboard now fetches cached live quotes only for current open-trade symbols.
  - Fixed in `af06d18`.

- Database indexing: added Alembic migration for active trade hot paths covering `user_id`, `status != deleted`, `exit_price`, and `entry_time`, with PostgreSQL/SQLite-compatible partial indexes.
  - Fixed in `af06d18`.

- Mobile: dashboard header actions now wrap on narrow screens.
  - Fixed in `af06d18`.

- Mobile/stale CSS: replaced unsupported `xs:inline` usage with an existing breakpoint.
  - Fixed in `af06d18`.

## Fixed Cleanup

- Dead/stale files: removed unused duplicate frontend files under `frontend/frontend/src/...`.
  - Fixed in `af06d18`.

- Stale config: removed generated `vite.config.js` and `vite.config.d.ts`; `vite.config.ts` is the single source of truth.
  - Fixed in `af06d18`.

## Remaining Nice-To-Have Improvements

- Dead code: exported UI components appear unused but should not be deleted without confirmation: `StatusPill.tsx`, `SwipeToDelete.tsx`, and `GlassTagInput.tsx`.

- Duplicate logic: capital/equity formulas still exist in operational dashboard, capital dashboard, and capital service. Consolidate to reduce drift risk.

- Duplicate UI: two `PageHeader` components with different prop APIs still exist.

- Duplicate chart gallery logic: review and trade chart galleries both wrap the same lightbox pattern. Merge or share core component.

- Performance: dashboard still fetches operational, intelligence, coaching, daily, and live quote data eagerly even when widgets are hidden. Gate by visible widgets or lazy panels.

- Upload hardening: chart upload still reads the full file into memory before validation. Add streaming limits and image bomb protections.
