# Trading Journal v3 — Agent Guide

## Agent skills

### Issue tracker

GitHub Issues at `ryu192-r/TradeJournal-v3`. Uses `gh` CLI. New issues get `needs-triage` + category label. See `docs/agents/issue-tracker.md`.

### Triage labels

Five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) + two categories (`bug`, `enhancement`). Labels already exist on GitHub. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` (glossary + lifecycle + formulas) + `docs/adr/` (20+ ADRs) + `docs/ARCHITECTURE.md` (full file map). See `docs/agents/domain.md`.

### Architecture reference

`docs/ARCHITECTURE.md` — complete file map, all endpoints, models, services, components, design tokens.

## Stack
- **Frontend**: React 19, Vite 8, TypeScript 6, Tailwind 3, Zustand v5 (UI state), TanStack React Query v5 (server state), axios, react-hook-form + zod, recharts, framer-motion, lucide-react
- **Backend**: Python 3.12, FastAPI 0.115, Pydantic v2, SQLAlchemy 2.0 **sync**, PostgreSQL (psycopg2-binary), uvicorn
- **Auth**: JWT (python-jose + bcrypt). Access + refresh tokens in localStorage (`auth_token`, `refresh_token`). 401 → force-logout via page reload.
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
- **View switching**: Zustand `appStore.activeView` (not URL router). Sub-views via `tradeFormMode` (`list|create|edit`). Active views: `dashboard`, `analytics`, `trades`, `playbook`, `review`, `ideas`, `capital`, `settings`, `coach`, `perf-os`, `sa-notes`, `journal`, `calendar`, `reports`, `lifecycle`, `risk`, `market`. Navigation supports Simple/Advanced mode; Simple hides lower-frequency views from the sidebar, not from the code.
- **View code-splitting**: `App.tsx` lazy-loads all major views with `React.lazy`/`Suspense`; keep heavy pages (analytics/recharts, coach, trades) out of the initial bundle.
- **Mobile bottom nav**: Dashboard | Trades | **+** (FAB, create trade) | Analytics | Review. Replaces old grid layout. `frontend/src/components/layout/Sidebar.tsx:162-215`.
- **Data refresh**: React Query refetches on mount/window focus/reconnect. `placeholderData: (previousData) => previousData` on ALL hooks prevents blank states during refetch.
- **Routes**: Register in `backend/app/routers/base.py`, prefix `/api/v1`. **Order matters**: `broker_import` router must come before `trades` router or `/{trade_id}` shadows `/brokers`
- **Models**: Define in `backend/app/models/`, import in `__init__.py` so `Base.metadata.create_all` picks them up
- **Schemas**: Pydantic v2 in `backend/app/schemas/`
- **Monetary values**: All returned as **strings** from backend (Decimal serialization)
- **Currency display**: `formatCurrency()` — ₹1.2k, ₹1.50L, ₹1.25Cr (PnL amounts). `formatPrice()` — ₹2,650.50 (entry/exit prices, 2 decimals). `formatQuantity()` — integer without decimals. All in `frontend/src/utils/format.ts`
- **Datetime handling**: Backend stores **naive UTC** (no timezone suffix). Frontend must append `Z` before parsing to prevent JavaScript interpreting naive strings as local time. Two conversion paths:
  - `formatDate()` / `formatDateTime()` in `format.ts` — for display only. Both call `normalizeTimestring()` to add `Z` to naive strings, then convert UTC→IST via `toISTInternal()`.
  - `isoToDatetimeLocal()` / `datetimeLocalToIso()` in `schemas/tradeForm.ts` — for form inputs. Display: UTC→IST. Save: IST→UTC with `+05:30` suffix. Form defaults use `nowIST()`.
  - **Bug fix**: Without `normalizeTimestring()`, `new Date("2025-05-20T09:16:00")` treats it as local time, then `toIST()` adds +5:30 again — double-converting. Always use `normalizeTimestring()` before `new Date()` on backend timestamps.
- **DB**: Tables created via alembic on startup (`main.py:19-28`). Falls back to `create_all` if migration fails. Prod = PostgreSQL, tests override to SQLite (`conftest.py:6-9`). Engine uses `pool_pre_ping=True`.
- **Theme**: CSS variables via `data-theme="dark"|"light"` attr on root. Fonts: Newsreader (display), Inter (body), JetBrains Mono (data/mono)
- **Fluid layout**: Page containers use `clamp()` CSS variables (`--page-px`, `--page-py`, `--page-gap`, `--heading-size`, `--cell-px`, `--cell-py`, `--text-sm`, `--text-xs`) defined in `index.css`. Use `text-[length:var(--x)]` not `text-[var(--x)]` (Tailwind treats `var()` as color by default).
- **Standard card**: `const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'`
- **Dynamic tiers**: `tier_configs` table, editable via TierEditor on Capital page
- **Direction**: All trades are LONG (Indian equities — no shorting). DB column defaults to `"LONG"`, removed from UI. PnL = `(exit - entry) * qty - fees`
- **Status auto-computed**: Derived from `exit_price` everywhere — no exit = open, has exit = closed. `_auto_set_status()` in `trades.py`. Old `draft`/`reviewed`/`analytics` values backfilled via `_backfill_trade_statuses()` on startup. Frontend `getStatus()`/`getStatusLabel()` use `exit_price` as source of truth. List filter uses `exit_price IS NULL/NOT NULL`.
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

