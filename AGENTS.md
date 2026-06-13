# Trading Journal v3 — Agent Guide

## Agent skills

### Issue tracker

GitHub Issues at `ryu192-r/TradeJournal-v3`. Uses `gh` CLI. New issues get `needs-triage` + category label. See `docs/agents/issue-tracker.md`.

### Triage labels

Five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) + two categories (`bug`, `enhancement`). Labels already exist on GitHub. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (glossary + lifecycle + formulas) + `docs/adr/` (24 ADRs, see `docs/adr/README.md`) + `docs/ARCHITECTURE.md` (full file map). See `docs/agents/domain.md`.

### Architecture reference

`docs/ARCHITECTURE.md` — complete file map, all endpoints, models, services, components, design tokens.

## Stack
- **Frontend**: React 19, Vite 8, TypeScript 6, Tailwind 3, Zustand v5 (UI state), TanStack React Query v5 (server state), axios, react-hook-form + zod, recharts, framer-motion, lucide-react
- **Backend**: Python 3.12, FastAPI 0.115, Pydantic v2, SQLAlchemy 2.0 **sync**, PostgreSQL (psycopg2-binary), uvicorn
- **Auth**: JWT (python-jose + bcrypt). Access + refresh tokens in localStorage (`auth_token`, `refresh_token`). 401 → force-logout via page reload. **All API routers except `/auth`, `/health`, `/webhooks/dhan` have `dependencies=[Depends(get_current_user)]` at router level** for authentication. Auth routes use `Depends(get_current_user)` on individual endpoints (login/register are public; change_password/update_me require auth).
- **Infra**: Docker Compose (postgres + backend + frontend + bot). External Traefik for HTTPS/DuckDNS. nginx inside frontend container proxies `/api/v1/` to `http://backend:8000`. Build arg `VITE_API_URL=/api/v1`.

## Quick commands
```bash
docker compose up -d --build          # full stack
docker compose logs -f backend        # backend logs
cd backend && python3 -m pytest tests/ -v   # tests (SQLite, no Docker needed)
cd frontend && npm run dev             # dev server
cd frontend && npx vitest run          # unit tests
cd frontend && npx tsc --noEmit       # typecheck
cd frontend && npm run build           # production build
```

