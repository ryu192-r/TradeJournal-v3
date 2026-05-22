# Trading Journal v3 — Project Overview

## What It Is
A full-stack personal trading journal for Indian equity traders. Tracks trades, computes performance metrics, provides AI-powered coaching, and manages capital with automatic reconciliation.

## Target User
Indian retail equity traders who:
- Trade only LONG positions (no shorting)
- Use brokers like Zerodha or Dhan
- Want to track performance, identify patterns, and get AI feedback
- Need capital management with deposit/withdrawal tracking

## Tech Stack

### Frontend
- React 19, Vite 8, TypeScript 6
- Tailwind 3 with CSS custom properties for theming
- Zustand v5 (UI state), TanStack React Query v5 (server state)
- recharts (charts), framer-motion (animations), lucide-react (icons)
- react-hook-form + zod (form validation)
- PWA support (manifest + service worker)
- Sentry (conditional via `SENTRY_DSN` env var)

### Backend
- Python 3.12, FastAPI 0.115, Pydantic v2
- SQLAlchemy 2.0 **sync** (not async)
- PostgreSQL (psycopg2-binary), SQLite for tests
- JWT auth (python-jose + bcrypt)
- Rate limiter middleware (disabled in Docker via `RATE_LIMIT_OFF=true`)

### Infrastructure
- Docker Compose: postgres + backend + frontend + bot
- External Traefik for HTTPS/DuckDNS
- nginx in frontend container proxies `/api/v1/` → `http://backend:8000`

## Architecture

### Auth
- JWT access + refresh tokens in localStorage (`auth_token`, `refresh_token`)
- `App.tsx` checks `isAuthenticated` — all pages require login
- 401 → force-logout via page reload

### View System
- Zustand `appStore.activeView` controls pages (not URL router)
- Sub-views via `tradeFormMode` (`list|create|edit`)
- Active views: `dashboard`, `analytics`, `trades`, `playbook`, `review`, `ideas`, `capital`, `settings`, `coach`, `perf-os`, `sa-notes`
- Navigation supports persisted Simple / Advanced modes. Simple mode focuses the daily loop; Advanced mode exposes analytics, AI Coach, SA Notes, and idea/research surfaces.
- Major views are code-split with `React.lazy`/`Suspense`; analytics/recharts, trades, capital, coach loaded on demand

### Route Registration
- Register in `backend/app/routers/base.py`, prefix `/api/v1`
- **Order matters**: `broker_import` router must come before `trades` router

### Data Flow
- Backend returns monetary values as **strings** (Decimal serialization)
- Frontend formats via `formatCurrency()` (PnL), `formatPrice()` (prices), `formatQuantity()` (quantities)
- All in `frontend/src/utils/format.ts`
- React Query refetches on mount/window focus/reconnect
- `placeholderData: (previousData) => previousData` on ALL hooks prevents blank states during refetch
- Trade-impacting mutations use `invalidateTradeDomain()`
- Capital-event mutations use `invalidateCapitalDomain()`

### Theme
- CSS variables via `data-theme="dark"|"light"` on root
- Fonts: Newsreader (display), Inter (body), JetBrains Mono (data/mono)
- **Never** use hardcoded hex/rgba — always CSS variables

### Fluid Layout
- Page containers use `clamp()` CSS variables (`--page-px`, `--page-py`, `--page-gap`, `--heading-size`, `--cell-px`, `--cell-py`, `--text-sm`, `--text-xs`)
- Defined in `frontend/src/index.css`
- Use `text-[length:var(--x)]` not `text-[var(--x)]` (Tailwind treats `var()` as color)

## Key Features

### Trade Management
- CRUD for trades (all LONG only)
- Auto-merge by `(symbol, date)`: weighted-average prices, summed qty/fees/PnL
- Pyramid: add shares to open positions (weighted-average entry, optional stop update)
- Partial exits: record partial closes on open positions with realized PnL
- Soft delete (status = `"deleted"`)
- Open/Closed is derived from `exit_price` (no exit = open, has exit = closed)
- Date range filter, bulk select/delete
- Keyboard shortcuts: N (new), J/K (navigate)
- Excel export
- Exit reason auto-detection (stop_price→stop_loss, target→target, else manual) with user override
- Stop history (audit trail of stop adjustments, timeline in trade detail modal)
- Trades table includes inline SL editing, Max Risk, P&L %, and Cap % columns
- Setup dropdown is fetched from Playbook active setups and playbook stats sync after trade mutations
- Chart image upload/delete/gallery (multipart, disk storage, served via `/uploads/`)
- Execution grades (A–F per dimension) via trade detail modal
- Trade detail page with hero P&L card, stat grid, lifecycle timeline