## Design System (Shared UI Components)
- `SharedUI.tsx`: SyncBadge, LastUpdated, SectionHeader, SectionTitle, MetricCard, KpiCard, CollapsibleSection, PageHeader, StatusBadge, InlineBadge, Tabs, AlertRow, SafeAreaPadding
- `StateComponents.tsx`: EmptyState, ErrorState, SectionSkeleton, CardSkeleton, MetricSkeleton
- `GlassButton.tsx`: Primary/accent/danger/ghost variants
- `GlassInput.tsx`, `GlassSelect.tsx`, `GlassTextarea.tsx`: Form inputs
- `GlassCard.tsx`: Standard card (uses CSS vars, not dead `.glass` class)
- `GlassBadge.tsx`: Inline badge chips
- `BottomSheet.tsx`: Slide-up mobile modal
- `PullToRefresh.tsx`: Mobile pull-to-refresh
- **Always use these** instead of creating ad-hoc styles.

## Rate limiter
- `RateLimiter` middleware in `main.py`. Disabled in Docker via `RATE_LIMIT_OFF=true` env var. Tests also set this.

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

## Discipline rating
- 1-5 field in daily journal post-market step (separate from mood). Stored in `DailyJournal.discipline_rating`.

## Review stream
- `TradeReviewStream` supports back navigation, re-review filter (Unreviewed/All Trades), bulk mode (batch notes/tags on selected trades).

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
- **Frontend**: `BrokerImportModal` on TradesPage — broker select → file upload → preview (greyed-out skip indicators) → confirm import
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
- **Component pattern**: Shared UI components in `frontend/src/components/ui/` (SharedUI.tsx, StateComponents.tsx, GlassBadge.tsx, PullToRefresh.tsx). Use these instead of creating new ones.
- **Card class**: `CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'`

## Key Documentation Files
- `docs/ARCHITECTURE.md` — complete file map, all models, routers, services, components
- `CONTEXT.md` — domain glossary, trade lifecycle, formulas
- `docs/PROJECT_OVERVIEW.md` — user-facing overview, features, deployment
- `docs/FEATURE_ROADMAP.md` — completed and planned features
- `docs/adr/` — 20 Architecture Decision Records

