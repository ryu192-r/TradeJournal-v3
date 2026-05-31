# Trading Journal v3 — Project Overview

> **Personal trading journal with AI coaching, capital management, and live market data.**
> Last updated: May 2026 — v2 Phase-1 polish shipped (shared components, mobile nav, trade detail polish)

---

## Current Status — Production Live

The app is deployed at `https://tjv3.duckdns.org` with full functionality. All core features are complete and working. The v2 overhaul has centralized all trade calculations, established a design system, polished the trade detail page, and improved mobile navigation.

### Production Health
| Check | Result |
|-------|--------|
| Backend | Healthy — 200 tests passing |
| Frontend | Production build + typecheck — 0 errors, 43 tests passing |
| PostgreSQL | Healthy |
| Core API endpoints | Authenticated routes covered by regression tests |
| Service Worker | v4 (auto-updates) |
| Test account | `test@test.com` / `test123456` |

---

## Architecture

```
Browser → Traefik (HTTPS/DuckDNS, priority=100 for /api/v1)
        → Backend:8000 (FastAPI)
        → Frontend:3000 (nginx) → Backend:8000 (for non-coach API)
        → PostgreSQL:5432
        → Bot (Telegram, optional)
```

- **Frontend**: React 19 SPA — 20 pages, code-split with `React.lazy`
- **Backend**: FastAPI with 28 routers, sync SQLAlchemy, Pydantic v2
- **DB**: PostgreSQL with Alembic migrations (SQLite for tests)
- **Auth**: JWT (access + refresh tokens in localStorage)
- **AI**: 8 providers via configurable routing

---

## Tech Stack

### Frontend
- React 19, Vite 8, TypeScript 6
- Tailwind 3 with CSS custom properties (dark/light themes)
- Zustand v5 (UI state), TanStack React Query v5 (server state)
- recharts (charts), framer-motion (animations), lucide-react (icons)
- react-hook-form + zod (form validation)
- PWA support (manifest + service worker)
- Sentry (conditional via `SENTRY_DSN` env var)

### Backend
- Python 3.12, FastAPI 0.115, Pydantic v2
- SQLAlchemy 2.0 sync, PostgreSQL (psycopg2-binary)
- JWT auth (python-jose + bcrypt)
- APScheduler (live quote sync, conditional import)

### Infrastructure
- Docker Compose: 4 services (postgres, backend, frontend, bot)
- External Traefik for HTTPS/DuckDNS
- nginx in frontend container proxies `/api/v1/`

---

## Key Components

### Dashboard (`GET /dashboard/operational`)
Single-call payload returning:
- KPI cards: Net P&L, Win Rate, Profit Factor, Avg R, Expectancy, Max DD
- Equity section: Realized Equity card + Total Equity (with unrealized) card + equity curve chart
- Open trades with live NSE quotes
- Risk Command Center: portfolio heat, deployed capital, available capital, warnings
- Capital summary: net_equity, unrealized_pnl, total_equity_unrealized
- Streaks: current win/loss streak, longest win/loss
- Equity curve: daily running total

### Trade Management
- CRUD with auto-merge by `(symbol, date)`
- Pyramid (weighted-average entry, sum qty)
- Partial exits (record scaled exits, remaining_qty tracking)
- Chart image upload/gallery (multipart, disk storage)
- Trade detail page: PnL hero, 8 metric cards, stat grid, lifecycle timeline, AI review
- Trade form: 6 clear sections with live calculation preview
- Trade list: responsive table/card view with manual toggle
- Broker import: Zerodha, Dhan, Generic CSV with preview

### AI Coach (8 providers, 12 endpoints)
- Daily/weekly reviews, trade insight, free-form Q&A, pattern detection, rule reminders
- Trade Review engine with A–F scoring across 6 dimensions
- Behavioral Score (programmatic + AI composite)
- 5 mentor personalities with 0-100% blending
- Timeout chain: 120s frontend → 180s nginx → 60-300s backend

### Capital System
- Net equity = initial + capital events + realized PnL + partial exit PnL
- Total equity = net equity + unrealized P&L (live quotes × open positions)
- Auto-reconciliation on all trade mutations
- Dynamic tier system with editable thresholds
- Equity curve in both Dashboard and Capital pages

### Lifecycle Analytics
- Emotion logs, execution grades (A–F), stop history, partial exits
- Discipline score: journal discipline + execution grades + emotion logs + rule adherence
- Overtrading detection, revenge trade detection, early exit analysis
- Behavioral patterns: emotion × grade matrix, discipline insights

### Market Context / Live Quotes
- `LiveQuote` caches NSE stock prices used for unrealized P&L
- Quote status: `fresh`, `stale`, `failed`, `not_synced`
- Market performance correlation (PnL by NIFTY trend/regime/VIX/breadth)
- Market regime summary

### Performance OS
- Daily workflow: pre-market → execution → review → behavior phases
- Weekly/monthly review workflows with guided templates
- Daily SA Notes for deep pre-market and post-market journaling

### Design System
- 17 shared UI components in `frontend/src/components/ui/`
- Design tokens: CSS variables for all colors, spacing, typography
- Fluid responsive layout via `clamp()` CSS functions
- Mobile bottom nav with raised FAB for quick trade creation

### Centralized Calculations
- Backend: `backend/app/utils/calculations.py` — `calculate_trade_metrics()`, KPIs, streaks
- Frontend: `frontend/src/utils/calculations.ts` — matching client-side module
- Planned metrics (Risk:Reward, Risk Amount) from stop/target
- Actual metrics (Net P&L, R-Multiple) from exit price
- `r_multiple` auto-computed — no longer user-editable

---

## API Endpoints (40+)

