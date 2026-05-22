# TradeJournal-v3 UI/UX Overhaul Plan

Based on the uploaded overhaul report and the current TradingOS Foundation repo state.

## 1. Current UI/UX state after repo changes

The app has moved in a good direction:

- Dashboard now has operational aggregates, live positions, risk command center, critical alerts, and collapsible intelligence sections.
- Trades now includes live quote columns, partial exits, remaining quantity, realized/unrealized split, sync button, and detail-page navigation.
- Trade Detail is now a full page with hero PnL, stat grid, chart gallery, AI review, and lifecycle panel.
- Performance OS introduces a daily workflow with phases: pre-market, execution, review, behavior.
- Backend now supports lifecycle analytics, emotion logs, execution grades, partial exits, market context, risk dashboard, playbook intelligence, and operational dashboard aggregates.

The product is becoming a true trading operating system. The UX gap is now mainly structure and coherence.

## 2. Target product experience

The app should answer four questions every day:

1. What is happening right now?
2. What is my risk?
3. What needs review?
4. What pattern should I improve next?

Everything should connect back to this loop:

```text
Pre-market plan -> Trade execution -> Position/risk monitoring -> Trade review -> Behavior insight -> Playbook refinement -> Weekly/monthly report
```

## 3. Information architecture overhaul

### Current issue
The sidebar is a flat list. With the new pages added, it can feel like a collection of modules rather than one operating flow.

### Proposed navigation

```text
Command Center
- Dashboard
- Calendar
- Reports

Trading Desk
- Trades
- Import / Broker
- Ideas

Review Loop
- Performance OS
- Journal / SA Notes
- Review Queue
- AI Coach

Edge Lab
- Playbook
- Analytics
- Lifecycle
- Risk
- Market Context

System
- Capital
- Settings
```

### Simple Mode

Simple Mode should show only:

- Dashboard
- Trades
- Performance OS
- Playbook
- Capital
- Settings

Pro Mode unlocks:

- Analytics
- Lifecycle
- Risk
- Market Context
- Reports
- AI Coach advanced tabs

## 4. Dashboard overhaul

### Dashboard hierarchy

1. Header: date, market state, sync status, last updated.
2. Critical alerts: missing stops, portfolio heat, high deployment, failed quote sync.
3. KPI cards: PnL, win rate, profit factor, Avg R, expectancy, max drawdown.
4. Live positions: open trades, LTP, unrealized PnL, stop distance, remaining quantity.
5. Risk command center: portfolio heat, exposure, warnings.
6. Daily workflow: current Performance OS phase and next action.
7. Intelligence cards: lifecycle, behavior, playbook, market context.
8. Collapsible deep sections.

### Widget improvements

- Add widget registry.
- Store widget visibility/order in localStorage.
- Later support drag-and-drop.
- Add compact and full dashboard modes.

## 5. Calendar page

The uploaded report recommends calendar heatmaps because they reveal streaks, behavior triggers, and consistency patterns.

### Calendar cell data

Each day should show:

- Net PnL
- Trade count
- Win/loss marker
- Journal completed marker
- Discipline rating marker
- Overtrading/revenge warning dot

### Day drawer

Click a date to open:

- Trades for that day
- Daily workflow phase status
- Journal notes
- Emotion logs
- Execution grades
- Chart screenshots
- AI summary
- Lessons learned

### Backend endpoint

```text
GET /api/v1/calendar/month?month=YYYY-MM
```

Return one optimized payload, not many per-day calls.

## 6. Trades page overhaul

### Current wins

- Live quote sync exists.
- Partial exits exist.
- Remaining quantity exists.
- Realized/unrealized split exists.
- Trade detail page exists.

### Next UX layer

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
- R range
- PnL range
- Has image
- Has review
- Has partial exit
- Has moved stop

Add saved views:

- Open positions
- Losses to review
- No stop
- Partial exits
- Revenge/FOMO
- Best setups
- This month
- Unreviewed

Add column controls:

- Show/hide columns
- Reorder columns
- Compact density
- Export current view

## 7. Trade detail overhaul

Trade detail should become the single research page for one trade.

### Recommended sections

1. Hero result card: PnL, R, verdict, status.
2. Execution timeline: open, stop changes, partial exits, close, review.
3. Chart gallery and annotations.
4. Risk and sizing breakdown.
5. Emotion and execution grade panel.
6. Playbook rule checklist.
7. AI review summary.
8. Similar trades: same setup, same emotion, same market regime.
9. Actions: edit, review, duplicate idea, export trade review.

## 8. Performance OS and Journal consolidation

### Problem
Journal, SA Notes, Performance OS, Review Stream, and AI Coach all partially overlap.

### Proposed ownership

- Performance OS: the main daily workflow shell.
- Journal: rich text and structured fields inside Performance OS.
- SA Notes: a note type within Performance OS.
- Review Stream: task queue for trades requiring review.
- AI Coach: deep analysis, summary generation, and rule feedback.

### UX rules

- Pre-market writing happens in Performance OS.
- Intraday notes happen in Performance OS.
- Trade-specific review happens in Trade Detail.
- Weekly/monthly reflection happens in Performance OS Reports.
- AI Coach summarizes but does not replace the user's notes.

## 9. Reports overhaul

Add a Reports page with:

- Weekly report
- Monthly report
- Setup report
- Behavior report
- Risk report
- Export builder

Each report should have:

- Summary cards
- Charts
- Trade evidence links
- Lessons learned
- AI narrative optional
- HTML/PDF export

## 10. Visual design system

### Keep

- Dark Discipline theme.
- Warm light theme.
- CSS variable based theming.
- Newsreader, Inter, JetBrains Mono.
- Rounded cards and calm visual language.

### Add

- Purple Pro theme preset inspired by the uploaded concept image.
- Heatmap semantic colors instead of inline rgba classes.
- Standard data card variants:
  - metric
  - warning
  - insight
  - action
  - report
- Standard page shell:
  - `PageHeader`
  - `PageActions`
  - `FilterDrawer`
  - `DataState`
  - `InsightCard`

## 11. Accessibility and mobile

- Add keyboard shortcuts overlay.
- Ensure focus rings are visible.
- Add bottom nav on mobile.
- Ensure all icon buttons have accessible labels.
- Add high-contrast theme option.
- Support reduced-motion mode for charts and transitions.

## 12. Implementation sequence

1. Fix P0/P1 bugs.
2. Update docs and ADRs.
3. Group sidebar and add Simple Mode.
4. Extract dashboard widgets into components.
5. Add Calendar page skeleton.
6. Add Trade filter drawer and saved views.
7. Consolidate Journal and Performance OS.
8. Add Reports page and export builder.
9. Add widget registry and customizable dashboard.
10. Add rich editor and tag taxonomy.

## 13. Acceptance criteria for overhaul

The overhaul is successful when:

- A user can complete the entire trading-day workflow from Performance OS and Dashboard.
- Dashboard clearly shows risk, open positions, and next actions.
- Trade research can be done from saved views without exporting to Excel.
- Calendar reveals daily consistency and behavior patterns.
- Reports produce weekly/monthly reviews without manual copying.
- New users are not overwhelmed by advanced analytics.
