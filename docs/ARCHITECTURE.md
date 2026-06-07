# Trading Journal v3 — Architecture & File Map

> Central reference — every file, every endpoint, every component mapped.
> Last updated: May 2026. After v2 Phase-1 polish: calculation centralization, design system, mobile nav, trade detail polish.

---

## 1. Repository Layout

```
TradeJournal-v3/
├── AGENTS.md                    # Agent guide — stack, commands, architecture
├── CONTEXT.md                   # Domain glossary, trade lifecycle, formulas
├── docker-compose.yml           # 4 services: postgres, backend, frontend, bot
├── opencode.json                # OpenCode MCP config (Tapetide stock data)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/            # 002, 003 migration scripts
│   ├── app/
│   │   ├── main.py              # FastAPI app, middleware, migrations, scheduler
│   │   ├── models/              # 19 SQLAlchemy models (see §2)
│   │   ├── schemas/             # Pydantic v2 request/response schemas
│   │   ├── routers/             # 28 route modules (see §3)
│   │   ├── services/            # Business logic (see §4)
│   │   ├── core/                # Config, AI config, rate limiter, auth
│   │   ├── db/                  # Database engine + session
│   │   ├── api/                 # Pydantic endpoints (legacy)
│   │   ├── utils/               # Decimal utils, logging, **calculations**
│   │   └── prompts/             # AI prompt templates
│   ├── tests/                   # pytest suite (20 test files, 200 tests)
│   │   ├── conftest.py          # SQLite override, auth fixture
│   │   └── fixtures/
│   └── uploads/charts/          # Chart image storage (UPLOAD_DIR)
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf               # Proxies /api/v1/coach (180s), /api/v1 (60s)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   └── sw.js                # Service worker (tj-v3-v4)
│   └── src/
│       ├── main.tsx             # Entry point, Sentry, PWA registration
│       ├── App.tsx              # Auth gate, mounts features-v3/shell/V3LiveApp
│       ├── index.css            # CSS vars, Tailwind, fluid layout
│       ├── app/
│       │   └── navigation.ts    # ActiveView types, 5-group nav sections
│       ├── new-ui/              # Canonical design system (primitives, layout, tokens — ADR-023)
│       ├── features-v3/         # Feature-sliced V3 UI (the live app)
│       │   ├── shell/           # V3LiveApp, V3Shell, V3Sidebar, V3TopBar, v3Navigation, v3ViewMapping
│       │   ├── cockpit/         # Command center (dashboard) + Edge feed (ADR-024)
│       │   ├── trades/          # Trade list slice
│       │   ├── trade-detail/    # Trade detail slice
│       │   ├── trade-form/      # Create/edit trade form
│       │   ├── review/          # Per-trade review queue
│       │   ├── analytics/       # Performance analytics (incl. regime tab)
│       │   ├── playbook/        # Setup library + Intelligence/Edge tab
│       │   ├── journal/         # Daily journal + weekly rollups
│       │   ├── calendar/        # Monthly calendar
│       │   ├── capital/         # Account, capital events, tiers
│       │   ├── charges/         # Contract-note charges ledger
│       │   ├── reports/         # Weekly/monthly reports
│       │   ├── lifecycle/       # Emotions, grades, behavioral analytics
│       │   ├── coach/           # AI Coach (5 tabs)
│       │   ├── settings/        # Theme, AI providers, preferences
│       │   ├── import/          # Broker CSV import
│       │   └── position-actions/# Pyramid / partial-exit drawer
│       ├── components/          # Residual shared bits: ui/ carve-outs, charts, actions, lifecycle/trade widgets
│       ├── hooks/               # React Query hooks per domain
│       ├── lib/                 # api.ts, endpoints.ts, queryInvalidation.ts, utils.ts
│       ├── store/               # Zustand: appStore, authStore, toastStore
│       ├── types/               # TypeScript types
│       ├── utils/               # format.ts, **calculations.ts**, liveQuotes.ts, performance.ts
│       ├── schemas/             # Zod: tradeForm.ts
│       └── test/                # Vitest unit tests + setup
├── bot/
│   ├── bot.py                   # Telegram bot (requires TELEGRAM_BOT_TOKEN)
│   ├── Dockerfile
│   └── requirements.txt
├── scripts/                     # Backup, test scripts
├── docs/
│   ├── ARCHITECTURE.md          # ← THIS FILE
│   ├── PROJECT_OVERVIEW.md      # User-facing project overview
│   ├── FEATURE_ROADMAP.md       # Completed + planned features
│   ├── TDD.md                   # Test-driven development guide
│   ├── adr/                     # 24 Architecture Decision Records (see README.md index)
│   └── agents/                  # Issue tracker, triage labels, domain docs
├── design-prototypes/           # Figma/HTML prototypes
├── plans/                       # Planning docs
└── Broker Templates/            # CSV templates for import
```

