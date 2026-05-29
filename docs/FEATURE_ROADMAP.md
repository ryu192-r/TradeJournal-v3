# Trading Journal v3 — Feature Roadmap

> Source: v2 features + v1 ideas + new brainstorm
> Format: Vertical slices — each item is independent
> Last updated: May 2026 — v2 Phase-1 polish in progress

---

## ✅ COMPLETED

### Phase 0: Stabilization ✅
- Closed P0/P1/P2/P3 bug backlog
- Backend regression tests: operational dashboard, lifecycle analytics, market context, partial exits, timeline, chart images, Performance OS
- Frontend smoke tests: Dashboard, Trade Detail, Performance OS, Partial Exit flows
- ADRs 016–021 documented
- Fixed naive-UTC datetime double-conversion bug (ADR-021): `formatDate()`, `formatDateTime()`, `isoToDatetimeLocal()` now append `Z` to naive timestamps before parsing

### Phase 1: Core Trading ✅
- [x] Trade CRUD (all LONG — Indian equities)
- [x] Open/Closed derived from `exit_price`
- [x] Auto-merge by `(symbol, date)` on create/import
- [x] Pyramid: add shares to open positions
- [x] Soft delete (status = `"deleted"`)
- [x] Date range filter, bulk select + delete
- [x] Keyboard shortcuts (N, J/K)
- [x] Excel export
- [x] Setup dropdown fetched from Playbook active setups
- [x] Playbook stats sync after trade mutations
- [x] Exit reason auto-detection (stop_loss / target / manual)
- [x] Stop history (audit trail with timeline)
- [x] SL inline edit in trades table
- [x] Trades table: Max Risk, P&L %, Cap % columns
- [x] Chart image attachments (upload, gallery, delete)
- [x] Trade detail page: PnL hero, metric grid, stat cards, charts, lifecycle

### Phase 2: Broker Import ✅
- [x] Zerodha Console P&L CSV parser
- [x] Dhan tradebook CSV parser (aggregates BUY/SELL)
- [x] Generic CSV parser
- [x] Import preview with dry-run
- [x] Skip existing trades for same `(symbol, date)`

### Phase 3: Capital System ✅
- [x] Set/edit initial balance
- [x] Deposit / Withdraw modals
- [x] Delete capital events
- [x] Deployed vs Available capital display
- [x] Auto-reconciliation on all trade mutations
- [x] Manual reconcile button with toast feedback
- [x] Dynamic tiers (TierEditor)
- [x] Breakeven threshold (editable)
- [x] Equity curve (daily realized equity)
- [x] Total Equity with Unrealized P&L display

### Phase 4: Dashboards ✅
- [x] Operational dashboard (single-call aggregate endpoint)
- [x] Intelligence dashboard (lifecycle, behavioral, playbook, market)
- [x] KPI cards: Net P&L, Win Rate, Profit Factor, Avg R, Expectancy, Max DD
- [x] Live positions with NSE quotes
- [x] Risk Command Center (heat, deployed, warnings)
- [x] Equity section (Realized + Total Equity cards + chart)
- [x] Win/loss streaks

### Phase 5: Analytics ✅
- [x] Full analytics dashboard
- [x] Setup performance breakdown
- [x] R-multiple distribution
- [x] Drawdown chart
- [x] Day-of-week / time-of-day patterns
- [x] Holding period analysis
- [x] Monthly PnL bar chart

### Phase 6: AI Coach ✅
- [x] 7 tabs: Daily, Weekly, Ask, Patterns, Rules, Trade Review, History
- [x] 8 providers (Ollama, OpenAI, DeepSeek, Anthropic, Google, Custom, OpenCode Zen)
- [x] Trade Review engine with A–F scoring
- [x] Behavioral Score (programmatic + AI composite)
- [x] 5 mentor personalities with 0-100% blending
- [x] ISO 8601 datetime format
- [x] Timeout chain: 120s → 180s → 60-300s

### Phase 7: Journal & Review ✅
- [x] Daily journal with structured prompts
- [x] Discipline rating (1-5, separate from mood)
- [x] Weekly stats (trade count, PnL, win rate, avg R)
- [x] Review stream with back navigation, re-review, bulk mode
- [x] Execution grades (A–F per dimension)

### Phase 8: Performance OS ✅
- [x] Daily workflow shell (pre-market → execution → review → behavior)
- [x] Weekly review workflow with guided template
- [x] Monthly reviews
- [x] Daily SA Notes (pre-market + post-market journaling)
- [x] Textarea autosave with debounce

### Phase 9: Market Data ✅
- [x] Live NSE quote cache (`live_quotes` table)
- [x] Quote sync service (`POST /market/sync-quotes`)
- [x] Quote freshness status (fresh/stale/failed/not_synced)
- [x] Market performance correlation (PnL by trend/regime/VIX)
- [x] Market regime summary

### Phase 10: Lifecycle Analytics ✅
- [x] Emotion summary by trade
- [x] Grade summary across dimensions
- [x] Behavioral analytics (emotion × grade matrix)
- [x] Revenge trade detection
- [x] Overtrading detection
- [x] Early exit analysis with capture ratio
- [x] Composite discipline score

### Phase 11: Calendar & Reports ✅
- [x] Monthly calendar with daily P&L
- [x] Trade count, wins, discipline per calendar day
- [x] Weekly/monthly deterministic reports
- [x] Setup breakdown in reports

### Phase 12: UI/UX ✅
- [x] Light/dark theme (CSS variables)
- [x] Fluid responsive layout (`clamp()`)
- [x] Code-split views (`React.lazy`/`Suspense`)
- [x] Indian Rupee formatting (₹1.2k / ₹1.50L / ₹1.25Cr)
- [x] PWA support (manifest + service worker)
- [x] Auto-refresh on mutation/mount/focus/reconnect

