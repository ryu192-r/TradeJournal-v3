# Trading Journal v3 — Feature Roadmap

> Source: v2 features + v1 ideas + new brainstorm
> Format: Vertical slices — each item is independent
> Last updated: May 2026

---

## ✅ COMPLETED (Built in v3)

### Phase 0 Stabilization ✅
- Closed the current P0/P1/P2/P3 bug backlog from `docs/Ideas/Chatgpt/Bugs-Fixes.md`
- Added focused backend regression tests for operational dashboard, lifecycle analytics, market context, partial exits, timeline, chart images, and Performance OS
- Added frontend smoke coverage for Dashboard, Trade Detail, Performance OS, and Partial Exit flows
- Documented the TradingOS foundation decisions in ADR-016 through ADR-020
- Refreshed canonical docs so roadmap, project overview, context, and agent guidance match the implemented behavior

### ~~1. Light/Dark Theme Toggle~~ ✅
- CSS variables via `data-theme="dark"|"light"` attr on root
- Fonts: Newsreader (display), Inter (body), JetBrains Mono (data)
- Toggle in Settings page

### ~~2. WebSocket Live Price Broadcast~~ ✅ (Implemented differently)
- Live NSE prices via cached quote sync (`POST /market/sync-quotes`)
- Cached in `live_quotes` table, refreshed on demand
- Frontend polls every 60s, used for live position cards and unrealized P&L
- Quote freshness status is surfaced as `fresh`, `stale`, `failed`, or `not_synced`

### ~~3. Capital/Account Dashboard~~ ✅
- Net equity card with edit starting capital
- Deposit/Withdraw modals, delete events, reconcile button
- Dynamic tier system with TierEditor
- Equity curve (daily realized equity)
- **Dashboard** now shows both Realized Equity and Total Equity (with unrealized P&L)

### ~~4. Psychology Dashboard~~ ✅ (as Intelligence Dashboard)
- Lifecycle analytics: emotion logs, execution grades, discipline score
- Behavioral analytics: overtrading days, revenge trades, early exits, capture ratio
- Playbook intelligence: setup performance, win rate, avg R
- Market context: NIFTY regime, VIX, breadth

### ~~5. Partial Exits~~ ✅
- `POST /trades/{id}/partial-exits` — record partial closes
- `remaining_qty` computed from `quantity - SUM(partial_exit.qty)`
- Full remaining-quantity exits are rejected here; close the trade through the main trade close flow
- Dashboard uses partial exits for deployed capital calculation
- Trade detail modal shows partial exit timeline

### ~~6. Execution Grades~~ ✅
- A–F per dimension: entry_quality, sizing_quality, stop_quality, patience, rule_adherence, exit_quality, overall_grade
- Logged via trade detail modal lifecycle section
- Used in AI trade reviews

### ~~7. Trade Review Engine~~ ✅
- `POST /coach/trade-review/{trade_id}` — loads playbook, emotions, grades, partial exits
- Produces structured review with scores, strengths, weaknesses, rule violations, coaching notes
- Trade detail modal shows AI review button

### ~~8. Broker Trade Import~~ ✅
- Zerodha Console P&L CSV parser
- Dhan tradebook CSV parser (aggregates BUY/SELL legs)
- Generic CSV parser
- BrokerImportModal with preview, dry-run, skip indicators

### ~~9. Live Quotes~~ ✅
- `LiveQuote` model caches NSE prices
- Market data provider sync via `backend/app/services/market_data_service.py`
- Quote freshness metadata prevents stale prices from looking live
- Used for live dashboard position cards and unrealized P&L

### ~~10. Performance OS~~ ✅
- Weekly review workflow with guided template
- Monthly reviews
- Daily SA (Super Analyzer) notes: pre-market and post-market guided journaling

---

## 🔴 HIGH PRIORITY (Next Up)

### 11. WebSocket Live Price Broadcast (upgrade from polling)
- **Files:** `backend/app/services/ws_manager.py`, `backend/app/routers/ws.py`, `frontend/src/hooks/useWebSocket.ts`
- **What:** Push live prices every 30s during market hours instead of polling
- **Why:** Polling uses more bandwidth and has latency. WebSocket gives instant updates.

### 12. APScheduler Background Jobs
- **Files:** `backend/app/scheduler.py`, `backend/app/main.py` (register on startup)
- **Jobs:**
  - Risk check every 60s (P&L breaches, position limits, stop proximity)
  - Price broadcast trigger every 30s (drives WebSocket)
  - Pre-market readiness check at 9:00 IST
  - EOD summary at 3:35 IST
  - Nightly DB backup at 2:00 IST

### 13. Rule Compliance Heatmap
- **Files:** `backend/app/services/compliance_service.py`, frontend compliance page
- **Auto-detected violations:** IMPULSE_ENTRY, LATE_ENTRY, NO_ORB, TRADE_AFTER_2PM, TIGHT_STOP, FOMO, REVENGE, COPY_TRADE
- **Cross-analysis:** violations × emotion × setup

### 14. Behavioral Pattern Detection (Local Engine)
- **Files:** `backend/app/services/behavioral_service.py` (current AI coach is external — add local rule-based engine)
- **Detectors:** Revenge cluster (3+ trades/45min after loss), EOD revenge (2+ post-3PM), Monday spike, overtrading, fear/greed, FOMO, overconfidence (3-win streak → 2× risk)

---

## 🟡 MEDIUM PRIORITY

### 15. Telegram Bot Re-activation
- **What:** Bot container restarts without token. Add token + chat ID to activate.
- **Features:** Free-form trade parsing, daily PnL summary, stop reminders

### 16. Alert & Notification System
- **Channels:** WebSocket (in-app), Telegram (via bot)
- **Triggers:** P&L breach, position limit hit, stop proximity, behavioral pattern detected

### 17. Calendar P&L View
- **What:** Month calendar with daily P&L, trade count, wins per calendar day

### 18. Drawdown Series & Underwater Chart
- **What:** Day-by-day underwater chart, recovery factor, payoff ratio

### 19. Expectancy by Emotion & Time Block
- **What:** Breakdown expectancy across emotions, time-of-day windows

---

## 🔵 LOWER PRIORITY

### 20. Anti-Journal (Missed Opportunity Tracker)
- Log, list, resolve missed trades. Track "ghost P&L".

### 21. MAE/MFE Calculation
- Per-trade MAE/MFE, batch backfill, summary by setup

### 22. Position Size & Risk Calculator
- Risk-based share calculation: `size ENTRY SL CAPITAL RISK%`

### 23. Dhan Token Renewal OAuth Flow
- OAuth flow for Dhan API token renewal (12-month validity)

### 24. Nightly Local DB Backup
- WAL checkpoint, 7-day rotation

### 25. Multi-currency Support
- Currently INR-only. Add currency configuration.

---

## Status Summary

| Category | Count |
|----------|-------|
| ✅ Completed | 10 |
| 🔴 High Priority | 4 |
| 🟡 Medium | 5 |
| 🔵 Lower | 5 |
| **Total** | **24** |

---

*Pick one item at a time. Each is an independent vertical slice.*