### Core
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login`, `/auth/register`, `/auth/refresh` | Auth |
| CRUD | `/trades/` | Trade management with auto-merge, pyramid, partial exits |
| CRUD | `/accounts/`, `/capital-events/` | Account & capital management |
| CRUD | `/setups/` | Playbook with auto stats sync |
| CRUD | `/ideas/` | Trade ideas with convert-to-trade |
| GET | `/dashboard/operational` | KPI + trades + risk + capital + equity curve |
| GET | `/dashboard/intelligence` | Lifecycle + behavioral + playbook + market |

### AI Coach
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/coach/review/daily` | Daily AI review |
| POST | `/coach/review/weekly` | Weekly AI review |
| POST | `/coach/insight` | Trade-specific insight |
| POST | `/coach/ask` | Free-form question |
| POST | `/coach/patterns` | Pattern detection |
| POST | `/coach/rule-reminders` | Rule violation check |
| POST | `/coach/behavioral-score` | Composite discipline + AI assessment |
| POST | `/coach/trade-review` | Structured post-trade review |
| GET/DELETE | `/coach/reviews/{id}` | Review CRUD |

### Market & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/analytics/dashboard` | Full analytics payload |
| POST | `/market/sync-quotes` | Sync live NSE prices |
| GET | `/market/live-quotes` | Cached quotes with freshness |
| GET | `/lifecycle/emotion-summary` | Emotion analysis |
| GET | `/lifecycle/behavioral` | Behavioral analytics |
| GET | `/lifecycle/revenge-trades` | Revenge trade detection |

---

## Database Models (19)

| Model | Table | Key Fields |
|-------|-------|-----------|
| Trade | `trades` | symbol, entry/exit price, qty, pnl, r_multiple, stop/target, fees, setup, exit_reason, chart_images(JSON) |
| PartialExit | `partial_exits` | trade_id, qty, exit_price, realized_pnl, r_captured |
| StopHistory | `stop_history` | trade_id, stop_type, price, timestamp |
| TradeTimeline | `trade_timelines` | trade_id, event_type, old/new values |
| EmotionLog | `emotion_logs` | trade_id, emotion, confidence, stress, conviction, focus |
| ExecutionGrade | `execution_grades` | trade_id, 6 dimension grades (A–F) |
| Account | `accounts` | name, initial_balance, current_balance, breakeven_threshold |
| CapitalEvent | `capital_events` | type(deposit/withdrawal/etc), amount, trade_id |
| SetupPlaybook | `setup_playbook` | name, is_active(VARCHAR), trade_count, win_rate, avg_r |
| LiveQuote | `live_quotes` | symbol, ltp, change_pct, volume |
| DailyJournal | `daily_journals` | date, pre/post notes, mood, discipline_rating |
| Others | — | TradeIdea, CoachReview, MarketSnapshot, Milestone, TierConfig, User, DailyWorkflow, WeeklyReview, MonthlyReview |

---

## Architecture Decisions (20 ADRs)

| ADR | Decision |
|-----|----------|
| 001 | Trade merge by (symbol, date) |
| 002 | Capital auto-reconciliation |
| 003 | AI provider routing (8 providers) |
| 004 | LONG-only trades (Indian equities) |
| 005 | Fluid responsive layout (clamp) |
| 006 | Zustand view switching (no URL router) |
| 007 | Decimal string serialization |
| 008 | JWT in localStorage |
| 009 | Router ordering (broker_import before trades) |
| 010 | Sync SQLAlchemy engine |
| 011 | Dual state (Zustand + React Query) |
| 012 | Trade status lifecycle (auto-computed) |
| 013 | nginx + Traefik proxy |
| 015 | Alembic migrations |
| 016 | Performance OS domain model |
| 017 | Operational dashboard aggregate endpoint |
| 018 | Lifecycle analytics model |
| 019 | Partial exits and remaining quantity |
| 020 | Live quote cache and market data provider |

---

## Testing

| Layer | Framework | Location | Count |
|-------|-----------|----------|-------|
| Backend | pytest + SQLite | `backend/tests/` | 200 tests |
| Frontend | Vitest + jsdom | `frontend/src/test/` | 43 tests |
| TypeScript | `tsc --noEmit` | — | 0 errors |

```bash
# Run all tests
cd backend && python3 -m pytest tests/ -v
cd frontend && npx vitest run
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

---

## Deployment

```bash
docker compose up -d --build          # full stack
docker compose logs -f backend        # backend logs
cd backend && python3 -m pytest tests/ -v   # tests
cd frontend && npm run dev             # dev server
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | SQLite | PostgreSQL connection string |
| `SECRET_KEY` | — | Auth secret |
| `JWT_SECRET_KEY` | — | JWT signing key |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Token expiry |
| `RATE_LIMIT_OFF` | false | Disable rate limiting only when set in `.env` |
| `VITE_API_URL` | `/api/v1` | API base URL (build-time) |
| `SENTRY_DSN` | — | Optional Sentry |
| `UPLOAD_DIR` | `uploads/charts` | Chart image storage |
| `TAPETIDE_API_KEY` | — | Optional Tapetide MCP token; blank disables Tapetide calls gracefully |

### Service Ports
| Service | Port |
|---------|------|
| Postgres | 5432 |
| Backend | 8000 |
| Frontend | 3000 |

---

## Key Documentation

- `docs/ARCHITECTURE.md` — complete file map, every endpoint, every component
- `CONTEXT.md` — domain glossary, trade lifecycle, formulas
- `docs/FEATURE_ROADMAP.md` — completed and planned features
- `docs/adr/` — 20 Architecture Decision Records
- `AGENTS.md` — agent guide with stack, commands, conventions

## Test User & Sample Data

- Email: `test@test.com`, Password: `test123456`
- Account initial_balance: ~₹285,000
- 21 trades (17 closed, 4 open), 26 capital events, 1 partial exit