## Key architecture
- **Architecture doc**: `docs/ARCHITECTURE.md` — full file map, every endpoint, every component
- **Auth gate**: `App.tsx` checks `isAuthenticated` — all pages require login
- **View switching**: Zustand `appStore.activeView` (not URL router). Sub-views via `tradeFormMode` (`list|create|edit|detail`). Active views: `dashboard`, `analytics`, `trades`, `playbook`, `review`, `capital`, `settings`, `coach`, `journal`, `calendar`, `reports`, `lifecycle`, `charges`. No simple/pro toggle — `NavMode` and `interfaceMode.ts` removed in Phase 1.
- **V3 shell**: `App.tsx` mounts `features-v3/shell/V3LiveApp` (the live shell). `V3LiveApp` maps `activeView` → a V3 section via `v3ViewMapping.ts` and renders the matching slice from `features-v3/*`. Legacy `pages/*` are gone (Phase 9) — only `pages/LoginPage.tsx` remains.
- **View code-splitting**: `V3LiveApp` lazy-loads all heavy slices with `React.lazy`/`Suspense` (analytics/recharts, coach, trades, charges, reports, etc.) to keep the shell chunk small.
- **Mobile bottom nav**: Cockpit | Trades | **+** (FAB, create trade) | Journal | Review. Driven by `v3MobileNavigationItems` in `features-v3/shell/v3Navigation.tsx`; rendered by `V3MobileNav`.
- **Data refresh**: React Query refetches on mount/window focus/reconnect. `placeholderData: (previousData) => previousData` on ALL hooks prevents blank states during refetch.
- **Routes**: Register in `backend/app/routers/base.py`, prefix `/api/v1`. **Order matters**: `broker_import` router must come before `trades` router or `/{trade_id}` shadows `/brokers`
- **Models**: Define in `backend/app/models/`, import in `__init__.py` so `Base.metadata.create_all` picks them up
- **Schemas**: Pydantic v2 in `backend/app/schemas/`
- **Monetary values**: All returned as **strings** from backend (Decimal serialization)
- **Currency display**: `formatCurrency()` — ₹1.2k, ₹1.50L, ₹1.25Cr (PnL amounts). `formatPrice()` — ₹2,650.50 (entry/exit prices, 2 decimals). `formatQuantity()` — integer without decimals. All in `frontend/src/utils/format.ts`
- **Datetime handling**: Backend stores trade datetimes as **naive IST wall-clock** strings (no timezone suffix). Frontend must not parse `YYYY-MM-DD` or naive backend timestamps with browser timezone rules. `formatDate()` / `formatDateTime()` and `isoToDatetimeLocal()` extract components directly; `datetimeLocalToIso()` sends the entered naive IST value with seconds. Calendar placement must use `tradeDates.ts` / `backend/app/utils/trade_dates.py` helpers.
- **DB**: Alembic runs on startup (`main.py:19-28`). `create_all` fallback only runs in DEBUG/test mode if migrations fail. Prod migration drift fails loudly. Tests override to SQLite (`conftest.py:6-9`). Engine uses `pool_pre_ping=True`.
- **Theme**: CSS variables via `data-theme="dark"|"light"` attr on root. Fonts: Newsreader (display), Inter (body), JetBrains Mono (data/mono)
- **Fluid layout**: Page containers use `clamp()` CSS variables (`--page-px`, `--page-py`, `--page-gap`, `--heading-size`, `--cell-px`, `--cell-py`, `--text-sm`, `--text-xs`) defined in `index.css`. Use `text-[length:var(--x)]` not `text-[var(--x)]` (Tailwind treats `var()` as color by default).
- **Design system**: `frontend/src/new-ui/` is canonical (token-driven primitives — see ADR-023). Slice CSS is layout/grid/gap only; tokens (colors, radii, fonts, shadows) come from `new-ui/tokens`, never redefined per-slice. Cards use the `Card`/`Panel` primitives from `@/new-ui`.
- **Dynamic tiers**: `tier_configs` table, editable via TierEditor on Capital page
- **Direction**: All trades are LONG (Indian equities — no shorting). DB column defaults to `"LONG"`, removed from UI. PnL = `(exit - entry) * qty - fees`
- **Status auto-computed**: Derived from `exit_price` everywhere — no exit = open, has exit = closed. `Trade._auto_set_status()` model method called from `compute_pnl()` (which runs on every insert/update via `before_update` hook and manually in `merge_or_create`). Preserves `"deleted"` status. Old `draft`/`reviewed`/`analytics` values backfilled via `_backfill_trade_statuses()` on startup. Frontend `getStatus()`/`getStatusLabel()` use `exit_price` as source of truth. List filter uses `exit_price IS NULL/NOT NULL`.
- **Status badge colors**: Open → neutral grey (`bg-border text-text-muted`), Closed+profit → green (`bg-profit-muted text-profit`), Closed+loss → red (`bg-loss-muted text-loss`).
- **Status display in detail modal**: Uses `trade.exit_price ? 'Closed' : 'Open'`.
- **Pyramid**: Open positions (no exit) have a pyramid button → `POST /trades/{id}/pyramid`. Adds more shares: weighted-average entry, sum qty, earliest entry, optional stop_price. Only allowed on open trades.
- **Partial exits**: Open positions can have partial exits → `POST /trades/{id}/partial-exits`. Records qty, exit_price, realized_pnl, exit_time, exit_reason. `remaining_qty` computed from `quantity - SUM(partial_exit.qty)`. Full remaining-quantity exits are rejected here; close the trade through the main close flow. Used in dashboard deployed capital calculation.
- **Merge by date**: Trades for same `(symbol, date)` are automatically merged on create/import: weighted-average entry/exit prices, summed quantity/fees/PnL, earliest entry time. Different dates = separate trades. Backfill existing duplicates via `POST /trades/merge-duplicates`.

## Centralized Calculations

### Backend: `backend/app/utils/calculations.py`
- `calculate_trade_metrics()` — returns all metrics in one call (P&L, R-multiple, risk:reward)
- `compute_pnl_value()` — simple PnL
- `compute_r_multiple()` — actual / risk
- `compute_live_pnl()` — LTP-based unrealized
- `compute_aggregate_kpis()` — win_rate, profit_factor, expectancy, avg_r
- `compute_streaks()` — win/loss streak analysis