---

## ✅ V2 OVERHAUL (In Progress)

### 🟢 Completed

#### Calculation Centralization
- [x] Centralized trade math: `backend/app/utils/calculations.py`
- [x] Centralized frontend math: `frontend/src/utils/calculations.ts`
- [x] `r_multiple` auto-computed by backend — no longer user-editable
- [x] Risk:Reward (planned) separated from R-Multiple (actual)
- [x] ALL edge cases handled: missing stop, missing target, zero risk, zero qty
- [x] Live PnL formula centralized via `computeLivePnl()`
- [x] Max Risk, Cap % formulas centralized
- [x] Duplicated PnL/KPI/streak logic removed from trades router and operational dashboard
- [x] 35 backend + 29 frontend calculation tests

#### Trade Detail Polish
- [x] Sub-components: TradeSummaryHeader, PnLHero, MetricGrid, StatCards, NotesCard
- [x] Delete with confirmation (two clicks)
- [x] Duration display ("1 day 3h")
- [x] Review notes section
- [x] AI Review card with generate button (closed trades only)
- [x] 8 computed metrics: Gross P&L, Net P&L, Risk Amount, Planned Reward, Risk:Reward, R Multiple, P&L/Unit, Risk/Unit
- [x] "Not enough data" for missing values, warnings for invalid
- [x] Mobile-first responsive grid

#### Trade Form Redesign
- [x] 6 clear sections: Basics → Risk Plan → Result → Metrics → Classification → Notes
- [x] Live metrics preview with helpful hints ("Enter stop", "Need exit + stop")
- [x] Tags input (comma-separated → array on submit)
- [x] `r_multiple` removed from form — auto-computed
- [x] Section subtitles explain purpose

#### Mobile Navigation
- [x] Bottom nav: Dashboard | Trades | **+** (FAB) | Analytics | Review
- [x] Raised FAB for "Create Trade" action
- [x] Removed old grid-cols-5 with "More" button

#### Trade List
- [x] Responsive card view (auto on mobile, toggleable)
- [x] Card shows: symbol, status, P&L, R-multiple, entry/exit/qty
- [x] Tap card → trade detail
- [x] LayoutGrid/LayoutList toggle button

#### Design System
- [x] `KpiCard` component (applied to Dashboard)
- [x] `InlineBadge` component
- [x] `Tabs` component (reusable tab bar)
- [x] `GlassCard` fixed — no longer references dead `.glass` CSS class
- [x] Dashboard KPI cards use shared `KpiCard`

### 🟡 In Progress / Planned

- [ ] Analytics `analytics_service.py` — use shared `compute_aggregate_kpis()`
- [ ] `playbook_intelligence.py` — use shared KPI computation
- [ ] `GlassCard` applied to more pages (currently only EditTrade loading state)
- [ ] AICoach inline tabs → use shared `Tabs` component
- [ ] URL routing (React Router with deep-linkable views) — major architectural change
- [ ] Trade table action buttons → use shared `GlassButton` consistently
- [ ] Chart lightbox/fullscreen viewer
- [ ] Thumbnail generation for chart uploads

---

## 🔴 HIGH PRIORITY (Next Up)

### 1. WebSocket Live Price Broadcast
- Push live prices every 30s during market hours instead of polling
- **Files:** `backend/app/services/ws_manager.py`, `backend/app/routers/ws.py`

### 2. APScheduler Background Jobs
- Risk check every 60s, price broadcast trigger, pre-market check, EOD summary
- Already partially implemented with conditional import in `main.py`

### 3. Rule Compliance Heatmap
- Auto-detected violations: IMPULSE_ENTRY, LATE_ENTRY, NO_ORB, FOMO, REVENGE
- Cross-analysis: violations × emotion × setup

### 4. Behavioral Pattern Detection (Local Engine)
- Rule-based detectors: revenge cluster, EOD revenge, Monday spike, overtrading, FOMO
- Current AI coach is external — add local engine for performance

---

## 🟡 MEDIUM PRIORITY

### 5. Telegram Bot Activation
- Bot container exists but needs `TELEGRAM_BOT_TOKEN`
- Features: trade parsing, daily PnL, stop reminders

### 6. Alert & Notification System
- Channels: WebSocket (in-app), Telegram
- Triggers: PnL breach, stop proximity, behavioral patterns

### 7. Analytics `analytics_service.py` Consolidation
- Use shared `compute_aggregate_kpis()` from calculations module
- Remove duplicate KPI logic in pandas

### 8. Drawdown Series & Underwater Chart
- Day-by-day underwater chart, recovery factor

### 9. Expectancy by Emotion & Time Block
- Breakdown expectancy across emotions, time-of-day windows

---

## 🔵 LOWER PRIORITY

### 10. Anti-Journal (Missed Opportunity Tracker)
- Log, list, resolve missed trades. Track "ghost P&L"

### 11. MAE/MFE Calculation
- Per-trade MAE/MFE, batch backfill, summary by setup

### 12. Position Size & Risk Calculator
- Risk-based share calculation: `size = (capital * risk%) / (entry - stop)`

### 13. Import from More Brokers
- Upstox, Angel One, Fyers

### 14. Multiple Account Support / Multi-Currency

---

## Status Summary

| Category | Count |
|----------|-------|
| ✅ Completed (v3) | 12 phases |
| ✅ v2 Overhaul completed | 9 sections |
| 🟡 v2 Overhaul in progress | 6 items |
| 🔴 High Priority | 4 items |
| 🟡 Medium Priority | 5 items |
| 🔵 Lower Priority | 5 items |

---

*Pick one item at a time. Each is an independent vertical slice.*