## Environment variables (key ones)
- `DATABASE_URL` — PostgreSQL connection string (or SQLite for tests)
- `SECRET_KEY`, `JWT_SECRET_KEY` — auth secrets
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` — default 30
- `RATE_LIMIT_OFF` — set `true` to disable rate limiting (Docker, tests)
- `VITE_API_URL` — API base URL, default `/api/v1` (build-time)
- `SENTRY_DSN` — optional, enables Sentry error tracking
- `DUCK_DOMAIN` — DuckDNS domain for Traefik HTTPS
- `UPLOAD_DIR` — chart image upload directory, default `uploads/charts`
- `MAX_UPLOAD_SIZE_MB` — max upload size in MB, default 10

## Services
| Service | Port | Notes |
|---------|------|-------|
| Postgres | 5432 | user: `trading_journal` (default) |
| Backend | 8000 | uvicorn, health at `/health` |
| Frontend | 3000 | nginx, proxies `/api/v1` to backend |
| Bot | — | Telegram bot, depends on postgres |

## AI Coach
- **Page**: `frontend/src/components/coach/AICoachPage.tsx` — 7 tabs (Daily Briefing, Weekly Review, Ask Coach, Pattern Detection, Rule Check, Trade Review, History)
- **Types**: `frontend/src/types/coach.ts`
- **Providers** (8 total in `backend/app/core/ai_config.py`):
  - Ollama Local (`FORMAT_OLLAMA` — native `/api/chat` endpoint)
  - Ollama Cloud (`FORMAT_OPENAI` — OpenAI-compatible, cloud catalog models)
  - OpenAI, DeepSeek, Anthropic, Google (all `FORMAT_OPENAI`)
  - Custom (user-defined base URL + model)
  - OpenCode Zen (`FORMAT_OPENAI` — 12 models, 5 free)
- **Personality**: 5 mentor profiles (Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde). Each has 0-100 weight. `GET /ai/mentors`. Editable via sliders in Settings page.
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
- **Frontend** (`frontend/src/pages/CapitalPage.tsx`):
  - Edit starting capital (pencil icon on NetEquityCard)
  - Deposit/Withdraw modals in CapitalEventsManager
  - Delete capital events (trash icon per row)
  - Reconcile button → toast showing delta or "in sync"
  - `reconcileAccount()` endpoint in `frontend/src/lib/endpoints.ts`
- **Trade mutations**: Use `invalidateTradeDomain()` in `frontend/src/lib/queryInvalidation.ts`, not ad-hoc invalidation. This refreshes trades, detail queries, capital dashboard/events, analytics, journal weekly stats, and setup playbook stats after create/update/delete/import/pyramid/stop-history/review/idea-convert paths.
- **Dashboard** (`backend/app/routers/capital_dashboard.py`): filters `Trade.status != "deleted"` for PnL and deployed capital
- **Equity curve**: includes trade PnL (not just capital events)

## Performance OS / Daily SA Notes
- **Performance OS** (`frontend/src/pages/PerformanceOSPage.tsx`): Weekly review workflow, monthly reviews, daily SA (Super Analyzer) notes
- **Daily SA Notes** (`frontend/src/pages/DailySANotesPage.tsx`): Pre-market and post-market guided journaling with discipline rating

## Shared UI components
- `frontend/src/components/ui/SharedUI.tsx` — SyncBadge, LastUpdated, SectionHeader, SectionTitle, MetricCard, KpiCard, CollapsibleSection, PageHeader, StatusBadge, InlineBadge, Tabs, AlertRow, SafeAreaPadding
- `frontend/src/components/ui/StateComponents.tsx` — EmptyState, ErrorState, SectionSkeleton, CardSkeleton, MetricSkeleton
- `frontend/src/components/ui/GlassBadge.tsx` — GlassBadge (accent/profit/loss/neutral variants)
- `frontend/src/components/ui/PullToRefresh.tsx` — mobile pull-to-refresh wrapper
- Use these instead of creating ad-hoc loading/error states.

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
