# Trading Journal v3 — Project Documentation

> **Personal trading journal with AI coaching, capital management, and live market data.**
> Last updated: May 2026

---

## Current Status — Production Live

The app is deployed at `https://tjv3.duckdns.org` with full functionality. All core features are complete and working.

### Production Health
| Check | Result |
|-------|--------|
| Backend | Healthy, pytest regression suite |
| Frontend | Production build + typecheck |
| PostgreSQL | Healthy |
| Core API endpoints | Authenticated routes covered by smoke/regression tests |
| Service Worker | v4 (auto-updates) |
| Test account | `test@test.com` / `test123456` (initial balance ₹285,052) |

---

## Architecture

```
Browser → Traefik (HTTPS/DuckDNS, priority=100 for /api/v1)
        → Backend:8000 (FastAPI)
        → Frontend:3000 (nginx) → Backend:8000 (for non-coach API)
        → PostgreSQL:5432
        → Bot (Telegram, optional)
```

- **Frontend**: React 19 SPA with lazy-loaded views
- **Backend**: FastAPI with sync SQLAlchemy
- **DB**: PostgreSQL with Alembic migrations
- **Auth**: JWT (access + refresh tokens)
- **AI**: Multi-provider (Ollama, OpenAI, DeepSeek, Anthropic, Google, Custom)

---

## Key Components

### Dashboard (`GET /dashboard/operational`)
Single-call payload returning:
- **KPI cards**: Net P&L, Win Rate, Profit Factor, Avg R, Expectancy, Max DD
- **Equity section**: Realized Equity card + Total Equity (with unrealized) card + equity curve chart
- **Open trades** with live NSE quotes
- **Risk Command Center**: portfolio heat, deployed capital, available capital, warnings
- **Capital summary**: net_equity, unrealized_pnl, total_equity_unrealized, deposits, withdrawals
- **Streaks**: current win/loss streak, longest win, longest loss
- **Equity curve**: daily running total (initial + capital events + closed PnL + partial exits)

### Intelligence Dashboard (`GET /dashboard/intelligence`)
Single-call payload returning lifecycle, behavioral, playbook, and market highlights.

### AI Coach (8 providers, 11+ endpoints)
- Daily/weekly reviews, trade insight, free-form Q&A, pattern detection, rule reminders
- Trade Review engine with A–F scoring across 6 dimensions
- Behavioral Score (programmatic + AI composite)
- Coach personality blending (5 mentors, 0-100% weights)
- Timeout chain: Frontend 120s → nginx 180s → backend 60-300s

### Capital System
- Net equity = initial + capital events + realized PnL + partial exit PnL
- Total equity = net equity + unrealized P&L (live quotes × open positions)
- Auto-reconciliation on all trade mutations
- Dynamic tier system with editable thresholds
- Equity curve in both Dashboard and Capital pages

### Performance OS / Daily SA Notes
- Weekly and monthly review workflows in `PerformanceOSPage`
- Dedicated Daily SA Notes page for pre-market and post-market journaling
- Post-market flow captures discipline rating separately from mood
- Daily workflow shell keeps current trading-day notes separate from longer reviews

### Lifecycle Analytics
- Emotion logs, execution grades, stop history, partial exits, and timeline events are attached to trade detail
- Discipline score combines journal discipline, execution grades, emotion logs, and rule adherence signals
- Trade review engine loads lifecycle context before producing structured AI feedback

### Market Context / Live Quotes
- `LiveQuote` caches NSE stock quotes used by live dashboard cards and unrealized P&L
- `POST /market/sync-quotes` syncs currently open trade symbols
- Quote status is exposed as `fresh`, `stale`, `failed`, or `not_synced` so the frontend can avoid silent stale-price displays

---

## API Endpoints (47+)

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

### Broker Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/trades/brokers` | List supported brokers |
| GET | `/trades/import/template/{broker}` | Download CSV template |
| POST | `/trades/import?broker={broker}` | Upload CSV (dry_run optional) |

