# Trading Journal v3 — Feature Roadmap

> Source: v2 features + v1 ideas + new brainstorm
> Format: Vertical slices — each item is independent

---

## 🔴 IMMEDIATE (Build v0.1)

### 1. Light/Dark Theme Toggle
- **Files:** `frontend/src/pages/SettingsPage.tsx`, `frontend/src/index.css`, `frontend/tailwind.config.js`
- **What:** Toggle between "Dark Discipline" (current) and "Disciplined Warmth" (light paper) themes
- **Why:** Current design is dark-only. Settings has nothing for display preferences.
- **V2 equivalent:** Settings page had theme toggle

### 2. WebSocket Live Price Broadcast
- **Files:** `backend/app/services/ws_manager.py`, `backend/app/routers/ws.py`, `frontend/src/hooks/useWebSocket.ts`
- **Backend:** Broadcast live NSE prices every 30s during market hours (9:15–15:30 IST) via WebSocket
- **Frontend:** Hook to connect, display live P&L on positions/trades page
- **V2 equivalent:** `ws_manager.py`, WS router, 30s broadcast cycle

### 3. Capital/Account Dashboard
- **Files:** `frontend/src/pages/AnalyticsDashboardPage.tsx` (add section), `backend/app/services/capital_service.py`
- **Backend:** Net equity (realized + unrealized), deposits/withdrawals, tier progression, equity curve with milestones
- **Frontend:** New "Capital" tab on dashboard — net equity card, tier progress bar, equity vs milestone chart
- **V2 equivalent:** `tj capital`, `tj ec`, tier progression

### 4. APScheduler Background Jobs
- **Files:** `backend/app/scheduler.py`, `backend/app/main.py` (register on startup)
- **Jobs:**
  - Risk check every 60s (P&L breaches, position limits, stop proximity)
  - Price broadcast trigger every 30s (drives WebSocket)
  - Pre-market readiness check at 9:00 IST
  - EOD summary at 3:35 IST
  - Nightly DB backup at 2:00 IST
- **V2 equivalent:** Full APScheduler setup with 6 jobs

### 5. Psychology Dashboard
- **Files:** `frontend/src/pages/PsychologyPage.tsx`, `backend/app/services/psychology_service.py`
- **Backend:** Emotion × performance breakdown (win rate by emotion), tilt detection (3+ losses → check), cascade detection (same reactive emotion within 30min)
- **Frontend:** Psychology tab with emotion breakdown chart, tilt alerts, discipline score
- **V2 equivalent:** `tj emotion`, psychology dashboard, compliance heatmap

---

## 🟠 HIGH PRIORITY (Core Trading Workflow)

### 6. Anti-Journal (Missed Opportunity Tracker)
- **Files:** `backend/app/routers/anti_journal.py`, `backend/app/models/anti_journal.py`, `backend/app/services/anti_journal_service.py`, frontend page
- **Backend:** Log, list, resolve, and summarize missed trades. Track "ghost P&L" (what you WOULD have made)
- **Frontend:** Anti-Journal page — log missed entry, view missed opportunity cost
- **V2 equivalent:** Anti-Journal full stack

### 7. Position Management Scoreboard
- **Files:** `backend/app/services/scoreboard_service.py`, frontend analytics section
- **Backend:** A–F grade across exit efficiency, stop management, breakeven rate, holding discipline, scaling, stop distance
- **Frontend:** Scoreboard card on dashboard/analytics
- **V2 equivalent:** `tj position`

### 8. Rule Compliance Heatmap
- **Files:** `backend/app/services/compliance_service.py`, frontend compliance page
- **Auto-detected violations:** IMPULSE_ENTRY, LATE_ENTRY, NO_ORB, TRADE_AFTER_2PM, TIGHT_STOP, FOMO, REVENGE, COPY_TRADE
- **Cross-analysis:** violations × emotion × setup
- **V2 equivalent:** `tj compliance`

### 9. Behavioral Pattern Detection (Local Engine)
- **Files:** `backend/app/services/behavioral_service.py` (current AI coach is external — add local rule-based engine)
- **Detectors:** Revenge cluster (3+ trades/45min after loss), EOD revenge (2+ post-3PM), Monday spike, overtrading, fear/greed, FOMO, overconfidence (3-win streak → 2× risk)
- **V2 equivalent:** 6 automated behavioral detectors

### 10. Exit Efficiency Scoring
- **Files:** `backend/app/services/exit_efficiency.py`
- **What:** Per-trade letter grade — how much of the favorable move captured (winners), damage limitation (losers)
- **V2 equivalent:** `tj position` included exit efficiency grade

---

## 🟡 MEDIUM PRIORITY

### 11. Alert & Notification System
- **Files:** `backend/app/services/alert_service.py`, `backend/app/routers/alerts.py`
- **Channels:** WebSocket (in-app), Telegram (via bot)
- **Triggers:** P&L breach, position limit hit, stop proximity, behavioral pattern detected
- **V2 equivalent:** Alert model + multi-channel dispatch

