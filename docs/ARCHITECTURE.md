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
│       ├── App.tsx              # Auth gate, lazy view switching, navigation
│       ├── index.css            # CSS vars, Tailwind, fluid layout
│       ├── app/
│       │   └── navigation.ts    # ActiveView types, nav sections, mobile items
│       ├── pages/               # 20 page components
│       ├── components/
│       │   ├── ui/              # Shared design system (17 components)
│       │   ├── layout/          # Sidebar, TopBar, bottom nav
│       │   ├── dashboard/       # LiveDashboard, equity curve
│       │   ├── trades/          # TradeDetailContent, ChartImageGallery, BrokerImport
│       │   ├── forms/           # TradeEntryForm (shared create/edit)
│       │   ├── lifecycle/       # Timeline, EmotionLogger, ExecutionGrader
│       │   ├── coach/           # AICoachPage (7 tabs)
│       │   ├── review/          # TradeReviewStream
│       │   ├── playbook/        # SetupPlaybookPage
│       │   ├── risk/            # RiskCommandCenter, PortfolioHeatGauge
│       │   ├── ideas/           # TradeIdeasPage
│       │   ├── journal/         # DailyJournalForm
│       │   └── market/          # MarketContext
│       ├── hooks/               # React Query hooks per domain
│       ├── lib/                 # api.ts, endpoints.ts, queryInvalidation.ts, utils.ts
│       ├── store/               # Zustand: appStore, authStore, toastStore
│       ├── types/               # TypeScript types (7 files)
│       ├── utils/               # format.ts, **calculations.ts**, liveQuotes.ts, performance.ts
│       ├── schemas/             # Zod: tradeForm.ts
│       └── test/                # Vitest smoke tests + setup
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
│   ├── adr/                     # 20 Architecture Decision Records
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
| `TradeIdea` | `trade_ideas` | symbol, thesis, confidence, status, traded_trade_id |
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

## 3. Backend Routers (28)

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
| `trade_ideas.py` | `/ideas` | CRUD, convert to trade |
| `daily_journal.py` | `/journal` | GET/PUT by date, weekly stats |
| `ai_settings.py` | `/ai` | Config, providers, mentors, test |
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

| Page | Path | Purpose |
|------|------|---------|
| `LoginPage` | `/` | Auth gate |
| `DashboardPage` | `dashboard` | KPI cards, equity, live positions, risk, alerts |
| `AnalyticsDashboardPage` | `analytics` | Full analytics: setup perf, streaks, R-dist, holding period |
| `TradesPage` | `trades` | Table/card list, filters, column config, bulk actions |
| `CreateTradePage` | `trades (create)` | New trade form |
| `EditTradePage` | `trades (edit)` | Edit trade form |
| `TradeDetailPage` | `trades (detail)` | Full trade detail view |
| `SetupPlaybookPage` | `playbook` | Manage setups, tactics, rules |
| `TradeIdeasPage` | `ideas` | Idea capture and convert-to-trade |
| `CapitalPage` | `capital` | Account, capital events, tiers |
| `ReviewStream` | `review` | Sequential trade review with notes/tags |
| `SettingsPage` | `settings` | Theme, AI providers, mentors |
| `AICoachPage` | `coach` | 7 tabs: Daily, Weekly, Ask, Patterns, Rules, Review, History |
| `PerformanceOSPage` | `perf-os` | Daily workflow, weekly/monthly reviews |
| `DailySANotesPage` | `sa-notes` | Pre-market + post-market journaling |
| `JournalPage` | `journal` | Journal view and write |
| `CalendarPage` | `calendar` | Monthly calendar with daily P&L |
| `ReportsPage` | `reports` | Weekly/monthly reports |
| `LifecyclePage` | `lifecycle` | Emotion, grade, behavioral analytics |
| `RiskPage` | `risk` | Risk command center |
| `MarketContextPage` | `market` | NIFTY, VIX, breadth, regime |

---

## 6. Frontend Design System (`components/ui/`)

| Component | File | Purpose |
|-----------|------|---------|
| `SharedUI.tsx` | SharedUI.tsx | SyncBadge, LastUpdated, SectionHeader, SectionTitle, MetricCard, KpiCard, CollapsibleSection, PageHeader, StatusBadge, InlineBadge, Tabs, AlertRow, SafeAreaPadding |
| `StateComponents.tsx` | StateComponents.tsx | EmptyState, ErrorState, SectionSkeleton, CardSkeleton, MetricSkeleton |
| `GlassButton.tsx` | GlassButton.tsx | Primary/secondary/ghost/danger buttons |
| `GlassInput.tsx` | GlassInput.tsx | Form input with label + error |
| `GlassSelect.tsx` | GlassSelect.tsx | Form select dropdown |
| `GlassTextarea.tsx` | GlassTextarea.tsx | Form textarea |
| `GlassCard.tsx` | GlassCard.tsx | Standard card wrapper |
| `GlassBadge.tsx` | GlassBadge.tsx | Status badge (profit/loss/accent/muted) |
| `GlassTagInput.tsx` | GlassTagInput.tsx | Tag input |
| `BottomSheet.tsx` | BottomSheet.tsx | Slide-up modal (mobile) |
| `PullToRefresh.tsx` | PullToRefresh.tsx | Mobile pull-to-refresh |
| `EdgeSwipe.tsx` | EdgeSwipe.tsx | Edge swipe gesture area |
| `SwipeToDelete.tsx` | SwipeToDelete.tsx | Swipe-to-delete list items |
| `ErrorBoundary.tsx` | ErrorBoundary.tsx | React error boundary |
| `InstallPrompt.tsx` | InstallPrompt.tsx | PWA install prompt |
| `OfflineIndicator.tsx` | OfflineIndicator.tsx | Offline banner |
| `ConfirmModal.tsx` | ConfirmModal.tsx | Confirmation dialog |

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

**Standard card class**: `const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'`

---

## 9. Navigation

### Desktop (sidebar)
- 5 sections: Command Center, Trading Desk, Review Loop, Edge Lab, System
- Simple mode: 7 core views visible
- Advanced mode: all 20 views visible

### Mobile (bottom nav)
| Icon | View | Action |
|------|------|--------|
| Dashboard | `dashboard` | View dashboard |
| Briefcase | `trades` | View trade list |
| **+** | — | **Create Trade** (raised FAB) |
| BarChart | `analytics` | View analytics |
| TrendingUp | `review` | Review queue |

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

---

## 11. View State Machine

```
appStore.activeView ∈ {dashboard, analytics, trades, playbook, review,
                       ideas, capital, settings, coach, perf-os, sa-notes,
                       journal, calendar, reports, lifecycle, risk, market}

When activeView === 'trades':
    tradeFormMode ∈ {list, create, edit, detail}
    selectedTradeId: number | null
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
| `SECRET_KEY` | — | Yes |
| `JWT_SECRET_KEY` | — | Yes |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | 30 | No |
| `RATE_LIMIT_OFF` | false | Set `true` for Docker |
| `VITE_API_URL` | `/api/v1` | Frontend build-time |
| `SENTRY_DSN` | — | Optional |
| `UPLOAD_DIR` | `uploads/charts` | Chart image storage |
| `MAX_UPLOAD_SIZE_MB` | 10 | No |
| `TELEGRAM_BOT_TOKEN` | — | Bot only |
| `OLLAMA_BASE_URL` | — | AI Coach only |
| `MARKET_DATA_API_URL` | — | Live quotes only |
| `TAPETIDE_ENABLED` | false | Set `true` for daily OHLCV charts |
| `TAPETIDE_API_KEY` | — | Tapetide MCP auth token |
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
