# Trading Journal v3 — Context

## Glossary

| Term | Definition |
|---|---|
| **Account** | The user's trading account. Holds `initial_balance` and `current_balance`. |
| **Initial Balance** | Starting capital set by user. Does not change unless user edits it. |
| **Current Balance** | Actual available cash. Synced via reconciliation. |
| **Capital Event** | A ledger entry affecting the account. Types: `deposit`, `withdrawal`, `profit`, `fee`, `adjustment`, `trade_deletion`, `pyramid`. |
| **Net Equity (Realized)** | `initial_balance + SUM(capital events EXCEPT 'adjustment') + SUM(closed trade PnL) + SUM(partial exit realized PnL from open trades)`. Snapshot of total value from closed positions and capital flows. **Excludes `adjustment` events** — they are reconciliation artifacts that already encode realized PnL, so summing them on top of realized PnL would double-count. (One canonical formula; there is no separate "all events" view — `risk_dashboard`'s former `all events + realized` computation double-counted and was a bug.) |
| **Total Equity (Unrealized)** | `net_equity + unrealized_pnl`. Includes mark-to-market of open positions using live NSE prices via `LiveQuote` table. |
| **Unrealized PnL** | `SUM((ltp - entry_price) * remaining_qty - proportional_fees)` for all open positions with live quotes. |
| **Equity Curve** | Daily running total of realized equity: starting from `initial_balance`, adding capital events (deposits/withdrawals), closed trade PnL, and partial exit PnL per day. |
| **Deployed Capital** | `sum(entry_price * remaining_qty)` for all open trades. Capital locked in positions. |
| **Available Capital** | `net_equity - deployed_capital`. Cash available for new trades. |
| **Account Equity** *(module)* | The single deep module that computes an account's money snapshot. Interface: `equity_snapshot(db, user_id) -> EquitySnapshot`. Built on the realized-PnL seam (`utils/pnl_helpers`) and `LiveQuote`. Every consumer (reconcile, operational/capital/risk dashboards, actions inbox) reads it instead of recomputing. Backend: `backend/app/services/account_equity.py`. |
| **Equity Snapshot** | The value `Account Equity` returns: `initial_balance`, `capital_flow` (sum of non-`adjustment` events), `realized_pnl`, `net_equity`, `deployed_capital`, `available_capital`, `unrealized_pnl`, `total_equity`. One computation, many readers. |
| **Reconciliation** | Process to sync `current_balance` with computed value. Creates `adjustment` event for any delta. |
| **Trade** | A position in a symbol. Status is auto-computed: Open (no exit_price) or Closed (has exit_price). |
| **Open Trade** | Trade with no exit price (`exit_price IS NULL`). Consumes deployed capital. Can be pyramided. Badge: neutral grey. |
| **Closed Trade** | Trade with exit price. Contributes to realized PnL. Badge: green (profit) or red (loss). |
| **Soft Delete** | Setting trade status to `deleted`. Excludes from PnL and deployed capital. If trade was closed, creates `trade_deletion` event to remove realized PnL from account. |
| **Pyramid Event** | Records a share addition to an open position. Captures entry price, quantity, timestamp, fees. Enables broker import reconciliation with manual pyramids. |
| **Partial Exit** | Records a partial close of an open position. Captures qty, exit_price, realized PnL, exit_time. Full remaining-quantity exits are rejected here; use the main trade close flow for full exits. Enables tracking of scaled exits. |
| **Execution Grade** | A–F letter grades for entry quality, sizing, stop management, patience, rule adherence, exit quality, and overall. Stored per trade. |
| **Tier** | A capital bracket with a minimum balance threshold. Serves two purposes: (1) determines position sizing / risk limits, (2) tracks progress toward financial goals. User can edit tier thresholds via TierEditor on Capital page. |
| **Risk per Unit** | `entry_price - stop_price` (for LONG). Per-share risk amount. Used as denominator for R-multiple. |
| **Risk Amount** | `risk_per_unit * quantity`. Total planned risk on the trade. |
| **Planned Reward** | `(target_price - entry_price) * quantity`. Total planned reward if target is hit. |
| **Risk:Reward Ratio** | **Planned** metric: `reward_per_unit / risk_per_unit`. Requires both stop and target. |
| **Gross P&L** | `(exit_price - entry_price) * quantity`. Before fees. |
| **Net P&L** | `gross_pnl - fees`. The actual monetary result. |
| **R-Multiple** | **Actual** metric: `net_pnl / risk_amount`. How many times the planned risk was made or lost. Auto-computed when both exit and stop exist. NULL if no stop_price. NOT a user-editable field. |
| **Capture Ratio** | `actual_r / max_r`. How much of the planned reward was captured. Used in early exit analysis. |
| **Setup** | A predefined trading strategy in the Playbook (e.g., "Episodic Pivot", "Pullback"). Has rules, ideal conditions, risk profile, and auto-computed performance stats (`trade_count`, `win_rate`, `avg_r`). Trades reference setups by name (free-text string, not FK). Setup stored as `is_active` VARCHAR ("active"/"archived"), not boolean. |
| **Tactic** | A free-form entry technique tag on a trade (e.g., "ORB", "PDH"). Distinct from Setup. |
| **Stop History** | Audit trail of every stop loss adjustment on a trade. Records timestamp, old stop, new stop, stop type (initial, manual, breakeven, trailing, target). |
| **Milestone** | Auto-tracked capital/profit goals. |
| **Exit Reason** | Why a trade was closed: `stop_loss`, `target`, `manual`, `trailing`, `system`, `breakeven`. Auto-detected when possible (exit at stop_price → `stop_loss`, exit at target_price → `target`), but user can override. |
| **Breakeven Threshold** | Configurable ±₹ amount on Account model. Trades with PnL within this range are classified as `breakeven`. |
| **Discipline Rating** *(deprecated)* | Legacy 1-5 self-assessment from the old daily journal post-market step. No longer written or read by the V3 journal (which uses `bias_notes`). The `DailyJournal.discipline_rating` column remains pending a deferred destructive migration. |
| **Coach Personality** *(removed)* | The former blend of 5 mentor profiles was removed in the V3 migration (Phase 1). No mentor weighting; `GET /ai/mentors` is gone. |
| **Live Quote** | Cached NSE stock price. Updated via `POST /market/sync-quotes`. Used for unrealized PnL computation and live position dashboard. |
| **Quote Freshness** | Per-quote status exposed as `fresh`, `stale`, `failed`, or `not_synced` so UI surfaces provider failure or old data instead of treating every cached quote as live. |
| **Risk Command Center** | Dashboard section showing portfolio heat, deployed capital, open risk, positions without stops, and risk warnings. |
| **Operational Dashboard** | Single-call endpoint (`GET /dashboard/operational`) returning KPIs, open trades with live quotes, risk summary, capital summary, streaks, and equity curve. |
| **Intelligence Dashboard** | Single-call endpoint (`GET /dashboard/intelligence`) returning lifecycle, behavioral, playbook, and market highlights. |
| **Max Risk** | Maximum loss if stop is hit: `(entry_price - stop_price) * remaining_qty`. Displayed in trades table. |
| **P&L %** | Return on trade capital: `pnl / (entry_price * quantity) * 100`. |
| **Cap %** | PnL as percentage of current net equity: `pnl / net_equity * 100`. |
| **SL Inline Edit** | Click the SL cell in trades table to open a compact form with price + type dropdown. Saves to both `trade.stop_price` and `stop_history`. |
| **Playbook Stats Sync** | `_update_setup_stats(db, setup_name)` recomputes `trade_count`, `win_rate`, `avg_r` after every trade create/update/delete/pyramid. |
| **Navigation** *(simple/pro removed)* | Single sidebar config in 5 groups (Today / Insight / Money / AI / System). The old simple/advanced `NavMode` toggle was removed in Phase 1; `activeView` supports all registered V3 views. |
| **Cockpit** | The V3 command center (the `dashboard` view, `features-v3/cockpit/`). Shows KPIs, equity, live positions, risk, and the deterministic **Edge feed**. |
| **Edge Feed** | Deterministic "what to focus on / avoid / review" signal strip composed from trading data (ADR-024). Lives **inside the Cockpit** (`CockpitEdgeFeed`), not as a standalone page. |
| **new-ui** | The canonical, token-driven design system (`frontend/src/new-ui/`, ADR-023). All slices import primitives from `@/new-ui`; visual tokens come from `new-ui/tokens`. Legacy `Glass*`/`SharedUI`/`StateComponents` are retired. |
| **Calculation Module** | Single-source-of-truth for all trade math. Backend: `backend/app/utils/calculations.py`. Frontend: `frontend/src/utils/calculations.ts`. Both are direction-aware (LONG/SHORT) and handle all edge cases gracefully. |
| **Trade Card View** | Responsive mobile trade list: auto-switches to cards below 768px with manual toggle. Each card shows symbol, status, P&L, R-multiple, entry/exit/qty. |

## Capital Flow

1. User sets **Initial Balance**.
2. User adds **Deposits** / **Withdrawals** via Capital Events.
3. User creates **Trades** → Capital deployed.
4. User exits **Trades** → PnL realized.
5. **Reconciliation** runs on trade mutations → Updates `current_balance` via adjustment events.

## Trade Lifecycle

1. **Create** — User enters symbol, entry price, quantity, optional stop/target, setup (from playbook dropdown). Auto-merges with existing trades for same `(symbol, date)`.
2. **Open** — Trade has no `exit_price`. `pnl IS NULL`. Consumes deployed capital. Can be pyramided or partially exited.
3. **Close** — User adds `exit_price`. PnL computed: `(exit - entry) * qty - fees`. Status auto-set to `closed`. Exit reason auto-detected. Realized PnL added to account.
4. **Delete** — Soft delete: `status = "deleted"`. Excluded from all PnL and deployed capital calculations. If trade was closed, a `trade_deletion` capital event records the removed PnL.
5. **Playbook sync** — Every mutation calls `_update_setup_stats()` to recompute the setup's `trade_count`, `win_rate`, `avg_r`.

## Reconciliation Formula

```
target = initial_balance + deposits - withdrawals + realized_pnl - deployed_capital
delta = target - current_balance
if delta != 0: create adjustment event with amount = delta
```

- Runs automatically after: trade create, update, delete, pyramid, merge, CSV import, broker import
- Manual trigger: `POST /capital-events/accounts/{id}/reconcile`
- Creates audit trail — never silently overwrites `current_balance`

## Net Equity Formulas

### Net Equity (Realized) — canonical, single formula
```
net_equity = initial_balance
           + SUM(capital_event.amount WHERE event_type != 'adjustment')
           + SUM(closed_trade_pnl)
           + SUM(partial_exit_realized_pnl from open trades)
```
- **Include** all user-originated events: `deposit`, `withdrawal`, `profit`, `fee` (amounts are signed; withdrawals/fees stored negative).
- **Exclude** `adjustment` — a reconciliation artifact. `current_balance` is maintained as `initial + SUM(all events)`, so the accumulated `adjustment` events already absorb `realized − deployed`. Adding realized PnL on top of them double-counts.
- `trade_deletion` and `pyramid` event types appear in the schema's valid-set but are **vestigial** — nothing creates them. Soft-deleted trades drop out of realized PnL via `status != 'deleted'`; pyramids live in `PyramidEntry`/`TradeTimeline`.
- Realized PnL must come from the realized-PnL seam (`utils/pnl_helpers.get_realized_pnl_events`), not re-queried per consumer.

### Equity Curve (time-series, separate concern)
The daily equity **curve** is a running total seeded at `initial_balance`, adding only `deposit`/`withdrawal` events plus realized PnL per day. It deliberately omits `adjustment` (artifact) and `profit`/`fee` (rare, undated relative to the curve) so the line tracks external cash flow + trading result. This is a presentation choice for the chart, not a second net-equity definition.

### Total Equity (unrealized)
```
total_equity_unrealized = net_equity + SUM((ltp - entry_price) * remaining_qty - proportional_fees) for open positions
```
Uses live quotes from `LiveQuote` table. Returns 0 for open positions without live quotes.

## Frontend Freshness

- Major views are lazy-loaded in `App.tsx` with `React.lazy`/`Suspense` to keep the initial JS bundle small.
- React Query refetches on mount, window focus, and reconnect (`placeholderData: (prev) => prev` for zero-blank-state refetches).
- Trade-impacting mutations call `invalidateTradeDomain()` to refresh trades, trade detail, capital dashboard/events, analytics, journal weekly stats, and setup playbook stats.
- Capital-event mutations call `invalidateCapitalDomain()` to refresh capital, trade, and analytics data.
- All AI Coach endpoint calls use 120s timeout (vs default 60s for regular API calls) to handle slow LLM responses.

## AI Coach Architecture

- **Config**: `backend/app/core/ai_config.py` — `AI_PROVIDERS` dict with 8 providers
- **Client**: `backend/app/core/ai_provider_client.py` — multi-format routing (OpenAI, Ollama, Anthropic, Google). Configurable timeout (default 60s, max 300s). Retries with exponential backoff.
- **Router**: `backend/app/routers/coach.py` — 9+ endpoints for daily/weekly reviews, insights, patterns, rules, behavioral scores
- **Frontend**: `frontend/src/components/coach/AICoachPage.tsx` — 6 tabs with provider selector
- **Persistence**: `backend/app/core/ai_config.json`
- **Timeout chain**: Frontend axios 120s → nginx proxy 180s → backend AI client 60-300s (configurable)

## AI Coach Personality

The AI Coach acts as a personalized trading mentor. Uses the configured AI provider (Ollama, OpenAI, Anthropic, etc.) for reviews, pattern detection, and coaching.

## Single-User Design

This journal is built for **personal use only** — a single user. Auth exists for session management (login/logout, token expiry) but not for multi-user isolation. No `user_id` scoping on domain models. Trades table has no `account_id` column — all users share the same trade pool.

## Timezone Policy

Trade datetimes are stored as **naive IST wall-clock** datetimes (no timezone suffix). The backend serializes them without `Z` or offset (e.g., `2025-05-20T09:16:00`). Frontend must treat naive backend strings as IST components, not as browser-local or UTC instants.

**IST handling flow:**
- **Input (backend → frontend):** `isoToDatetimeLocal()` in `schemas/tradeForm.ts` and `formatDate()`/`formatDateTime()` in `utils/format.ts` strip any suffix and extract components directly.
- **Output (frontend → backend):** `datetimeLocalToIso()` in `schemas/tradeForm.ts` sends the entered `datetime-local` value with seconds. No timezone conversion.
- **Calendar/session dates:** use `backend/app/utils/trade_dates.py` and `frontend/src/utils/tradeDates.ts`. These helpers parse `YYYY-MM-DD` manually and never rely on browser timezone parsing.

The merge/session-date check compares **Asia/Kolkata trading sessions**, ensuring `(symbol, date)` means "same trading day in IST". Daily analytics, journal entries, and broker imports all use IST dates.
