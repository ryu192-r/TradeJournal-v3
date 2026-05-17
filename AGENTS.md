# Trading Journal v3 — Agent Guide

## Agent skills

### Issue tracker

GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

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
- **Auth gate**: `App.tsx` checks `isAuthenticated` — all pages require login
- **View switching**: Zustand `appStore.activeView` (not URL router). Sub-views via `tradeFormMode` (`list|create|edit`). Active views: `dashboard`, `analytics`, `trades`, `journal`, `playbook`, `review`, `ideas`, `capital`, `settings`, `coach`
- **View code-splitting**: `App.tsx` lazy-loads all major views with `React.lazy`/`Suspense`; keep heavy pages (analytics/recharts, coach, trades) out of the initial bundle.
- **Data refresh**: React Query refetches on mount/window focus/reconnect. Trade-domain mutations call `invalidateTradeDomain()` (`trades`, `trade`, `capital-dashboard`, `capital-events`, `analytics`, journal weekly stats, `setups`). Capital-event mutations call `invalidateCapitalDomain()`.
- **Routes**: Register in `backend/app/routers/base.py`, prefix `/api/v1`. **Order matters**: `broker_import` router must come before `trades` router or `/{trade_id}` shadows `/brokers`
- **Models**: Define in `backend/app/models/`, import in `__init__.py` so `Base.metadata.create_all` picks them up
- **Schemas**: Pydantic v2 in `backend/app/schemas/`
- **Monetary values**: All returned as **strings** from backend (Decimal serialization)
- **Currency display**: `formatCurrency()` — ₹1.2k, ₹1.50L, ₹1.25Cr (PnL amounts). `formatPrice()` — ₹2,650.50 (entry/exit prices, 2 decimals). `formatQuantity()` — integer without decimals. All in `frontend/src/utils/format.ts`
- **DB**: Tables created via alembic on startup (`main.py:19-28`). Falls back to `create_all` if migration fails. Prod = PostgreSQL, tests override to SQLite (`conftest.py:6-9`). Engine uses `pool_pre_ping=True`.
- **Theme**: CSS variables via `data-theme="dark"|"light"` attr on root. Fonts: Newsreader (display), Inter (body), JetBrains Mono (data/mono)
- **Fluid layout**: Page containers use `clamp()` CSS variables (`--page-px`, `--page-py`, `--page-gap`, `--heading-size`, `--cell-px`, `--cell-py`, `--text-sm`, `--text-xs`) defined in `index.css`. Use `text-[length:var(--x)]` not `text-[var(--x)]` (Tailwind treats `var()` as color by default).
- **Dynamic tiers**: `tier_configs` table, editable via TierEditor on Capital page
- **Direction**: All trades are LONG (Indian equities — no shorting). DB column defaults to `"LONG"`, removed from UI. PnL = `(exit - entry) * qty - fees`
- **Status auto-computed**: Derived from `exit_price` everywhere — no exit = open, has exit = closed. `_auto_set_status()` in `trades.py`. Old `draft`/`reviewed`/`analytics` values backfilled via `_backfill_trade_statuses()` on startup. Frontend `getStatus()`/`getStatusLabel()` use `exit_price` as source of truth. List filter uses `exit_price IS NULL/NOT NULL`.
- **Status badge colors**: Open → neutral grey (`bg-border text-text-muted`), Closed+profit → green (`bg-profit-muted text-profit`), Closed+loss → red (`bg-loss-muted text-loss`).
- **Status display in detail modal**: Uses `trade.exit_price ? 'Closed' : 'Open'`.
- **Pyramid**: Open positions (no exit) have a pyramid button → `POST /trades/{id}/pyramid`. Adds more shares: weighted-average entry, sum qty, earliest entry, optional stop_price. Only allowed on open trades.
- **Merge by date**: Trades for same `(symbol, date)` are automatically merged on create/import: weighted-average entry/exit prices, summed quantity/fees/PnL, earliest entry time. Different dates = separate trades. Backfill existing duplicates via `POST /trades/merge-duplicates`.
- **Rate limiter**: `RateLimiter` middleware in `main.py`. Disabled in Docker via `RATE_LIMIT_OFF=true` env var. Tests also set this.
- **Sentry**: Frontend has `@sentry/vite-plugin` + `@sentry/react`. Conditionally loaded if `SENTRY_DSN` env var is set.
- **PWA**: manifest.json + service worker registered in `main.tsx`. Installable on phone home screen.
- **Exit reason**: Auto-detected when trade is closed: `stop_loss` (exit ≈ stop_price), `target` (exit ≈ target_price), `manual`. User can override. Triggered in `_auto_detect_exit_reason()` in `trades.py`.
- **Breakeven threshold**: Configurable ±₹ amount on Account model (`breakeven_threshold`). Default ₹500. Editable in Capital page → Edit Account modal.
- **Stop history**: `GET|POST /trades/{id}/stop-history`. Records every stop adjustment. Timeline component in trade detail modal.
- **Stop history updates stop_price**: `POST /trades/{id}/stop-history` also sets `trade.stop_price = payload.price`, so the trade's current SL stays in sync.
- **SL inline edit**: Click the SL cell in the trades table to open a compact inline form — enter price + type (Manual/Trailing/Breakeven) → creates stop history entry + updates displayed SL.
- **Trades table columns**: Symbol, Entry, Exit, **SL** (inline-editable), **Max Risk** (`(entry - stop) * qty`), Qty, Setup, Status, **P&L %** (`pnl / (entry × qty) × 100`), **Cap %** (`pnl / net_equity × 100`), P&L, Actions.
- **Setup from playbook**: Trade form's setup dropdown fetches active setups via `useSetupsQuery('active')` instead of hardcoded values. Setup stored as playbook name string on trade.
- **Playbook stats sync**: `_update_setup_stats(db, setup_name)` in `trades.py` recomputes `trade_count`, `win_rate`, `avg_r` on a playbook entry after every trade create/update/delete. Called from create, update (both old + new setup), delete, and pyramid endpoints.
- **Chart images**: `POST|DELETE /trades/{id}/images`. Multipart upload, disk storage (`UPLOAD_DIR` env var), served via `/uploads/`. Gallery with nav + delete in trade detail modal.
- **Discipline rating**: 1-5 field in daily journal post-market step (separate from mood). Stored in `DailyJournal.discipline_rating`.
- **Review stream**: `TradeReviewStream` supports back navigation, re-review filter (Unreviewed/All Trades), bulk mode (batch notes/tags on selected trades).

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
- Frontend: Vitest with jsdom, setup in `src/test/setup.ts`

