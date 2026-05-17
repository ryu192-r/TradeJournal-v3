# Trading Journal v3 — Complete Project Documentation

> **Personal trading journal that tracks trades, PnL, setups, rules, and helps growth through analytics and AI coaching.**
> Last updated: 13 May 2026 — Full stack running in Docker with nginx proxy, error boundaries, dead code removed, Alembic consolidated

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [File Structure](#file-structure)
5. [Implementation Status](#implementation-status)
6. [What's Working](#whats-working)
7. [Known Gaps & Next Steps](#known-gaps--next-steps)
8. [Kanban Workflow & AI Profiles](#kanban-workflow--ai-profiles)
9. [Deployment](#deployment)
10. [API Documentation](#api-documentation)
11. [Database Schema](#database-schema)
12. [Bugs Fixed (May 2026)](#bugs-fixed-may-2026)
13. [Future Roadmap](#future-roadmap)

---

## Project Overview

Trading Journal v3 is a self-hosted personal trading platform. It evolved from a Python/SQLite desktop app (v2) into a modern web application with:

- **Trade tracking** — log every trade, auto-compute PnL, track setups
- **Daily journaling** — pre/post trade notes, mood tracking, rule adherence
- **Setup Playbook** — 7 canonical + custom setups with full CRUD
- **Trade Ideas** — capture observations before executing, convert to trades
- **Analytics Dashboard** — 10 endpoints: KPI, streaks, setup performance, R-distribution, monthly/daily PnL, day-of-week, time-of-day, holding period, full dashboard
- **AI Coach** — Ollama-integrated pattern detection, daily/weekly reviews, rule reminders
- **Broker Integration** — Dhan API sync + real-time webhook handling
- **Telegram Bot** — free-form trade parsing ("Bought RELIANCE 50 @ 2650"), daily summaries, stop reminders
- **Zero data loss** — daily CSV backups to Telegram, soft deletes
- **Fresh UI by default** — trade/capital mutations invalidate all dependent React Query domains; views refetch on mount, focus, and reconnect
- **Fast initial load** — major views are code-split, with analytics/recharts and other heavy sections loaded on demand

### Design Philosophy
- Journal should "just work" — zero tolerance for lag/broken states
- Data loss is unacceptable — daily backups, soft deletes
- Personalized — evolves with user's trading journey
- All monetary values as Decimal (Numeric 18,8) — no float precision loss

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (React 19)            │
│  Glass morphism UI, lazy-loaded views,           │
│  Review stream, Analytics dashboard (8 charts)   │
│  Port: 3000  (serve -s dist)                     │
├─────────────────────────────────────────────────┤
│              Backend API (FastAPI)               │
│  13 routers, 10 services, 12 models             │
│  50+ endpoints, Ollama AI Coach                 │
│  Port: 8000                                      │
├─────────────────────────────────────────────────┤
│         Telegram Bot (python-telegram-bot)       │
│  Free-form trade parsing, Daily summaries,       │
│  Stop reminders every 2h                         │
├─────────────────────────────────────────────────┤
│        PostgreSQL 16 (via Docker)                │
│  Persistent data volume, tables auto-created     │
│  on startup via SQLAlchemy metadata              │
│  Port: 5432                                      │
└─────────────────────────────────────────────────┘
         │
    ┌────┴─────┐
    │ Dhan API │  (Broker integration)
    └──────────┘
```

### Data Flow

```
User Input (Web Form) → FastAPI → PostgreSQL
User Input (Telegram) → Bot Parser → FastAPI → PostgreSQL
                       ↓
              Dhan API Sync ← ← Broker Webhook
                       ↓
              Analytics/Reports (pandas/numpy)
                       ↓
              AI Coach Review (Ollama Cloud)
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Backend** | FastAPI, SQLAlchemy 2.0 (sync), Pydantic v2 | Python 3.12 |
| **Frontend** | React 19, TypeScript 6, Vite 8, react-hook-form, Zod 4 | — |
| **UI** | Glass morphism design, Tailwind CSS 3 | — |
| **State** | Zustand 5 (client), TanStack React Query 5 (server) | — |
| **Charts** | Recharts 3, Framer Motion 12 | — |
| **Database** | PostgreSQL 16 Alpine | — |
| **HTTP** | Axios 1 (frontend), httpx 0.26 (backend), requests (Dhan) | — |
| **Bot** | python-telegram-bot v20.7 with job-queue | — |
| **Deployment** | Docker Compose (4 services) | — |
| **AI** | Ollama Cloud API (OpenAI-compatible) | — |

---

## File Structure

```
/root/projects/Trading Journal v3/
├── docker-compose.yml              # postgres, backend, frontend, bot
├── .env.example                     # Template environment variables
│
├── docs/
│   └── PROJECT_OVERVIEW.md          # This file
│
├── backend/                         # FastAPI backend
│   ├── Dockerfile                   # Single-stage Python 3.12
│   ├── requirements.txt             # 13 packages
│   └── app/
│       ├── main.py                  # FastAPI entry, auto-creates tables
│       ├── alembic.ini / alembic/   # Single-chain migrations, head at 5005c9868b86
│       ├── core/
│       │   ├── config.py            # Settings via python-decouple
│       │   └── logging.py           # Structlog config
│       ├── db/
│       │   └── database.py          # SQLAlchemy engine, SessionLocal, get_db
│       ├── models/  (12 files)
│       │   ├── base.py              # DeclarativeBase
│       │   ├── trade.py             # Trade (19 cols, auto PnL)
│       │   ├── user.py              # User (email auth)
│       │   ├── account.py           # Account (balance tracking)
│       │   ├── capital_event.py     # CapitalEvent (atomic balance updates)
│       │   ├── daily_journal.py     # DailyJournal (date-unique, mood 1-5)
│       │   ├── trade_idea.py        # TradeIdea (draft/active/traded/archived)
│       │   ├── setup_playbook.py    # SetupPlaybook (JSON tactics/risks/rules)
│       │   ├── tag.py / trade_tag.py# Tag + many-to-many
│       │   ├── stop_history.py      # StopHistory (SL tracking)
│       │   ├── milestone.py         # Milestone (goals)
│       │   └── coach_review.py      # CoachReview (AI insight storage)
│       ├── schemas/  (10 files)
│       │   ├── base.py              # BaseSchema with from_attributes
│       │   ├── trade.py             # TradeCreate/Update/Response
│       │   ├── user.py / account.py / capital_event.py
│       │   ├── daily_journal.py     # Create/Update/Response
│       │   ├── trade_idea.py        # + ConvertToTradeRequest/Response
│       │   ├── setup_playbook.py    # + Tactic/RiskProfile schemas
│       │   ├── analytics.py         # 8 response schemas (KPI, streaks, etc.)
│       │   ├── coach.py             # CoachReview/Pattern/Rule-reminder schemas
│       │   ├── webhook.py           # Dhan webhook event schemas
│       │   └── health.py            # HealthResponse
│       ├── routers/  (13 files)
│       │   ├── base.py              # Registers all routers under /api/v1
│       │   ├── health.py            # GET /api/v1/health
│       │   ├── trades.py            # CRUD + status machine
│       │   ├── dhan.py              # POST /api/v1/trades/dhan/sync
│       │   ├── dhan_webhook.py      # POST /webhooks/dhan (single + batch)
│       │   ├── csv_import.py        # POST csv-import, GET csv-template
│       │   ├── capital_events.py    # CRUD + summary aggregation
│       │   ├── accounts.py         # CRUD + rebalance + equity-curve
│       │   ├── daily_journal.py     # CRUD + weekly range
│       │   ├── trade_ideas.py       # CRUD + convert-to-trade
│       │   ├── setup_playbook.py    # CRUD + seed 7 defaults
│       │   ├── analytics.py         # 10 analytics endpoints
│       │   ├── coach.py             # 9 AI Coach endpoints + caching
│       │   └── export.py            # CSV download + Telegram backup
│       ├── services/  (8 files)
│       │   ├── trade_service.py     # Dedup + Dhan leg mapping
│       │   ├── trade_idea_service.py# CRUD + status validation + convert
│       │   ├── analytics_service.py # 10 analytics functions, pandas/numpy
│       │   ├── ai_coach.py          # OllamaClient + AICoachService + cache
│       │   ├── dhan_client.py       # Rate-limited Dhan API (60 req/min)
│       │   ├── dhan_webhook_service.py  # Match/update from webhook events
│       │   ├── export_service.py    # CSV generation + Telegram send
│       │   └── csv_import.py        # CSV parsing + validation
│       ├── prompts/  (5 files)
│       │   ├── daily_review.txt / weekly_review.txt
│       │   ├── trade_insight.txt / ask_coach.txt
│       │   └── rule_reminder.txt
│       └── utils/
│           ├── logging.py           # Structlog logger factory
│           └── decimal_utils.py     # Decimal coercion
│
├── frontend/                        # React 19 SPA
│   ├── Dockerfile                   # Build + serve static
│   ├── package.json                 # 24 deps (React 19, Vite 8, TS 6, etc.)
│   ├── vite.config.ts / tsconfig.json / tailwind.config.js
│   └── src/  (46 files)
│       ├── main.tsx                 # Entry point with PWA service worker
│       ├── App.tsx                  # Zustand view switching, lazy-loaded views, ErrorBoundary per page
│       ├── index.css                # Tailwind + glass utilities
│       ├── lib/
│       │   ├── api.ts               # Axios client + interceptors
│       │   ├── queryInvalidation.ts # Trade/capital domain refresh helpers
│       │   └── utils.ts             # cn() helper
│       ├── types/
│       │   ├── index.ts             # 291 lines — all API response types
│       │   ├── setupPlaybook.ts     # Setup-specific types
│       │   └── tradeIdea.ts         # Idea-specific types
│       ├── schemas/
│       │   └── tradeForm.ts         # Zod validation for trade form
│       ├── store/
│       │   ├── appStore.ts          # UI state: activeView, tradeFormMode
│       │   └── toastStore.tsx       # Toast notifications
│       ├── hooks/  (7 files) — all call lib/endpoints.ts
│       │   ├── useTradesQuery.ts / useTradeMutation.ts / useReviewTradeMutation.ts
│       │   ├── useJournalMutation.ts
│       │   ├── useDashboardQuery.ts
│       │   ├── useSetupPlaybookQuery.ts
│       │   └── useTradeIdeasQuery.ts
│       ├── lib/
│       │   ├── api.ts               # Axios client + interceptors
│       │   ├── endpoints.ts         # All 21 API endpoint definitions
│       │   └── utils.ts             # cn() helper
│       ├── pages/
│       │   ├── TradesPage.tsx       # Trade list table
│       │   ├── CreateTradePage.tsx  # Wraps TradeEntryForm in create mode
│       │   ├── EditTradePage.tsx    # Wraps TradeEntryForm in edit mode
│       │   ├── JournalPage.tsx      # 3-tab (Journal/Compare/Weekly)
│       │   └── AnalyticsDashboardPage.tsx  # 8 chart widgets, 747 lines
│       ├── components/
│       │   ├── ui/                  # Glass design system (7 files + ErrorBoundary.tsx)
│       │   ├── forms/TradeEntryForm.tsx  # react-hook-form + Zod (401 lines)
│       │   ├── journal/DailyJournalForm.tsx  # 3-step wizard (538 lines)
│       │   ├── review/              # TradeReviewCard, TradeReviewStream, TagSelector, ChartGallery
│       │   ├── playbook/            # SetupPlaybookPage, SetupCard, SetupFormModal, ConfirmModal
│       │   ├── ideas/               # TradeIdeasPage, IdeaCard, IdeaFormModal, ConvertToTradeModal
│       │   └── layout/Sidebar.tsx   # 7-view nav + TopBar
│       └── utils/format.ts          # Currency, percent, R-multiple, date
│
├── bot/                             # Telegram bot
│   ├── Dockerfile                   # Python 3.12-slim
│   ├── requirements.txt             # 5 packages (+ structlog)
│   ├── .env.example
│   ├── bot.py                       # Application builder, 3 scheduled jobs
│   ├── handlers.py                  # 5 commands + free-form message handler
│   ├── parser.py                    # NLP parser for 50+ NSE symbols
│   ├── client.py                    # Full BackendClient (trades, analytics, journal, setups)
│   ├── utils.py                     # Formatters + daily PnL / stop-reminder jobs
│   ├── middleware.py                # Auth guard (chat ID whitelist)
│   └── config.py                    # Env vars with defaults
│
├── scripts/
│   ├── kanban_batch.py              # Batch task creator from YAML
│   ├── kanban_preflight.py          # Pre-flight checker for kanban
│   ├── kanban_recover.py            # Auto-recovery for crashed tasks
│   ├── kanban_watch.py              # Clarify watcher with auto-answer
│   ├── kanban_dispatch.py           # Model-aware task dispatcher
│   ├── kanban_review.py             # Formal reviewer task creator
│   ├── kanban_remediate.py          # Fix-task creator from reviewer findings
│   ├── daily_backup.py              # Cron-based Telegram backup
│   ├── setup_cron.sh                # Cron job installer
│   ├── test_export.py               # Export service test
│   ├── inspect_setup.py             # DB inspection
│   └── migrate_v2_to_v3.py          # SQLite → PostgreSQL migration
│
├── plans/
│   ├── phase3.yaml                  # 14 tasks in 4 waves
│   └── templates/                   # react-form.md, crud-endpoint.md
│
└── init.sql/                        # Empty — schema managed by SQLAlchemy
```

---

## Implementation Status

### Backend — ✅ 100% Complete

| Component | Files | Status |
|-----------|-------|--------|
| Models (12) | 12 `.py` files | All complete with full field definitions |
| Routers (13) | 13 `.py` files | All registered in `base.py`, 50+ endpoints |
| Services (8) | 8 `.py` files | All full implementations (not stubs) |
| Schemas (10) | 10 `.py` files | All Pydantic v2 with validators |
| AI Coach | 410 lines | OllamaClient + AICoachService + TTL cache + 5 prompt templates |
| Analytics | 552 lines + 10 endpoints | pandas/numpy, handles empty data, NaN → None |
| Export | CSV generation + Telegram backup | T10 round-trip format, date/status filters |
| Dhan Sync | Client + webhook service | Rate-limited 60 req/min, auto match/update |

### Frontend — ✅ 95% Complete (compiles cleanly)

| Component | Status |
|-----------|--------|
| All pages (5) | Real implementations, not stubs |
| All hooks (7) | Wired to 21 backend API endpoints |
| UI kit (7) | GlassButton, GlassCard, GlassInput, GlassSelect, GlassTextarea, GlassTagInput, GlassBadge |
| Playbook | Full CRUD with seed defaults, modal forms |
| Ideas | Full CRUD + convert-to-trade, status kanban |
| Journal | 3-step wizard (pre-market, post-market, summary) |
| Review stream | Instagram-story style with progress dots |
| Analytics dashboard | 8 chart widgets, loading skeleton, error state |
| Error boundaries | Every page wrapped in ErrorBoundary with retry |

### Design Mockups — ✅ Complete (14 files + 1 system CSS)

**Location**: `design-prototypes/` — served via HTTP at `http://187.127.139.97:8765/`

| Page | Light (Warm Paper) | Dark (Dark Discipline) |
|------|------|------|
| Dashboard | `dashboard-v2.html` | `dashboard-dark.html` |
| Trades | `trades-light.html` | `trades-dark.html` |
| Journal | `journal-light.html` | `journal-dark.html` |
| Playbook | `playbook-light.html` | `playbook-dark.html` |
| Review | `review-light.html` | `review-dark.html` |
| Ideas | `ideas-light.html` | `ideas-dark.html` |
| Settings | `settings-light.html` | `settings-dark.html` |

**Design system** (`design-system.css` tokens):
- **Light ("Disciplined Warmth")**: `#f2ece4` paper bg, `#b85c38` rust accent, `#3d8b5c` forest green profit, `#b84038` terracotta loss, Newsreader serif display + Inter body + JetBrains Mono data, paper noise SVG texture
- **Dark ("Dark Discipline")**: `#0e1016` navy bg, `#c97a3f` amber accent, `#4ade80` neon green profit, `#f87171` soft red loss, same fonts
- All pages: same layout, identical sidebar, generous spacing, mobile-responsive `@media(max-width:900px)`
- Tables: horizontally scrollable with `min-width:1020px+`, custom scrollbars
- Interactive elements: mood pickers, tag toggle, filter chips, progress bars, entry panels

### Telegram Bot — ✅ 100% Complete

| Component | Status |
|-----------|--------|
| 5 command handlers | `/start`, `/help`, `/pnl`, `/journal`, `/setup` |
| Free-form parser | 50+ NSE symbols, entry/exit detection, R:R computation |
| Backend client | Full coverage of trades, analytics, journal, setups, coach |
| Scheduled jobs | Daily PnL summary + stop reminders every 2h |
| Auth middleware | Chat ID whitelist |

### Docker — ✅ Running

| Container | Status | Port |
|-----------|--------|------|
| `tjv3_postgres` | Healthy | 5432 |
| `tjv3_backend` | Healthy | 8000 |
| `tjv3_frontend` | Running | 3000 |
| `tjv3_bot` | Ready (needs TELEGRAM_BOT_TOKEN) | — |

---

## What's Working

### Backend
- All CRUD endpoints for trades, journal, setups, ideas, accounts, capital events
- Trade state derived from `exit_price`: no exit = open, has exit = closed; soft delete uses `deleted`
- PnL auto-computation on trade create/update
- 10 analytics endpoints with pandas/numpy
- 9 AI Coach endpoints (returns cached/empty when Ollama unavailable)
- CSV import/export with validation
- Dhan webhook processing (single + batch)
- Account balance tracking (atomic updates via CapitalEvents)
- Equity curve computation

### Frontend
- Glass morphism design system (dark-only)
- Zustand-driven SPA navigation with lazy-loaded views
- React Query domain invalidation for trade/capital mutations; views refetch on mount/focus/reconnect
- Trade entry form (react-hook-form + Zod)
- Daily journal 3-step wizard
- Analytics dashboard (8 charts via Recharts)
- Setup playbook CRUD with seed defaults
- Trade ideas with convert-to-trade flow
- Review stream (story-style)

### Infrastructure
- Docker Compose with all 4 services
- Auto table creation on backend startup
- Frontend builds and serves via `serve`
- Health checks on postgres + backend

---

## Known Gaps & Next Steps

### Critical
(None — all critical gaps resolved, May 2026)

### High Priority
2. **No authentication** — anyone with URL can access the journal. Frontend has dead auth interceptor (reads `auth_token` from localStorage, redirects on 401), but backend has zero auth.
3. **No HTTPS** — running on HTTP
4. **Dhan sync router** — creates its own DB session in `dhan_client.py` instead of using injected one (partially fixed: dead session code removed, but method still no-args)

### Medium Priority
5. **No tests** — no pytest, no React Testing Library
6. **No CI/CD** — no GitHub Actions
7. **No pagination** — `GET /trades` returns all records
8. **No error boundaries** in React — FIXED: all pages wrapped
9. **No responsive design** — desktop-only
10. **No rate limiting** on API
11. **Bot** needs `TELEGRAM_BOT_TOKEN` and `CHAT_ID` to function

---

## Kanban Workflow & AI Profiles

### Profile Configuration

| Profile | Model | Provider | Effort | max_turns | Toolsets |
|---------|-------|----------|--------|-----------|----------|
| backend | qwen/qwen3.6-plus | nous | high | 120 | files, terminal, code, kanban |
| frontend | kimi-k2.6 | ollama-cloud | high | 120 | files, terminal, code, kanban |
| data | deepseek-v4-pro | ollama-cloud | high | 120 | files, terminal, code, kanban |
| reviewer | deepseek-v4-pro | ollama-cloud | maximal | 120 | files, terminal, code, kanban |
| devops | devstral-small-2:24b | ollama-cloud | medium | 120 | files, terminal, code, kanban |

### Workflow Rules
1. Every backend task gets a reviewer card (auto-generated)
2. Max 2 concurrent Ollama tasks across all profiles
3. Backend runs unlimited (nous provider)
4. Poll for clarifies every 10s via `kanban_watch.py`
5. Task size: 40-50 turns max

### Scripts

| Script | Purpose |
|--------|---------|
| `kanban_batch.py` | Create phase from YAML plan |
| `kanban_preflight.py` | Check profiles before dispatch |
| `kanban_dispatch.py` | Smart unblock by provider |
| `kanban_watch.py` | Clarify watcher + auto-answer |
| `kanban_recover.py` | Diagnose crashed tasks |
| `kanban_review.py` | Create reviewer tasks |
| `kanban_remediate.py` | Create fix tasks from reviewer findings |

---

## Deployment

### Quick Start

```bash
cd "/root/projects/Trading Journal v3"
docker compose up -d --build

# Verify
curl http://localhost:8000/health
# → {"status":"healthy","message":"Trading Journal v3 is running"}

# Open browser → http://localhost:3000
```

### Environment

See `.env.example` for all configurable variables. Key ones:
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` — database credentials
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — required for bot + backup
- `OLLAMA_BASE_URL` / `OLLAMA_API_KEY` — required for AI Coach
- `DHAN_CLIENT_ID` / `DHAN_ACCESS_TOKEN` — required for broker sync

---

## API Documentation

**Base URL:** `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Health** |
| GET | `/health` | Root health check |
| GET | `/api/v1/health` | API health check |
| **Trades** |
| POST | `/api/v1/trades/` | Create trade (auto PnL) |
| GET | `/api/v1/trades/` | List trades (filter by status, symbol) |
| GET | `/api/v1/trades/{id}` | Get single trade |
| PUT | `/api/v1/trades/{id}` | Update trade (validates status transitions) |
| DELETE | `/api/v1/trades/{id}` | Soft-delete (status → deleted) |
| **Accounts** |
| POST | `/api/v1/accounts/` | Create account |
| GET | `/api/v1/accounts/` | List accounts |
| GET | `/api/v1/accounts/{id}` | Get account |
| PUT | `/api/v1/accounts/{id}` | Update account |
| DELETE | `/api/v1/accounts/{id}` | Delete (blocks if capital events exist) |
| PATCH | `/api/v1/accounts/{id}/rebalance` | Set balance manually |
| GET | `/api/v1/accounts/{id}/equity-curve` | Build equity curve |
| **Capital Events** |
| POST | `/api/v1/capital-events/` | Create event (atomic balance update) |
| GET | `/api/v1/capital-events/` | List events (filter by account, type, date) |
| GET | `/api/v1/capital-events/summary` | Aggregate by type |
| GET/PUT/DELETE | `/api/v1/capital-events/{id}` | Single event CRUD |
| **Daily Journal** |
| POST | `/api/v1/journal/` | Create entry (unique per date) |
| GET | `/api/v1/journal/` | List entries (date range) |
| GET | `/api/v1/journal/weekly` | List for a week (week_start param) |
| GET/PUT | `/api/v1/journal/{date}` | Get/update by ISO date |
| **Setup Playbook** |
| POST | `/api/v1/setups/` | Create setup |
| GET | `/api/v1/setups/` | List setups (filter is_active) |
| GET/PUT/DELETE | `/api/v1/setups/{id}` | Single setup CRUD |
| POST | `/api/v1/setups/seed` | Seed 7 canonical defaults |
| **Trade Ideas** |
| POST | `/api/v1/ideas/` | Create idea |
| GET | `/api/v1/ideas/` | List (filter by status, symbol, direction) |
| GET/PUT/DELETE | `/api/v1/ideas/{id}` | Single idea CRUD |
| POST | `/api/v1/ideas/{id}/trade` | Convert idea to trade |
| **Analytics** |
| GET | `/api/v1/analytics/kpi` | Win rate, profit factor, expectancy, etc. |
| GET | `/api/v1/analytics/setup-performance` | Per-setup breakdown |
| GET | `/api/v1/analytics/streaks` | Win/loss streaks |
| GET | `/api/v1/analytics/r-distribution` | R-multiple histogram |
| GET | `/api/v1/analytics/monthly-pnl` | Monthly P&L bars |
| GET | `/api/v1/analytics/daily-pnl` | Daily equity curve |
| GET | `/api/v1/analytics/day-of-week` | Weekday performance |
| GET | `/api/v1/analytics/time-of-day` | Hourly performance |
| GET | `/api/v1/analytics/holding-period` | Holding hours vs return |
| GET | `/api/v1/analytics/dashboard` | All of the above in one call |
| **AI Coach** |
| POST | `/api/v1/coach/review/daily` | Generate daily review |
| POST | `/api/v1/coach/review/weekly` | Generate weekly review |
| POST | `/api/v1/coach/insight` | Insight on specific trades |
| POST | `/api/v1/coach/ask` | Free-form Q&A |
| POST | `/api/v1/coach/patterns` | Detect behavioral patterns |
| POST | `/api/v1/coach/rule-reminders` | Check trades against rules |
| GET | `/api/v1/coach/reviews` | List past reviews |
| GET/DELETE | `/api/v1/coach/reviews/{id}` | Get/delete single review |
| **Integrations** |
| POST | `/api/v1/trades/dhan/sync` | Sync trades from Dhan |
| POST | `/api/v1/webhooks/dhan/` | Receive single webhook event |
| POST | `/api/v1/webhooks/dhan/batch` | Process batch webhook events |
| **Import/Export** |
| GET | `/api/v1/trades/csv-template` | Download CSV template |
| POST | `/api/v1/trades/csv-import` | Bulk import from CSV |
| GET | `/api/v1/export/csv` | Export trades as CSV |
| POST | `/api/v1/export/backup` | Trigger Telegram backup |
| GET | `/api/v1/export/health` | Export service health |

---

## Database Schema

### Models (12)

| Model | Table | Key Fields | Purpose |
|-------|-------|-----------|---------|
| **Trade** | `trades` | symbol, direction, entry/exit price, quantity, pnl, status (draft→reviewed→analytics→deleted) | Every trade |
| **User** | `users` | email (unique), full_name | Auth |
| **Account** | `accounts` | name, broker, initial_balance, current_balance | Capital tracking |
| **CapitalEvent** | `capital_events` | event_type, amount, timestamp, account_id (FK), trade_id (FK) | Deposit/withdrawal/profit tracking |
| **DailyJournal** | `daily_journals` | date (unique), pre/post notes, mood_rating (1-5), user_id (FK) | Daily reflection |
| **TradeIdea** | `trade_ideas` | symbol, direction, entry/stop/target prices, thesis, confidence, status (draft/active/traded/archived), traded_trade_id (FK) | Pre-trade tracking |
| **SetupPlaybook** | `setup_playbook` | name (unique), tactics (JSON), ideal_conditions (JSON), risk_profile (JSON), rules (JSON) | Trading strategies |
| **Tag** | `tags` | name (unique), description | Categorization |
| **TradeTag** | `trade_tags` | trade_id, tag_id | Many-to-many |
| **StopHistory** | `stop_history` | trade_id (FK), stop_type, price, timestamp | SL adjustment log |
| **Milestone** | `milestones` | name, target_amount, achieved | Trading goals |
| **CoachReview** | `coach_reviews` | review_type, content, period_start/end, trade_ids (JSON), detected_patterns (JSON), model_used | AI insight storage |

### Status Lifecycle
```
exit_price IS NULL → open
exit_price IS NOT NULL → closed
DELETE /trades/{id} → deleted
```

---

## Bugs Fixed (May 2026)

During the May 2026 audit, 14 bugs were found and fixed:

| # | Bug | Fix |
|---|-----|-----|
| 1 | `requests` missing from `backend/requirements.txt` (used by dhan_client.py) | Added to deps |
| 2 | `python-multipart` missing (needed by csv_import.py) | Added to deps |
| 3 | `User` model not imported in `models/__init__.py` → FK to `users` table failed | Added import + `__all__` entry |
| 4 | `User` not imported in `alembic/env.py` → Alembic couldn't see it | Added import |
| 5 | Duplicate `Index('ix_setup_playbook_name')` clashed with `unique=True` on column | Removed redundant explicit Index |
| 6 | `logger.info("account_created", name=...)` — structlog keyword `name` is reserved → KeyError | Renamed to `account_name` |
| 7 | `/journal/weekly` route below `/{date_str}` → "weekly" parsed as date → 422 | Moved `/weekly` above `/{date_str}` |
| 8 | `/capital-events/summary` route below `/{event_id}` → "summary" parsed as int → 422 | Moved `/summary` above `/{event_id}` |
| 9 | `round(_safe_mean(…), 4)` crashes when `_safe_mean` returns `None` (2 locations) | Added `_safe_round` helper |
| 10 | Holding period: NaN from `holding_hours` when `exit_time` is NULL | Guarded with `pd.notna` check |
| 11 | Convert idea-to-trade missing `entry_time` (NOT NULL field) | Added `entry_time` with default `now()` |
| 12 | Holding period: `setup` column is NaN for NULL → schema rejects `nan` as string | Added `pd.notna` guard |
| 13 | Pydantic `model_` namespace warning on `PatternDetectionResponse`, `RuleReminderResponse` | Added `protected_namespaces=()` |
| 14 | `structlog` missing from `bot/requirements.txt` → bot would crash on startup | Added to deps |

### Frontend Build Fixes
| # | Bug | Fix |
|---|-----|-----|
| 15 | Unused `ArrowUpRight` import — TS6133 build error | Removed import |
| 16 | Unused `TooltipProps` import | Removed import |
| 17 | `TooltipProps<number, string>` type mismatch with Recharts v3 | Changed to `any` |
| 18 | `GlassCard` requires `children` — skeleton loading had no children | Made `children` optional |
| 19 | Implicit `any` types for `entry` and `i` in tooltip map | Added explicit types |

### Architecture Improvements (May 2026)

| # | Change | Files |
|---|--------|-------|
| 20 | **Dhan dead code removed** — `get_range_trades()` created `SessionLocal()` and `TradeService` but never used either | `backend/app/services/dhan_client.py` |
| 21 | **Frontend API consolidated** — all 21 endpoint functions moved from 7 hook files into single `lib/endpoints.ts` | `frontend/src/lib/endpoints.ts` + 7 hook files |
| 22 | **Coach router thinned** — `_trade_to_dict`, `_compute_summary_stats`, `_compute_setup_performance` moved from router to `ai_coach.py` service | `backend/app/routers/coach.py`, `backend/app/services/ai_coach.py` |
| 23 | **Error boundaries** — every page view wrapped in `<ErrorBoundary>` with retry button | `frontend/src/components/ui/ErrorBoundary.tsx`, `frontend/src/App.tsx` |
| 24 | **Dead code cleanup** — 2 commented-out files removed | `frontend/src/components/trade/TradeEntryForm.tsx`, `TradeFormStepper.tsx` |
| 25 | **Nginx proxy** — replaced `serve` with nginx that serves static files + proxies `/api/v1/*` to backend | `frontend/Dockerfile`, `frontend/nginx.conf` |
| 26 | **Health route fix** — `@router.get("/health")` had double prefix (`/api/v1/health/health`) | `backend/app/routers/health.py` |
| 27 | **Alembic consolidation** — two split chains (ROOT + APP) merged into single chain. `env.py` now reads `DATABASE_URL` from env. Head: `5005c9868b86` (001_base_schema) | `backend/alembic/env.py`, `backend/alembic.ini`, all migration files |

---

## Future Roadmap

### Post-Phase 3
- [ ~~Alembic migration consolidation~~ (completed May 2026: single chain, head 5005c9868b86)
- [ ] Authentication (JWT, login flow)
- [ ] Mobile responsive design
- [ ] Tests (pytest for backend, React Testing Library for frontend)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] HTTPS/TLS configuration
- [ ] Remove dead code (commented-out stepper form files)
- [ ] Error monitoring (Sentry)
- [ ] Performance optimizations (pagination, search/filter)
- [ ] Multi-currency support
- [ ] Mentor portal (read-only access)

---

## Quick Commands

```bash
# Docker
docker compose up -d --build    # Start full stack
docker compose down -v          # Stop and wipe volumes
docker compose logs -f backend  # Follow backend logs

# Database
docker exec -it tjv3_postgres psql -U trading_journal -d trading_journal

# Backend test
curl http://localhost:8000/health

# Scripts
python3 scripts/kanban_preflight.py
python3 scripts/migrate_v2_to_v3.py
```

---

## Environment Variables

```env
# PostgreSQL
POSTGRES_USER=trading_journal
POSTGRES_PASSWORD=securepassword
POSTGRES_DB=trading_journal

# Backend
DATABASE_URL=postgresql+psycopg2://trading_journal:securepassword@postgres:5432/trading_journal
OLLAMA_BASE_URL=https://your-project.ollama.com
OLLAMA_API_KEY=your-api-key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id

# Dhan API
DHAN_CLIENT_ID=your-client-id
DHAN_ACCESS_TOKEN=your-access-token
```

---

## Contact / Ownership

- **Owner**: Ryu Chan <ryu192.r@gmail.com>
- **GitHub**: ryu192-r
- **Repo**: ryu192-r/TradeJournal
- **Obsidian Vault**: /Documents/Obsidian/Brain/ (synced via Syncthing)
- **VPS**: Linux, Docker Compose
- **AI Provider**: Ollama Cloud (subscription), nous (qwen3.6-plus)

---

*This document is the single source of truth for the Trading Journal v3 project. Update it whenever significant changes are made.*
