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
- Active views: `dashboard`, `analytics`, `trades`, `journal`, `playbook`, `review`, `ideas`, `capital`, `settings`, `ai-coach`

### Route Registration
- Register in `backend/app/routers/base.py`, prefix `/api/v1`
- **Order matters**: `broker_import` router must come before `trades` router

### Data Flow
- Backend returns monetary values as **strings** (Decimal serialization)
- Frontend formats via `formatCurrency()` (PnL), `formatPrice()` (prices), `formatQuantity()` (quantities)
- All in `frontend/src/utils/format.ts`

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
- Soft delete (status = `"deleted"`)
- Date range filter, bulk select/delete
- Keyboard shortcuts: N (new), J/K (navigate)
- Excel export
- Exit reason auto-detection (stop_price→stop_loss, target→target, else manual) with user override
- Stop history (audit trail of stop adjustments, timeline in trade detail modal)
- Chart image upload/delete/gallery (multipart, disk storage, served via `/uploads/`)

### Broker Import
- Zerodha Console P&L CSV parser
- Dhan tradebook CSV parser (aggregates BUY/SELL legs by qty for partial fills)
- Generic CSV parser (app's own format)
- Preview before import with greyed-out skip indicators (trades existing for same symbol+date)
- Dry-run mode to check duplicates without importing
- Import skips existing trades instead of merging

### Dashboard
- KPI cards (total PnL, win rate, avg R, etc.)
- Equity curve (includes trade PnL + capital events)
- Win/loss streaks
- Monthly PnL bar chart

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
- 8 providers: Ollama (local + cloud), OpenAI, DeepSeek, Anthropic, Google, Custom, OpenCode Zen
- Ollama uses native `/api/chat` format; others use OpenAI-compatible format
- Configured via Settings page or `ai_config.json`
- **Personality blending**: 5 mentor profiles (Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde) each weighted 0-100% via sliders in Settings page

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

### TradesPage
- Horizontal scroll table (`overflow-x-auto` + `min-w-[700px]`) for mobile
- Click symbol → trade detail modal
- Pyramid button on open positions
- Status column: "Open" / "Closed" based on `exit_price`
- Stacked pagination on mobile

## Testing
- **Backend**: 130+ tests, pytest + httpx ASGI client, SQLite per test
- **Frontend**: Vitest + jsdom, setup in `src/test/setup.ts`
- Run: `cd backend && python3 -m pytest tests/ -v`

## Deployment
- Docker Compose with 4 services
- External Traefik handles HTTPS + DuckDNS
- Frontend build arg `VITE_API_URL=/api/v1`
- Health check at `/health`
