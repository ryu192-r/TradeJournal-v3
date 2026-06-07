# Architecture Decision Records

Index of all ADRs for TradeJournal v3. Each ADR captures one significant decision, its context, and consequences.

| ADR | Title | Status |
|-----|-------|--------|
| [001](001-trade-merge-by-date.md) | Trade Merge by (Symbol, Date) | Accepted |
| [002](002-capital-reconciliation.md) | Capital Reconciliation via Adjustment Events | Accepted |
| [003](003-ai-provider-routing.md) | AI Provider Routing (Ollama Native vs OpenAI-Compatible) | Accepted |
| [004](004-long-only-trades.md) | All Trades Are LONG (Indian Equities) | Accepted |
| [005](005-fluid-responsive-layout.md) | Fluid Responsive Layout via CSS `clamp()` | Accepted |
| [006](006-zustand-view-switching.md) | View Switching via Zustand Store (No URL Router) | Accepted |
| [007](007-decimal-string-serialization.md) | Decimal Serialization as Strings | Accepted |
| [008](008-jwt-auth-localstorage.md) | JWT Auth with localStorage and Force-Logout on 401 | Accepted |
| [009](009-router-ordering.md) | Router Registration Order (`broker_import` before `trades`) | Accepted |
| [010](010-sqlalchemy-sync-engine.md) | SQLAlchemy Sync Engine (Not Async) | Accepted |
| [011](011-dual-state-management.md) | Dual State Management (Zustand UI + React Query server) | Accepted |
| [012](012-trade-status-lifecycle.md) | Trade Status Derived From Exit Price | Accepted |
| [013](013-nginx-traefik-proxy.md) | nginx SPA Proxy + Traefik External Reverse Proxy | Accepted |
| [015](015-alembic-migrations.md) | Alembic Database Migrations | Accepted |
| [016](016-performance-os-domain.md) | Performance OS Daily Review Domain | Superseded by ADR-022 (Perf OS removed in V3) |
| [017](017-operational-dashboard-aggregate-endpoint.md) | Operational Dashboard Aggregate Endpoint | Accepted |
| [018](018-lifecycle-analytics-model.md) | Lifecycle Analytics Model | Accepted |
| [019](019-partial-exits-and-remaining-quantity.md) | Partial Exits and Remaining Quantity | Accepted |
| [020](020-live-quote-cache-and-market-data-provider.md) | Live Quote Cache and Market Data Provider | Accepted |
| [021](021-naive-ist-datetime-display-fix.md) | Naive IST Datetime Display Fix | Accepted |
| [022](022-v3-finish-feature-consolidation.md) | V3 Finish — Feature Consolidation and Culls | Accepted |
| [023](023-new-ui-canonical-design-system.md) | `new-ui` as Canonical Design System | Accepted |
| [024](024-cockpit-absorbs-edge.md) | Cockpit Absorbs the Deterministic Intelligence Feed | Accepted |

> Note: ADR-014 was never created (numbering gap).

## Conventions
- One decision per file, named `NNN-kebab-title.md`.
- Sections: Context → Decision → Consequences (and optionally Alternatives).
- Status values: `Accepted`, `Superseded by ADR-NNN`, `Deprecated`.
- Add new ADRs with the next free number and link them here.