### 12. Real-time Risk Monitor
- **Files:** `backend/app/services/risk_service.py`
- **Checks every 60s:** P&L breach alerts, position limit check, stop-loss proximity warnings (critical/warning)
- **V2 equivalent:** Risk monitor job

### 13. Expectancy by Emotion & Time Block
- **Files:** Extend analytics_service.py
- **What:** Breakdown expectancy across emotions, time-of-day windows (9:15-10, 10-12, 12-2, 2-3:30)
- **V2 equivalent:** `tj time`, `tj emotion`

### 14. Calendar P&L View
- **Files:** Frontend calendar component, analytics endpoint
- **What:** Month calendar with daily P&L, trade count, wins per calendar day
- **V2 equivalent:** Calendar P&L in analytics

### 15. Drawdown Series & Underwater Chart
- **Files:** Analytics dashboard already has basic drawdown — extend
- **What:** Day-by-day underwater chart, recovery factor, payoff ratio, best/worst trades
- **V2 equivalent:** Drawdown series

---

## 🔵 LOWER PRIORITY

### 16. Natural Language Trade Entry (via CLI)
- **Files:** New CLI tool (Typer + Rich)
- **What:** `tj "Bought TCS at 3500 SL 3430 breakout fomo"` → auto-log trade
- **V2 equivalent:** Full CLI with natural language parsing

### 17. Market Observations
- **Files:** `backend/app/services/observation_service.py`
- **What:** Log daily market observations with tag filtering
- **V2 equivalent:** `obs` CLI command

### 18. Mental Capital Checks
- **Files:** New service
- **What:** Pre-market readiness scoring (focus, confidence, emotion), post-loss cooldown rituals
- **V2 equivalent:** Mental capital checks

### 19. Scale-In / Pyramid Position Support
- **Files:** `backend/app/models/scale_in.py`, extend trade entry
- **What:** Add to existing open trades with full cost-basis tracking
- **V2 equivalent:** `scale_ins` table, CLI ScaleInModal

### 20. MAE/MFE Calculation
- **Files:** `backend/app/services/mae_mfe_service.py`
- **What:** Per-trade MAE/MFE, batch backfill, summary by setup
- **V2 equivalent:** `calc mae-mfe` CLI

### 21. Position Size & Risk Calculator
- **Files:** Extend bot parser + add calculator endpoint
- **What:** Risk-based share calculation: `size ENTRY SL CAPITAL RISK%`
- **V2 equivalent:** `calc` CLI command

### 22. Dhan Token Renewal OAuth Flow
- **Files:** `backend/scripts/token_renewal.py`
- **What:** OAuth flow for Dhan API token renewal (12-month validity)
- **V2 equivalent:** `tj token-renew`, `tj token <id>`

### 23. Nightly Local DB Backup
- **Files:** `backend/scripts/backup_db.py`
- **What:** WAL checkpoint, 7-day rotation, in addition to Telegram backup
- **V2 equivalent:** Nightly backup script

### 24. Pre-Market & EOD Summaries
- **Files:** Extend bot scheduled jobs
- **What:** Auto-generated pre-market readiness check (9AM) and EOD summary (3:35PM IST)
- **V2 equivalent:** Pre-market + EOD summaries

### 25. Weekly Report Generation
- **Files:** `backend/app/services/weekly_report.py`
- **What:** ISO-week reports with emotion correlation, auto-check duplicates
- **V2 equivalent:** `weekly_report.py`

### 26. Streak Model (Dedicated DB table)
- **Files:** `backend/app/models/streak.py`
- **What:** Dedicated DB table for win/loss streaks (currently computed on-the-fly)
- **V2 equivalent:** Dedicated streak model

### 27. Insights Service (Local Rule-based)
- **Files:** `backend/app/services/insights_service.py`
- **What:** Local pattern detection, recommendations, anomaly detection, win-rate trend projection (complements external AI coach)
- **V2 equivalent:** Insights engine

---

## Priority Scoring

| Feature | Effort | Impact | Current Gap |
|---------|--------|--------|-------------|
| Theme toggle | 1h | High | Settings feels incomplete |
| WebSocket prices | 4h | Medium | No live data |
| Capital dashboard | 3h | High | Missing from analytics |
| APScheduler | 3h | High | No background jobs |
| Psychology dashboard | 4h | High | No psychology tracking |
| Anti-Journal | 6h | Medium | Missed opportunity cost invisible |
| Position scoreboard | 3h | Medium | No trade quality grading |
| Rule compliance | 4h | Medium | Violations exist but no auto-detection |
| Behavioral patterns | 5h | Medium | Only external AI coach |
| Exit efficiency | 2h | Medium | No exit quality scoring |
| Alerts | 4h | Low | No notification system |

---

*Pick one item at a time. Each is an independent vertical slice.*
