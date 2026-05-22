# TradeJournal-v3 Feature Roadmap

Updated after the TradingOS Foundation changes on `main`.

## 1. Current product direction

TradeJournal-v3 has moved beyond a basic trading journal. The recent repo changes add the beginnings of a full trading operating system:

- Operational dashboard with one-call dashboard payloads.
- Risk command center and portfolio heat calculations.
- Live quote cache and manual sync for open positions.
- Trade lifecycle features: timeline, partial exits, emotion logs, execution grades.
- Lifecycle analytics: behavioral analytics, overtrading, revenge-trade detection, early-exit analysis, discipline scoring.
- Playbook intelligence and setup-level performance feedback.
- Performance OS: daily workflow, weekly review, monthly review.
- AI trade review that uses lifecycle, playbook, partial-exit, timeline, and emotion data.

The next roadmap should focus less on adding isolated pages and more on connecting these modules into one daily review loop.

## 2. Roadmap principles

1. Stabilize first. Fix known regressions before adding major UX layers.
2. Make Dashboard the command center. It should answer: What is open, what is risky, what needs review, and what should I improve?
3. Merge duplicate workflows. Journal, SA Notes, Performance OS, Review, AI Coach, and Trade Detail should not feel like separate products.
4. Prefer deterministic analytics first, AI summaries second. AI should explain and coach, not hide calculations.
5. Build for single-user speed. Keep the product self-hosted, fast, and simple before multi-user features.

---

## Phase 0 - Stabilization and documentation cleanup

### Goal
Make the new TradingOS Foundation safe enough for daily use.

### Deliverables

- Fix all P0 and P1 bugs listed in `Bug_Fixes.md`.
- Add backend tests for new routers:
  - `/lifecycle/revenge-trades`
  - `/lifecycle/discipline-score`
  - `/perf-os/monthly/current`
  - `/dashboard/operational`
  - `/market/sync-quotes`
  - partial exits create/list/delete
- Add frontend smoke tests for:
  - Dashboard loading without blank states
  - Trade detail page
  - Performance OS daily workflow
  - Partial exit sheet
- Update canonical docs:
  - `PROJECT_OVERVIEW.md`
  - `FEATURE_ROADMAP.md`
  - `AGENTS.md`
  - `CONTEXT.md`
- Add ADRs for new architectural decisions:
  - Performance OS domain
  - Operational dashboard aggregate endpoint
  - Lifecycle analytics model
  - Partial exits and remaining quantity
  - Live quote cache and market data provider

### Acceptance criteria

- Backend tests pass.
- Frontend typecheck and build pass.
- No newly added page crashes on empty data.
- Docs mention Performance OS, risk dashboard, lifecycle analytics, market context, partial exits, and AI trade review.

---

## Phase 1 - Information architecture overhaul

### Goal
Turn the current flat navigation into a guided trading workflow.

### Deliverables

Replace the flat sidebar with grouped navigation:

```text
Command Center
- Dashboard
- Calendar
- Reports

Trading Desk
- Trades
- Trade Detail
- Import / Broker
- Ideas

Review Loop
- Performance OS
- Journal / SA Notes
- Review Stream
- AI Coach

Edge Lab
- Playbook
- Playbook Intelligence
- Analytics
- Lifecycle Analytics
- Risk
- Market Context

System
- Capital
- Settings
```

Add a Simple Mode toggle:

- Simple Mode shows Dashboard, Trades, Performance OS, Playbook, Capital, Settings.
- Pro Mode shows all advanced analytics and intelligence pages.

### Acceptance criteria

- Sidebar uses grouped sections, not one long list.
- Mobile uses bottom navigation for the five most-used views.
- Each page has one sentence explaining its purpose.
- Advanced intelligence features are discoverable without overwhelming the user.

---

## Phase 2 - Dashboard Command Center 2.0

### Goal
Make Dashboard the daily operating screen.

### Deliverables

- Keep operational dashboard endpoint as the primary data source.
- Add top alert zone:
  - missing stops
  - portfolio heat elevated
  - high deployment
  - revenge/overtrading warning
- Add live positions widget:
  - symbol
  - entry
  - LTP
  - unrealized PnL
  - stop distance
  - remaining quantity
- Add workflow card from Performance OS:
  - current phase
  - checklist progress
  - next action
- Add intelligence cards:
  - best setup
  - worst behavior pattern
  - market regime
  - execution grade trend
- Add customizable widgets using localStorage first:
  - visible / hidden
  - compact / expanded
  - preferred order

### Acceptance criteria

- Dashboard loads from one primary endpoint plus optional background queries.
- No waterfall of blocking requests.
- A trader can see risk, open positions, and required next action in under 5 seconds.

---

## Phase 3 - Calendar and Reports

### Goal
Create a review surface that connects PnL, trades, journal, and behavior by day/week/month.

### Deliverables

### Calendar page