### Frontend: `frontend/src/utils/calculations.ts`
- `calculateTradeMetrics()` — matches backend
- `computeLivePnl()`, `computeLivePnlPct()`, `computeMaxRisk()`, `computeCapPct()` — UI helpers

### Key principle
- **Planned metrics** (Risk:Reward, Risk Amount) — from stop/target, no exit needed
- **Actual metrics** (Net P&L, R-Multiple) — from exit price
- `Trade.compute_pnl()` now auto-computes BOTH `pnl` AND `r_multiple` using shared module
- `r_multiple` is NO longer a user-editable field in the trade form

## Design System (`frontend/src/new-ui/` — canonical)
`new-ui` is the single canonical design system (ADR-023). Token-driven primitives organized as:
- `primitives/`: Button, Card, Panel, Surface, Badge, Chip, Divider
- `layout/`: AppCanvas, Page, Stack, Cluster, Grid, Section, SplitPane
- `feedback/`: EmptyState, LoadingState, ErrorState, Skeleton
- `data-display/`: Value, MoneyValue, PercentValue, RMultipleValue, Metric, MetricCard, DataRow, DataList, TableShell
- `overlays/`: Drawer, Sheet
- `navigation/`: NavItem, SegmentedControl, Tabs
- `tokens/`: colors, radii, fonts, shadows — the single source for visual tokens.

**Rules**: import from `@/new-ui`. Never redefine tokens per-slice; slice CSS is layout/grid/gap only. The legacy `Glass*`, `SharedUI.tsx`, and `StateComponents.tsx` were dropped from the live render tree in Phase 7 (a few dead files linger in `components/ui/` pending removal — do not import them).

**Carve-outs** (retained in `components/ui/`, no new-ui equivalent yet): `BottomSheet`, `PullToRefresh`, `InstallPrompt`, `ErrorBoundary`, plus `components/actions/ActionsInbox`.

## Rate limiter
- `RateLimiter` middleware in `main.py`. Enabled by default in Docker; set `RATE_LIMIT_OFF=true` in `.env` only when intentionally disabling it. Tests set this.

## Sentry
- Frontend has `@sentry/vite-plugin` + `@sentry/react`. Conditionally loaded if `SENTRY_DSN` env var is set.

## PWA
- manifest.json + service worker registered in `main.tsx`. Installable on phone home screen. SW cache version bumped on deploy (`tj-v3-v4`).

## Exit reason
- Auto-detected when trade is closed: `stop_loss` (exit ≈ stop_price), `target` (exit ≈ target_price), `manual`. User can override. Triggered in `_auto_detect_exit_reason()` in `trades.py`.

## Breakeven threshold
- Configurable ±₹ amount on Account model (`breakeven_threshold`). Default ₹500. Editable in Capital page → Edit Account modal.

## Stop history
- `GET|POST /trades/{id}/stop-history`. Records every stop adjustment. Timeline component in trade detail modal.
- **Stop history updates stop_price**: `POST /trades/{id}/stop-history` also sets `trade.stop_price = payload.price`, so the trade's current SL stays in sync.

## SL inline edit
- Click the SL cell in the trades table to open a compact inline form — enter price + type (Manual/Trailing/Breakeven) → creates stop history entry + updates displayed SL.

## Trades table columns
- Symbol, Entry, Exit, **SL** (inline-editable), **Max Risk** (`(entry - stop) * qty`), Qty, Setup, Status, **P&L %** (`pnl / (entry × qty) × 100`), **Cap %** (`pnl / net_equity × 100`), P&L, Actions.

## Trade list card view
- Responsive: auto-switches to card layout on mobile (<768px)
- Manual toggle with LayoutGrid/LayoutList button in filter bar
- Each card shows: symbol, status, P&L, R-multiple, entry/exit/qty
- Tap card → opens trade detail

## Trade detail page
- Sections: SummaryHeader, PnLHero, MetricGrid, StatCards (8 data points), ChartImageGallery, Notes, Review Notes, Tags, AI Review, LifecyclePanel
- Delete requires confirmation (two clicks)
- Duration display (e.g. "2 days 4h")
- Uses `calculateTradeMetrics()` for all computed values