---

## 2. Backend Models (19)

| Model | Table | Key Fields |
|-------|-------|-----------|
| `Trade` | `trades` | symbol, entry_price, exit_price, quantity, pnl, r_multiple, stop_price, target_price, fees, setup, tactic, exit_reason, chart_images(JSON), status(open/closed/deleted) |
| `PartialExit` | `partial_exits` | trade_id, qty, exit_price, realized_pnl, r_captured, exit_time, exit_reason |
| `StopHistory` | `stop_history` | trade_id, stop_type, price, timestamp |
| `TradeTimeline` | `trade_timelines` | trade_id, event_type, old_value, new_value, note |
| `EmotionLog` | `emotion_logs` | trade_id, emotion, confidence, stress, conviction, patience, focus |
| `ExecutionGrade` | `execution_grades` | trade_id, 6 dimension grades (A–F), overall_grade |
| `Account` | `accounts` | name, initial_balance, current_balance, breakeven_threshold |
| `CapitalEvent` | `capital_events` | type(deposit/withdrawal/adjustment/etc), amount, trade_id |
| `SetupPlaybook` | `setup_playbook` | name, is_active(VARCHAR), trade_count, win_rate, avg_r |
| `DailyJournal` | `daily_journals` | date(unique), pre/post notes, mood_rating, discipline_rating |
| `DailyWorkflow` | `daily_workflows` | date, phase, checklist_items, watchlist_symbols |
| `WeeklyReview` | `weekly_reviews` | week_start, trade_count, pnl_summary, notes |
| `MonthlyReview` | `monthly_reviews` | month, trade_count, pnl_summary, notes |
| `CoachReview` | `coach_reviews` | review_type, content, period, summary_stats |
| `LiveQuote` | `live_quotes` | symbol, ltp, change_pct, volume, updated_at |
| `MarketSnapshot` | `market_snapshots` | date, nifty_close, india_vix, breadth, regime |
| `Milestone` | `milestones` | name, target_amount, achieved |
| `TierConfig` | `tier_configs` | name, min_amount, max_amount, sort_order |
| `User` | `users` | email, full_name, hashed_password |

---

## 3. Backend Routers

> **V3 deprecations**: `performance_os`, `coaching_intelligence`, and `recommendations` routers are marked `# DEPRECATED` — their V3 frontend surfaces were removed (Phases 1–4). They are no longer read/written by the live app. The backing tables (`daily_workflows`, `weekly_reviews`, `monthly_reviews`, `trade_ideas`) and the `daily_journal.discipline_rating` column remain pending a deferred destructive migration.

| Router File | Prefix | Key Endpoints |
|-------------|--------|-------------|
| `auth.py` | `/auth` | login, register, refresh, me |
| `health.py` | `/health` | health check |
| `trades.py` | `/trades` | CRUD, pyramid, stop-history, chart images, merge-duplicates |
| `trade_timeline.py` | `/trades/{id}/timeline` | GET list, POST create, DELETE |
| `partial_exit.py` | `/trades/{id}/partial-exits` | GET list, POST create, DELETE |
| `emotion_log.py` | `/trades/{id}/emotions` | GET list, POST create, DELETE |
| `execution_grade.py` | `/trades/{id}/execution-grade` | GET, POST create, PUT update, DELETE |
| `broker_import.py` | `/trades` | GET brokers, GET template, POST import |
| `dhan.py` | `/dhan` | Dhan API sync |
| `dhan_webhook.py` | `/dhan-webhook` | Real-time trade close |
| `operational_dashboard.py` | `/dashboard/operational` | KPI + open trades + risk + capital + equity curve |
| `capital_dashboard.py` | `/accounts/capital-dashboard` | Net equity, deployed capital, equity curve |
| `capital_events.py` | `/capital-events` | List, create, update, delete, reconcile |
| `accounts.py` | `/accounts` | Get, update account |
| `risk_dashboard.py` | `/risk-dashboard` | Risk metrics, warnings |
| `coach.py` | `/coach` | 12 AI endpoints (reviews, insights, patterns, rules, trade review) |
| `setup_playbook.py` | `/setups` | CRUD, seed, list active |
| `export.py` | `/export` | CSV export, backup |
| `analytics.py` | `/analytics` | Full dashboard payload, setup performance, streaks |
| `trade_ideas.py` | `/ideas` | unregistered — CRUD, convert to trade (deferred deletion) |
| `daily_journal.py` | `/journal` | GET/PUT by date, weekly stats |
| `ai_settings.py` | `/ai` | Config, providers, test |
| `tier_config.py` | `/tier-config` | GET list, PUT save |
| `market_context.py` | `/market` | Snapshots, sync quotes, live quotes, regime |
| `lifecycle_analytics.py` | `/lifecycle` | Emotion summary, grades, behavioral, revenge, overtrading |
| `playbook_intelligence.py` | `/playbook/intelligence` | Overview, per-setup intelligence |
| `performance_os.py` | `/perf-os` | Workflow CRUD, weekly/monthly reviews |
| `calendar.py` | `/calendar` | Month view with daily P&L |
| `reports.py` | `/reports` | Weekly/monthly deterministic reports |
| `charts.py` | `/trades/{id}/chart-data` | OHLCV candle data for TradeLightweightChart |