### Broker Import
- Zerodha Console P&L CSV parser
- Dhan tradebook CSV parser (aggregates BUY/SELL legs by qty for partial fills)
- Generic CSV parser (app's own format)
- Preview before import with greyed-out skip indicators (trades existing for same symbol+date)
- Dry-run mode to check duplicates without importing
- Import skips existing trades instead of merging

### Dashboard
- Primary data source: `GET /dashboard/operational`
- KPI cards (Net P&L, Win Rate, Profit Factor, Avg R, Expectancy, Max DD)
- **Equity section** — two cards: Realized Equity (net_equity) and Total Equity (including unrealized P&L from live quotes), plus equity curve chart
- Live positions with real-time market data
- Risk Command Center (portfolio heat, deployed capital, open risk, warnings)
- Win/loss streaks
- Collapsible intelligence sections (lifecycle, behavioral, playbook, market context)

### Analytics
- Daily PnL heatmap
- Setup performance breakdown
- R-multiple distribution
- Drawdown chart
- Day-of-week / time-of-day patterns
- Holding period analysis

### Journal
- Daily journal entries with structured prompts (pre-market plan, post-market reflection)
- Discipline rating (1-5) separate from mood — measures rule adherence
- Weekly stats: trade count, PnL, win rate, avg R
- Weekly view with real computed stats + daily entries

### AI Coach
- 6 tabs: Daily Briefing, Weekly Review, Ask Coach, Pattern Detection, Rule Builder, History
- Trade Review engine with A–F scoring
- Behavioral Score (composite discipline + AI assessment)
- 8 providers: Ollama (local + cloud), OpenAI, DeepSeek, Anthropic, Google, Custom, OpenCode Zen
- Ollama uses native `/api/chat` format; others use OpenAI-compatible format
- Configured via Settings page or `ai_config.json`
- **Personality blending**: 5 mentor profiles (Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde) each weighted 0-100% via sliders in Settings page
- **Timeout chain**: Frontend 120s → nginx 180s → backend 60-300s (configurable)

### Capital Management
- Set initial balance, edit anytime
- Deposit / Withdraw capital events
- Delete capital events (trash icon)
- Deployed vs Available capital display
- **Auto-reconciliation** on all trade mutations:
  - Creates `adjustment` events for audit trail
  - Excludes deleted trades from realized PnL and deployed capital
  - `trade_deletion` event records PnL removed when closed trade is deleted
  - Manual reconcile button with toast feedback
- Breakeven threshold (±₹ amount, configurable via Edit Account modal)
- Dynamic tiers (editable via TierEditor)
- **Net equity**: initial + deposits - withdrawals + realized PnL + partial exit PnL
- **Total equity**: net equity + unrealized P&L (live quotes × open positions)
- **Equity curve**: daily running total of realized equity

### Performance OS / Daily SA Notes
- Performance OS is the primary daily workflow shell: pre-market checklist, execution notes, review, behavior state, weekly review, and monthly review.
- Textareas autosave with local draft state, debounce, blur flush, and queued latest-write behavior.
- Daily SA Notes remain available as a deeper note surface, but the default daily loop starts in Performance OS.

### Market Context / Live Quotes
- `POST /market/sync-quotes` syncs cached live quotes for open positions.
- `GET /market/live-quotes` returns cached quotes with freshness states: `fresh`, `stale`, `failed`, `not_synced`.
- Dashboard live positions, Trades LTP cells, and Market watchlist surface stale and failed quote states.
- Market performance correlation breaks down PnL by NIFTY trend/regime, VIX bucket, breadth, and earnings context.

### Lifecycle Analytics
- Deterministic endpoints under `/lifecycle`: emotion summary, grade summary, behavioral analytics, revenge trades, overtrading, early exits, and composite discipline score.
- AI Coach can consume these signals, but deterministic calculations remain the source of truth.

## Testing
- **Backend**: pytest, SQLite per test. New router regressions use direct router-function tests where `TestClient` lifespan is unreliable in the sandbox.
- **Frontend**: Vitest + jsdom, setup in `src/test/setup.ts`
- Run: `cd backend && python3 -m pytest tests/ -v`

## Architecture Decisions
- ADR-016: Performance OS daily review domain
- ADR-017: Operational dashboard aggregate endpoint
- ADR-018: Lifecycle analytics model
- ADR-019: Partial exits and remaining quantity
- ADR-020: Live quote cache and market data provider

## Deployment
- Docker Compose with 4 services
- External Traefik handles HTTPS + DuckDNS
- Frontend build arg `VITE_API_URL=/api/v1`
- Health check at `/health`
- nginx proxies `/api/v1/coach/` with 180s timeout (AI LLM calls)
- Service worker cache version `tj-v3-v4`

## Known Gotchas
- **SetupPlaybook.is_active**: VARCHAR "active"/"archived", NOT boolean
- **patchTradeInLists**: Must use `setQueryData` function updater form
- **profit_factor Infinity**: Returns `None` instead of `float('inf')`
- **removeTradeFromLists total**: Only decrements if tradewas present in list