## Trade form
- 6 clear sections: Trade Basics → Risk Plan → Result → Calculated Metrics → Classification → Notes
- Live preview of all calculated metrics as you type
- Tags input (comma-separated, converted to array on submit)
- `r_multiple` auto-computed by backend — no manual input field

## Setup from playbook
- Trade form's setup dropdown fetches active setups via `useSetupsQuery('active')` instead of hardcoded values. Setup stored as playbook name string on trade. `is_active` is VARCHAR "active"/"archived", not boolean.

## Playbook stats sync
- `_update_setup_stats(db, setup_name)` in `trades.py` recomputes `trade_count`, `win_rate`, `avg_r` on a playbook entry after every trade create/update/delete. Called from create, update (both old + new setup), delete, and pyramid endpoints.

## Chart images
- `POST|DELETE /trades/{id}/images`. Multipart upload, disk storage (`UPLOAD_DIR` env var), served via `/uploads/`. Gallery with nav + delete in trade detail modal.

## Dynamic charts
- `GET /trades/{id}/chart-data` — OHLCV candle data for TradingView Lightweight Charts
- Default timeframe: `1d` (Tapetide supports daily/weekly only)
- Source options: `auto` (cache → Tapetide for daily, cache → Dhan for intraday), `cache`, `tapetide`, `dhan` (stub), `mock` (DEBUG only)
- Valid timeframes: `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `1d`, `1w`
- Tapetide provider (`tapetide_market_data.py`): daily/weekly OHLCV via MCP JSON-RPC. Config: `TAPETIDE_ENABLED`, `TAPETIDE_API_KEY`, `TAPETIDE_MCP_URL`, `TAPETIDE_DEFAULT_EXCHANGE`
- Dhan provider (`dhan_market_data.py`): stub only. Intraday not yet available.
- `MarketCandle` cache table with unique on `(symbol, timeframe, timestamp, source)`
- Intraday timeframes show friendly "Switch to 1D" message when no provider configured

## Discipline rating (DEPRECATED)
- Legacy 1-5 field formerly in the daily journal post-market step. No longer written or read by the V3 journal (`features-v3/journal/`). The `DailyJournal.discipline_rating` column remains in the DB but is slated for a deferred destructive migration (see V3_FINISH_PLAN). Journal now uses `bias_notes` instead.

## Review queue
- `features-v3/review/ReviewV3Page` — per-trade review queue with Unreviewed/All filter and note/tag/grade capture. (The legacy `TradeReviewStream` was retired in the V3 migration.)

## Execution grades
- A–F per dimension (entry_quality, sizing_quality, stop_quality, patience, rule_adherence, exit_quality, overall_grade). Stored in `execution_grades` table. Logged via trade detail modal lifecycle section.

## Trade detail
- Full detail page with P&L hero card, stat grid (entry/exit/qty/fees), chart image gallery, lifecycle timeline (emotion logs, execution grades, stop history, partial exits), AI trade review button.

## Live quotes
- NSE stock prices cached in `live_quotes` table. Updated via `POST /market/sync-quotes` through `backend/app/services/market_data_service.py`. Quote status is exposed as `fresh`, `stale`, `failed`, or `not_synced`. Used for live dashboard position cards and unrealized P&L computation.

## Dashboard architecture
- **Operational dashboard** (`GET /dashboard/operational`): Single endpoint returning KPIs, open trades with live quotes, risk summary (deployed/available/heat/warnings), capital summary (net_equity, deposits, withdrawals, realized PnL, **unrealized PnL**, **total equity with unrealized**), streaks, and **equity curve**.
- **Intelligence dashboard** (`GET /dashboard/intelligence`): Single endpoint returning lifecycle, behavioral, playbook, and market highlights.
- **DashboardPage** shows: KPI cards → **Equity section** (Realized Equity card + Total Equity with Unrealized card + equity curve chart) → Live positions → Risk Command Center → Streaks + Alerts → Collapsible intelligence sections.
- **Equity curve**: Recharts `AreaChart` showing daily realized equity (initial + capital events + closed PnL + partial exits).

## Trading Improvement Loop (ADR-025)
- **Backend**: `ImprovementAction` model (`improvement_actions` table) is the core unit. Router `improvement_actions.py` at prefix `/improvement` (NOT the deprecated `/perf-os`): `GET|POST /improvement/actions`, `GET|PUT|DELETE /improvement/actions/{id}`, `POST /improvement/actions/{id}/select-focus|clear-focus`, `GET /improvement/daily-focus/{date}` → `{focus, backlog}`.
- **Statuses**: suggested/active/kept/broken/retired. **Contract types**: no_early_entry/max_trades/cooldown_after_loss/stop_not_widened/manual_check.
- **Daily Focus Action**: exactly one per `due_session` date (`is_daily_focus`). `select-focus` clears any prior focus for that date and promotes a `suggested` action to `active`.
- **Frontend**: `DailyFocusPanel` (`features-v3/cockpit/components/`) renders inside the Cockpit after the Edge feed; hooks in `features-v3/cockpit/hooks/useImprovementActions.ts`. Manual-first — no suggestion/verification engine, no AI dependency.

## Broker trade import
- **Router**: `backend/app/routers/broker_import.py` — at `/api/v1/trades`, registered **before** trades router
  - `GET /trades/brokers` — list supported brokers
  - `GET /trades/import/template/{broker}` — download CSV template
  - `POST /trades/import?broker={broker}&dry_run=true` — preview which rows would be skipped (existing `(symbol, date)`)
  - `POST /trades/import?broker={broker}` — upload CSV → `{added, merged, skipped, total, errors, preview}`
- **Parser service**: `backend/app/services/broker_import.py`
  - `parse_zerodha_csv()` — auto-detects column names
  - `parse_dhan_csv()` — Dhan tradebook. Aggregates BUY/SELL legs by qty before pairing (handles partial fills).
  - `parse_generic_csv()` — app's own CSV. Required: `symbol, entry_price, quantity, entry_time`. `direction` optional, defaults LONG.
- **Frontend**: `ImportV3Page` (`features-v3/import/`), reached via the topbar **Import** action. Embeds `BrokerImportModal` — broker select → file upload → preview (greyed-out skip indicators) → confirm import
- **Skip**: imports skip existing trades for same `(symbol, date)` instead of merging

## Testing quirks
- Backend: SQLite with fresh DB per test (`conftest.py` sets `DATABASE_URL`, `RATE_LIMIT_OFF`, `SECRET_KEY`, `JWT_SECRET_KEY`)
- `auth_user_token` fixture registers a user and returns JWT
- Some regression tests call router functions directly to avoid ASGI lifespan/TestClient hangs in the sandbox; keep these tests focused on route behavior and DB side effects.
- Frontend: Vitest with jsdom, setup in `src/test/setup.ts`

## Repo conventions
- **Git**: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- **CSS**: Tailwind utility classes + CSS variables (`var(--accent)`, `var(--bg-card)`, etc.) — **never** use hardcoded hex/rgba colors
- **Don't**: create new files unless necessary
- **Design**: `rounded-2xl` = 14px, `.animate-card-in` for card entrance
- **Component pattern**: import primitives from `@/new-ui` (Card, Panel, Button, Badge, etc.). Do not create ad-hoc cards/states or import the dead `Glass*`/`SharedUI`/`StateComponents`.

## Key Documentation Files
- `docs/ARCHITECTURE.md` — complete file map, all models, routers, services, components
- `CONTEXT.md` — domain glossary, trade lifecycle, formulas
- `docs/PROJECT_OVERVIEW.md` — user-facing overview, features, deployment
- `docs/FEATURE_ROADMAP.md` — completed and planned features
- `docs/adr/` — 24 Architecture Decision Records (index: `docs/adr/README.md`)

## Environment variables (key ones)
- `DATABASE_URL` — PostgreSQL connection string (or SQLite for tests)
- `SECRET_KEY`, `JWT_SECRET_KEY` — auth secrets
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` — default 30
- `RATE_LIMIT_OFF` — default `false`; set `true` in `.env` only for local/test bypass
- `VITE_API_URL` — API base URL, default `/api/v1` (build-time)
- `SENTRY_DSN` — optional, enables Sentry error tracking
- `DUCK_DOMAIN` — DuckDNS domain for Traefik HTTPS
- `UPLOAD_DIR` — chart image upload directory, default `uploads/charts`
- `MAX_UPLOAD_SIZE_MB` — max upload size in MB, default 10
- `TAPETIDE_ENABLED` — set `true` to enable daily/weekly OHLCV charts
- `TAPETIDE_API_KEY` — optional Tapetide MCP auth token; blank disables Tapetide calls gracefully
- `TAPETIDE_MCP_URL` — Tapetide MCP endpoint, default `https://mcp.tapetide.com/mcp`
- `TAPETIDE_DEFAULT_EXCHANGE` — exchange prefix, default `NSE`