---

## 4. Backend Services

| Service File | Purpose |
|-------------|---------|
| `trade_service.py` | Merge-or-create, pyramid, merge duplicates |
| `analytics_service.py` | KPI computation (pandas), setup performance, streaks, drawdown |
| `broker_import.py` | Zerodha, Dhan, Generic CSV parsers |
| `ai_coach.py` | Trade data serialization for LLM, review engine |
| `market_data_service.py` | NSE quote fetching, live quote sync |
| `export_service.py` | CSV/XLSX export |
| `live_quote_sync.py` | Background quote sync scheduler job |
| `dhan_webhook_service.py` | Webhook trade closure from Dhan |
| `chart_data_service.py` | Chart candle cache, provider routing (Tapetide/Dhan/mock) |

### 5a. Chart Data Providers (`services/providers/`)

| Provider | Supported Timeframes | Status |
|----------|---------------------|--------|
| `tapetide_market_data.py` | `1d`, `1w` | Active — daily/weekly OHLCV via Tapetide MCP |
| `dhan_market_data.py` | `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `1d` | Stub — awaiting Dhan v2 API |

---

## 5. Frontend Pages (20)

## 5. Frontend V3 Pages (`features-v3/*`)

The live app is feature-sliced under `features-v3/`. `App.tsx` → `V3LiveApp` maps `appStore.activeView` → a slice page via `v3ViewMapping.ts`. Only `pages/LoginPage.tsx` survives from the old `pages/` tree.

| Slice page | View | Purpose |
|------------|------|---------|
| `pages/LoginPage` | `/` (pre-auth) | Auth gate |
| `cockpit/CockpitV3Page` | `dashboard` | Command center: KPIs, equity, live positions, risk, **deterministic Edge feed** (ADR-024) |
| `analytics/AnalyticsV3Page` | `analytics` | Setup perf, streaks, R-distribution, holding period, By-Regime tab |
| `trades/TradesV3Page` | `trades` | Trade list, filters, preview drawer |
| `trade-form/TradeFormV3Page` | `trades (create/edit)` | New/edit trade form |
| `trade-detail/TradeDetailV3Page` | `trades (detail)` | Full trade detail |
| `playbook/PlaybookV3Page` | `playbook` | Setup library (CRUD) + Intelligence/Edge tab |
| `review/ReviewV3Page` | `review` | Per-trade review queue |
| `journal/JournalV3Page` | `journal` | Daily journal + weekly rollups |
| `calendar/CalendarV3Page` | `calendar` | Monthly calendar with daily P&L |
| `capital/CapitalV3Page` | `capital` | Account, capital events, tiers, reconcile |
| `charges/ChargesLedgerPage` | `charges` | Contract-note charges ledger |
| `reports/ReportsV3Page` | `reports` | Weekly/monthly reports |
| `lifecycle/LifecycleV3Page` | `lifecycle` | Emotion, grade, behavioral analytics |
| `coach/CoachV3Page` | `coach` | AI Coach — 5 tabs (Daily, Weekly, Ask, Trade Review, History) |
| `settings/SettingsV3Page` | `settings` | Theme, AI providers, preferences |
| `import/ImportV3Page` | (topbar action) | Broker CSV import |

---

## 6. Frontend Design System (`new-ui/` — canonical, ADR-023)

Token-driven primitives. Import from `@/new-ui`. Slice CSS is layout/grid/gap only; visual tokens live in `new-ui/tokens` and are never redefined per-slice.

| Group | Exports |
|-------|---------|
| `primitives/` | Button, Card, Panel, Surface, Badge, Chip, Divider |
| `layout/` | AppCanvas, Page, Stack, Cluster, Grid, Section, SplitPane |
| `feedback/` | EmptyState, LoadingState, ErrorState, Skeleton |
| `data-display/` | Value, MoneyValue, PercentValue, RMultipleValue, Metric, MetricCard, DataRow, DataList, TableShell |
| `overlays/` | Drawer, Sheet |
| `navigation/` | NavItem, SegmentedControl, Tabs |
| `tokens/` | colors, radii, fonts, shadows |

**Carve-outs** still in `components/ui/` (no new-ui equivalent yet): `BottomSheet`, `PullToRefresh`, `InstallPrompt`, `ErrorBoundary`. The legacy `Glass*`, `SharedUI.tsx`, `StateComponents.tsx` are dead (no live importers) and pending deletion — do not import them.

---

## 7. Centralized Calculations

### Backend: `backend/app/utils/calculations.py`

```python
calculate_trade_metrics(entry_price, exit_price, quantity, fees, stop_price, target_price, direction)
→ TradeCalculationResult:
    risk_per_unit, reward_per_unit, risk_amount, planned_reward_amount,
    risk_reward_ratio, pnl_per_unit, gross_pnl, net_pnl, r_multiple,
    is_valid_for_risk_reward, is_valid_for_pnl, warnings

compute_pnl_value(entry, exit, qty, fees, direction) → Optional[Decimal]
compute_r_multiple(net_pnl, risk_amount) → Optional[Decimal]
compute_live_pnl(entry, ltp, qty, remaining_qty, fees, direction) → Optional[Decimal]
compute_aggregate_kpis(trades_with_pnl) → dict
compute_streaks(trades) → dict
```

### Frontend: `frontend/src/utils/calculations.ts`

```typescript
calculateTradeMetrics(inputs: TradeMetricInputs) → TradeCalculationResult
computeLivePnl(entry, ltp, qty, remainingQty, fees, direction) → number | null
computeLivePnlPct(investedValue, livePnl) → number | null
computeMaxRisk(entryPrice, stopPrice, remainingQty) → number | null
computeCapPct(pnlValue, netEquity) → number | null
```

### Key Design Principle

- **Planned metrics** (Risk:Reward, Risk Amount, Planned Reward) — from stop/target, no exit needed
- **Actual metrics** (Net P&L, R-Multiple, Gross P&L) — from exit price
- **Never mix them** — labels clearly state "Planned" vs "Actual"

---

## 8. Design Tokens (CSS Variables)

```css
/* Backgrounds */
--bg, --bg-card, --bg-card-h, --bg-elevated, --bg-low