### TradingOS Foundation
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/operational` | Realized KPIs, open positions, live quotes, risk, capital, equity curve |
| GET | `/dashboard/intelligence` | Lifecycle, behavioral, playbook, and market highlights |
| GET/POST/DELETE | `/trades/{id}/partial-exits` | Scale-out records and remaining quantity |
| GET/POST | `/trades/{id}/timeline` | Trade lifecycle events |
| GET/POST | `/trades/{id}/stop-history` | Stop adjustment history and current SL sync |
| POST | `/market/sync-quotes` | Sync live quotes for open symbols |

---

## Database Models (17+)

| Model | Table | Key Fields |
|-------|-------|-----------|
| Trade | `trades` | symbol, entry/exit price, qty, pnl, fees, setup, exit_reason, r_multiple |
| Account | `accounts` | name, initial_balance, current_balance, breakeven_threshold |
| CapitalEvent | `capital_events` | type (deposit/withdrawal/adjustment/etc), amount, timestamp |
| PartialExit | `partial_exits` | trade_id, qty, exit_price, realized_pnl, exit_time, exit_reason |
| ExecutionGrade | `execution_grades` | trade_id, 6 dimension grades (A–F), overall_grade |
| EmotionLog | `emotion_logs` | trade_id, emotion, confidence, stress, conviction, focus |
| TradeTimeline | `trade_timelines` | trade_id, event_type, timestamp, old/new values |
| StopHistory | `stop_history` | trade_id, stop_type, price, timestamp |
| SetupPlaybook | `setup_playbook` | name, tactics, ideal_conditions, risk_profile, rules, is_active |
| DailyJournal | `daily_journals` | date (unique), pre/post notes, mood, discipline_rating |
| TradeIdea | `trade_ideas` | symbol, thesis, confidence, status, traded_trade_id |
| CoachReview | `coach_reviews` | review_type, content, period, trade_ids, summary_stats |
| LiveQuote | `live_quotes` | symbol, ltp, change, change_pct, volume, market_cap |
| MarketSnapshot | `market_snapshots` | nifty_close, india_vix, breadth, regime |
| Milestone | `milestones` | name, target_amount, achieved |

---

## Deployment

```bash
docker compose up -d --build          # full stack
docker compose logs -f backend        # backend logs
cd backend && python3 -m pytest tests/ -v   # tests (SQLite, no Docker needed)
cd frontend && npm run dev             # dev server
cd frontend && npx tsc --noEmit       # typecheck
cd frontend && npm run build           # production build
```

## Architecture Decisions

- ADR-016: Performance OS domain model
- ADR-017: Operational dashboard aggregate endpoint
- ADR-018: Lifecycle analytics model
- ADR-019: Partial exits and remaining quantity
- ADR-020: Live quote cache and market data provider

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | SQLite | PostgreSQL connection string |
| `SECRET_KEY` | — | Auth secret |
| `JWT_SECRET_KEY` | — | JWT signing key |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | Token expiry |
| `RATE_LIMIT_OFF` | false | Disable rate limiting (Docker/tests: true) |
| `VITE_API_URL` | `/api/v1` | API base URL (build-time) |
| `SENTRY_DSN` | — | Optional, enables Sentry |
| `DUCK_DOMAIN` | — | DuckDNS domain for Traefik HTTPS |
| `UPLOAD_DIR` | `uploads/charts` | Chart image directory |
| `MAX_UPLOAD_SIZE_MB` | 10 | Max upload size |

### Service Ports
| Service | Port | Notes |
|---------|------|-------|
| Postgres | 5432 | user: `trading_journal` |
| Backend | 8000 | uvicorn, health at `/health` |
| Frontend | 3000 | nginx, proxies `/api/v1` to backend |
| Bot | — | Telegram bot, depends on postgres |

---

## Test User & Sample Data

- Email: `test@test.com`, Password: `test123456`
- Account initial_balance: ~₹285,000
- 21 trades (17 closed, 4 open), 26 capital events, 1 partial exit
- 5 active playbook setups, 3 overtrading days, 13 revenge trades flagged