## Services
| Service | Port | Notes |
|---------|------|-------|
| Postgres | 5432 | user: `trading_journal` (default) |
| Backend | 8000 | uvicorn, health at `/health` |
| Frontend | 3000 | nginx, proxies `/api/v1` to backend |
| Bot | — | Telegram bot, depends on postgres |

## AI Coach
- **Page**: `frontend/src/features-v3/coach/CoachV3Page.tsx` — 5 tabs (Daily Briefing, Weekly Review, Ask, Trade Review, History). Patterns & Rule Check tabs dropped.
- **Types**: `frontend/src/types/coach.ts`
- **Providers** (8 total in `backend/app/core/ai_config.py`):
  - Ollama Local (`FORMAT_OLLAMA` — native `/api/chat` endpoint)
  - Ollama Cloud (`FORMAT_OPENAI` — OpenAI-compatible, cloud catalog models)
  - OpenAI, DeepSeek, Anthropic, Google (all `FORMAT_OPENAI`)
  - Custom (user-defined base URL + model)
  - OpenCode Zen (`FORMAT_OPENAI` — 12 models, 5 free)
- **Mentor personality (REMOVED)**: the 5-mentor personality blend and `GET /ai/mentors` were removed in Phase 1. No mentor sliders in Settings.
- **Endpoints** in `backend/app/routers/coach.py`:
  - `POST /coach/review/daily` — daily AI review
  - `POST /coach/review/weekly` — weekly AI review
  - `POST /coach/insight` — trade-specific insight
  - `POST /coach/ask` — free-form question
  - `POST /coach/patterns` — pattern detection
  - `POST /coach/rule-reminders` — rule violation check
  - `POST /coach/behavioral-score` — composite discipline + AI assessment
  - `POST /coach/trade-review` — structured post-trade review with scoring
  - `GET /coach/reviews` — list past reviews
  - `GET /coach/reviews/{id}` — get single review
  - `DELETE /coach/reviews/{id}` — delete review
  - `GET /journal/weekly-stats` — computes trade count/PnL/win rate/avg R per week