/* Text */
--text, --text-heading, --text-muted, --text-faint

/* Semantic */
--profit, --profit-muted, --profit-faint      /* Greens */
--loss, --loss-muted, --loss-faint            /* Reds */
--accent, --accent-hover, --accent-muted      /* Warm orange */
--gold, --gold-faint                          /* Warnings */
--border, --border-medium, --border-strong

/* Spacing (fluid, clamp-based) */
--page-px, --page-py, --page-gap
--heading-size, --text-sm, --text-xs
--cell-px, --cell-py
```

**Cards**: use the `Card` / `Panel` primitives from `@/new-ui` (token-driven). Do not hand-roll card class strings.

---

## 9. Navigation

Single nav config in `features-v3/shell/v3Navigation.tsx` (legacy `app/navigation.ts` mirrors it for the `ActiveView` type + `viewMeta`).

### Desktop sidebar — 5 groups
| Group | Items |
|-------|-------|
| Today | Cockpit, Trades, Calendar, Journal, Review |
| Insight | Analytics, Playbook, Lifecycle |
| Money | Capital, Charges, Reports |
| AI | AI Coach |
| System | Settings |

Import is a **topbar action button** (not a sidebar item). No simple/pro toggle.

### Mobile (bottom nav)
| Icon | Section | Action |
|------|---------|--------|
| LayoutDashboard | `cockpit` | View cockpit |
| TrendingUp | `trades` | View trade list |
| **+** | — | **Create Trade** (raised FAB) |
| BookOpen | `journal` | View journal |
| ClipboardList | `review` | Review queue |

---

## 10. Key Architecture Decisions (ADRs)

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
| 011 | Dual state management (Zustand + React Query) |
| 012 | Trade status lifecycle (auto-computed) |
| 013 | nginx + Traefik proxy setup |
| 015 | Alembic migrations |
| 016 | Performance OS domain model |
| 017 | Operational dashboard aggregate endpoint |
| 018 | Lifecycle analytics model |
| 019 | Partial exits and remaining quantity |
| 020 | Live quote cache and market data provider |
| 021 | Naive IST datetime display fix |
| 022 | V3 finish — feature consolidation and culls |
| 023 | `new-ui` as canonical design system |
| 024 | Cockpit absorbs the deterministic Edge feed |

See `docs/adr/README.md` for the full index.

---

## 11. View State Machine

```
appStore.activeView ∈ {dashboard, analytics, trades, playbook, review,
                       capital, settings, coach, journal, calendar,
                       reports, lifecycle, charges}