## Repo conventions
- **Git**: conventional commits (`feat:`, `fix:`, `docs:`)
- **CSS**: Tailwind utility classes + CSS variables (`var(--accent)`, `var(--bg-card)`, etc.) — **never** use hardcoded hex/rgba colors
- **Don't**: create new files unless necessary
- **Design**: `rounded-2xl` = 14px, `.animate-card-in` for card entrance

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
- **Page**: `frontend/src/pages/AICoachPage.tsx` — 6 tabs (Daily Briefing, Weekly Review, Ask Coach, Pattern Detection, Rule Builder, History)
- **Types**: `frontend/src/types/coach.ts`
- **Providers** (8 total in `backend/app/core/ai_config.py`):
  - Ollama Local (`FORMAT_OLLAMA` — native `/api/chat` endpoint)
  - Ollama Cloud (`FORMAT_OPENAI` — OpenAI-compatible, cloud catalog models)
  - OpenAI, DeepSeek, Anthropic, Google (all `FORMAT_OPENAI`)
  - Custom (user-defined base URL + model)
  - OpenCode Zen (`FORMAT_OPENAI` — 12 models, 5 free)
- **Personality**: 5 mentor profiles (Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde). Each has 0-100 weight. `GET /ai/mentors`. Editable via sliders in Settings page.
- **Endpoints** in `backend/app/routers/daily_journal.py`:
  - `POST /coach/daily-briefing`
  - `POST /coach/weekly-review`
  - `POST /coach/ask`
  - `POST /coach/patterns`
  - `POST /coach/rules/generate`
  - `POST /coach/rules/enforce`
  - `GET /coach/history`
  - `GET /journal/weekly-stats` — computes trade count/PnL/win rate/avg R per week
- **Datetime format**: ISO 8601 with `T` separator (`.toISOString()`), not date-only strings
- **Config**: `getAiProviders()` extracts `.data.providers` from backend response
- **Persistence**: `backend/app/core/ai_config.json`

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