- **Datetime format**: ISO 8601 with `T` separator (`.toISOString()`), not date-only strings
- **Config**: `getAiProviders()` extracts `.data.providers` from backend response
- **Persistence**: `backend/app/core/ai_config.json`
- **Timeout chain**: Frontend axios 120s for coach endpoints → nginx 180s for `/api/v1/coach/` → backend AI client 60-300s (configurable via Settings)
- **Trade review engine**: `/coach/trade-review/{trade_id}` loads playbook data, emotion logs, execution grades, partial exits, and timeline events to produce a structured review with A–F scores, strengths/weaknesses, rule violations, and coaching notes.

## Capital system
- **Models**: `Account` (initial_balance, current_balance, breakeven_threshold), `CapitalEvent` (type: deposit/withdrawal/profit/fee/adjustment/trade_deletion/pyramid)
- **Reconciliation** (`backend/app/routers/capital_events.py`):
  - `_reconcile_account(account_id)` computes `target = initial + deposits - withdrawals + realized_pnl - deployed_capital`
  - Creates `adjustment` event if delta ≠ 0 (audit trail, not silent overwrite)
  - Auto-sync on all trade mutations: create, update, delete, pyramid, merge, CSV import, broker import
  - Manual: `POST /capital-events/accounts/{id}/reconcile`
- **Frontend** (`frontend/src/features-v3/capital/CapitalV3Page.tsx`):
  - Edit starting capital (pencil icon on NetEquityCard)
  - Deposit/Withdraw modals in CapitalEventsManager
  - Delete capital events (trash icon per row)
  - Reconcile button → toast showing delta or "in sync"
  - `reconcileAccount()` endpoint in `frontend/src/lib/endpoints.ts`