When activeView === 'trades':
    tradeFormMode ∈ {list, create, edit, detail}
    selectedTradeId: number | null

V3LiveApp maps activeView → V3 section (v3ViewMapping.ts); the Import
section is reached via the topbar Import action (sectionOverride), not activeView.
```

---

## 12. API Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | Login (returns JWT) |
| POST | `/auth/register` | Register |
| GET | `/auth/me` | Current user |
| GET | `/trades/` | List (filter: status, symbol, date) |
| POST | `/trades/` | Create (auto-merges by symbol+date) |
| GET | `/trades/{id}` | Get single trade |
| PUT | `/trades/{id}` | Update trade |
| DELETE | `/trades/{id}` | Soft delete |
| POST | `/trades/{id}/pyramid` | Add shares |
| POST | `/trades/{id}/partial-exits` | Record partial exit |
| POST | `/trades/{id}/stop-history` | Update stop loss |
| POST | `/trades/{id}/images` | Upload chart |
| POST | `/trades/import?broker=X` | Broker CSV import |
| GET | `/dashboard/operational` | KPI + risk + capital + equity |
| GET | `/dashboard/intelligence` | Lifecycle + behavioral highlights |
| GET | `/analytics/dashboard` | Full analytics payload |
| POST | `/coach/review/daily` | AI daily review |
| POST | `/coach/trade-review` | AI trade review |
| POST | `/market/sync-quotes` | Sync live NSE prices |

---

## 13. Testing

| Layer | Framework | Location | Count |
|-------|-----------|----------|-------|
| Backend | pytest + SQLite | `backend/tests/` | 200 tests |
| Frontend | Vitest + jsdom | `frontend/src/test/` | 43 tests |
| TypeScript | tsc --noEmit | — | 0 errors |
| Lint | ESLint | — | 7 pre-existing errors |

**Run all**: `cd backend && pytest tests/ && cd ../frontend && tsc --noEmit && vitest run && npm run build`

---

## 14. Environment Variables

| Variable | Default | Required |
|----------|---------|----------|
| `DATABASE_URL` | SQLite | Prod: PostgreSQL URL |
| `POSTGRES_PASSWORD` | — | Required for Docker Compose; no production default |
| `SECRET_KEY` | — | Yes; no production default |
| `JWT_SECRET_KEY` | — | Yes; no production default |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | No |
| `RATE_LIMIT_OFF` | false | Set `true` in `.env` only when intentionally disabling rate limits |
| `ALLOW_LOCAL_AI_URLS` | false | Allows local/private AI provider URLs only for trusted local setups; `DEBUG=true` also allows local URLs |
| `VITE_API_URL` | `/api/v1` | Frontend build-time |
| `SENTRY_DSN` | — | Optional |
| `UPLOAD_DIR` | `uploads/charts` | Chart image storage |
| `MAX_UPLOAD_SIZE_MB` | 10 | No |
| `TELEGRAM_BOT_TOKEN` | — | Bot only |
| `OLLAMA_BASE_URL` | — | AI Coach only |
| `MARKET_DATA_API_URL` | — | Live quotes only |
| `TAPETIDE_ENABLED` | false | Set `true` for daily OHLCV charts |
| `TAPETIDE_API_KEY` | — | Optional Tapetide MCP auth token; blank disables Tapetide calls gracefully |
| `TAPETIDE_MCP_URL` | `https://mcp.tapetide.com/mcp` | Tapetide MCP endpoint |
| `TAPETIDE_DEFAULT_EXCHANGE` | `NSE` | Exchange prefix for symbols |

---

## 15. Quick Commands

```bash
# Full stack
docker compose up -d --build

# Backend
cd backend && python3 -m pytest tests/ -v          # Tests
cd backend && uvicorn app.main:app --reload        # Dev server

# Frontend
cd frontend && npm run dev                           # Dev server
cd frontend && npx vitest run                        # Tests
cd frontend && npx tsc --noEmit                      # Typecheck
cd frontend && npm run lint                          # Lint
cd frontend && npm run build                         # Production build
```