- Monthly PnL calendar.
- Day cell shows:
  - net PnL
  - trade count
  - discipline score
  - journal completion indicator
  - warning dot if overtrading or revenge pattern detected
- Day detail drawer shows:
  - trades
  - journal notes
  - emotions
  - screenshots
  - AI daily summary

### Reports page

- Weekly report.
- Monthly report.
- Setup report.
- Behavior report.
- Export to PDF/HTML/CSV/XLSX.

### Backend

Add optimized endpoints:

```text
GET /api/v1/calendar/month?month=YYYY-MM
GET /api/v1/reports/weekly?week_start=YYYY-MM-DD
GET /api/v1/reports/monthly?month=YYYY-MM
```

### Acceptance criteria

- Calendar does not call many endpoints per day cell.
- Reports are reproducible and exportable.
- Reports use deterministic analytics first, with optional AI narrative.

---

## Phase 4 - Trade Research Grid

### Goal
Make the trade log a research tool, not just a table.

### Deliverables

Add a filter drawer:

- Date range
- Symbol
- Status
- Setup
- Tactic
- Tags
- Emotion
- Execution grade
- Exit reason
- PnL range
- R range
- Has screenshot
- Has journal note
- Has stop movement
- Has partial exit

Add saved views:

- Open Positions
- Losses to Review
- No Stop
- Partial Exits
- Best Setups
- Revenge/FOMO
- This Month
- Unreviewed Trades

Add table configuration:

- column visibility
- column ordering
- compact and comfortable density
- export current filtered set

### Acceptance criteria

- User can save and reload filters.
- Table state survives reload.
- Filtered table export respects current filters.

---

## Phase 5 - Journal, SA Notes, and Performance OS consolidation

### Goal
Unify the daily workflow into one review loop.

### Recommended structure

- Performance OS becomes the main daily workflow page.
- Journal becomes the writing/editor component inside Performance OS.
- SA Notes become a dedicated note type within the same workflow, not a separate mental model.
- Review Stream becomes a task queue fed by trades that need review.

### Deliverables

- Journal templates:
  - Pre-market plan
  - Post-market review
  - Loss review
  - Winning trade review
  - Mistake log
  - Weekly review
- Autosave draft with debounce.
- Rich editor or markdown editor.
- Link journal notes to trades, setups, emotions, and market snapshots.
- Add daily workflow completion score.

### Acceptance criteria

- User can complete the entire trading-day loop from one screen.
- No typing action causes one backend mutation per keystroke.
- Notes can link to trades and setups.

---

## Phase 6 - Analytics and edge intelligence

### Goal
Turn raw data into actionable edge feedback.

### Deliverables

- Correct expectancy formulas everywhere.
- Add period comparison:
  - this week vs previous week
  - this month vs previous month
  - rolling 20-trade window
- Add MAE/MFE and capture efficiency.
- Add setup quality score:
  - performance
  - consistency
  - risk profile adherence
  - sample size confidence
- Add behavioral score history over time.
- Add market regime performance analysis.

### Acceptance criteria

- Every insight card links to the trades behind it.
- AI coach cites deterministic inputs used to generate the insight.
- No chart should be purely decorative.

---

## Phase 7 - Data, broker, and automation

### Goal
Reduce manual work and improve reliability.

### Deliverables

- Dhan webhook ingestion with idempotency keys.
- Broker sync status dashboard.
- Live quote provider abstraction:
  - primary provider
  - fallback provider
  - stale cache state
  - provider error log
- CSV import mapping wizard for custom broker files.
- Scheduled jobs:
  - market data sync
  - nightly backup
  - pre-market reminder
  - EOD review reminder

### Acceptance criteria

- Sync failures are visible, not silent.
- Duplicate webhook events cannot duplicate trades.
- All imports produce a preview before commit.

---

## Phase 8 - Mobile and PWA polish

### Goal
Make trade capture and review easy from phone.

### Deliverables

- Bottom navigation on mobile.
- Offline draft trade logging.
- Sync queue when online.
- Push notifications:
  - pre-market checklist
  - EOD review
  - open positions without stop
  - high portfolio heat
- Mobile-specific quick add trade form.

### Acceptance criteria

- User can log a trade on mobile in under 20 seconds.
- Offline drafts do not lose data.
- Critical risk alerts are visible on mobile.

---

## Recommended next sprint

1. Fix P0/P1 bugs.
2. Update docs to match current code.
3. Group sidebar and add Simple Mode.
4. Add Calendar page skeleton using existing analytics data.
5. Add report-builder skeleton.
6. Add backend tests for lifecycle and Performance OS endpoints.
7. Add debounce/autosave cleanup for Performance OS textareas.

## Not recommended yet

- Multi-user architecture.
- Full Supabase/Firebase migration.
- Complex drag-and-drop dashboard before widget contracts stabilize.
- Large AI-only features before deterministic analytics are correct.