- **Trade mutations**: Use `invalidateTradeDomain()` in `frontend/src/lib/queryInvalidation.ts`, not ad-hoc invalidation. This refreshes trades, detail queries, capital dashboard/events, analytics, journal weekly stats, and setup playbook stats after create/update/delete/import/pyramid/stop-history/review/idea-convert paths.
- **Dashboard** (`backend/app/routers/capital_dashboard.py`): filters `Trade.status != "deleted"` for PnL and deployed capital
- **Equity curve**: includes trade PnL (not just capital events)

## Performance OS / Daily SA Notes (REMOVED)
- The standalone Performance OS and Daily SA Notes pages were removed during the V3 migration (Phases 1–9). Their workflows are not part of the V3 surface. Backend `daily_workflows`, `weekly_reviews`, `monthly_reviews` tables are retained but no longer read/written — pending a deferred destructive migration (see V3_FINISH_PLAN). The per-trade Review queue (`features-v3/review/`) covers the review workflow.

## Shared UI components
- **Canonical**: `frontend/src/new-ui/` (see Design System section above). Import everything from `@/new-ui`.
- **Carve-outs** still in `components/ui/`: `BottomSheet`, `PullToRefresh`, `InstallPrompt`, `ErrorBoundary` (no new-ui equivalent yet).
- Legacy `SharedUI.tsx`, `StateComponents.tsx`, and `Glass*` files are dead (no live importers) and pending deletion — do not import them.

## Nginx proxy config
- `/api/v1/coach/` — `proxy_read_timeout 180s` (AI LLM calls can take 30-120s)
- `/api/v1/` — `proxy_read_timeout 60s` (general API)
- Traefik routes `/api/v1` directly to backend:8000 (priority=100), bypassing nginx for API calls. No Traefik timeout limit.
- Service worker cache: `tj-v3-v4`. Bumped on deploy to force asset refresh.

## Known bugs / gotchas
- **SetupPlaybook.is_active**: VARCHAR column with "active"/"archived" values, NOT boolean. Using `== True` causes PostgreSQL operator error. Always use `== "active"`.
- **patchTradeInLists / removeTradeFromLists / addTradeToLists**: Must use `setQueryData` function updater form to prevent race conditions. Never use value-based updater with stale data.
- **profit_factor Infinity**: Returns `None` instead of `float('inf')` when gross_loss is 0. Two `float('inf')` sentinel values remain in `operational_dashboard.py:401` and `market_context.py:451` but are internal-only (never serialized).
- **removeTradeFromLists total**: Only decrements `total` if the trade was actually present in that filtered list variant.
- **apscheduler**: Imported conditionally in `main.py:90-92` inside `lifespan()`. Tests skip scheduler via `"pytest" not in sys.modules` in `_should_start_live_quote_scheduler()`.

## Audit Tracker (2025-05-26)

Full audit report: `docs/AUDIT_2025-05-26.md`. 23 issues created (#30–#52).

### Fixed
- **#30** CRITICAL: Auth added to all 26 API routers. Public: `/auth`, `/health`, `/webhooks/dhan`
- **#31** CRITICAL: `_auto_set_status` moved to `Trade` model, called from `compute_pnl()`. Covers all creation paths.

### Remaining CRITICAL
- **#32**: `_update_setup_stats` missing after broker_import, dhan sync, idea conversion, partial exits
- **#33**: `_auto_reconcile` missing after dhan sync, idea conversion, stop-history update
- **#34**: `_reconcile_account` commits mid-transaction
- **#35**: IST timestamps stored in DB instead of UTC
- **#36**: Capital events update/delete use manual delta instead of full reconcile

### Remaining HIGH
- **#37**: KPI calculation duplicated 5x
- **#38**: Frontend/backend calc sync
- **#39**: 10+ routers bypass service layer
- **#40**: float() for financial calcs

### Remaining MEDIUM (13 issues)
- **#41–#52**: GET mutations, placeholderData, appStore persist, ErrorState dedup, untyped dict, utcnow deprecation, bare status codes, hardcoded colors, stop_history R-multiple, ValueError vs HTTPException, duplicate fetch, duplicate imports
