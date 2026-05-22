# Trading Journal v3 — Context

## Glossary

| Term | Definition |
|---|---|
| **Account** | The user's trading account. Holds `initial_balance` and `current_balance`. |
| **Initial Balance** | Starting capital set by user. Does not change unless user edits it. |
| **Current Balance** | Actual available cash. Synced via reconciliation. |
| **Capital Event** | A ledger entry affecting the account. Types: `deposit`, `withdrawal`, `profit`, `fee`, `adjustment`, `trade_deletion`, `pyramid`. |
| **Net Equity (Realized)** | `initial_balance + SUM(all capital events) + SUM(closed trade PnL) + SUM(partial exit realized PnL from open trades)`. Snapshot of total value from closed positions and capital flows. |
| **Total Equity (Unrealized)** | `net_equity + unrealized_pnl`. Includes mark-to-market of open positions using live NSE prices via `LiveQuote` table. |
| **Unrealized PnL** | `SUM((ltp - entry_price) * remaining_qty - proportional_fees)` for all open positions with live quotes. |
| **Equity Curve** | Daily running total of realized equity: starting from `initial_balance`, adding capital events (deposits/withdrawals), closed trade PnL, and partial exit PnL per day. |
| **Deployed Capital** | `sum(entry_price * remaining_qty)` for all open trades. Capital locked in positions. |
| **Available Capital** | `net_equity - deployed_capital`. Cash available for new trades. |
| **Reconciliation** | Process to sync `current_balance` with computed value. Creates `adjustment` event for any delta. |
| **Trade** | A position in a symbol. Status is auto-computed: Open (no exit_price) or Closed (has exit_price). |
| **Open Trade** | Trade with no exit price (`exit_price IS NULL`). Consumes deployed capital. Can be pyramided. Badge: neutral grey. |
| **Closed Trade** | Trade with exit price. Contributes to realized PnL. Badge: green (profit) or red (loss). |
| **Soft Delete** | Setting trade status to `deleted`. Excludes from PnL and deployed capital. If trade was closed, creates `trade_deletion` event to remove realized PnL from account. |
| **Pyramid Event** | Records a share addition to an open position. Captures entry price, quantity, timestamp, fees. Enables broker import reconciliation with manual pyramids. |
| **Partial Exit** | Records a partial close of an open position. Captures qty, exit_price, realized PnL, exit_time. Full remaining-quantity exits are rejected here; use the main trade close flow for full exits. Enables tracking of scaled exits. |
| **Execution Grade** | A–F letter grades for entry quality, sizing, stop management, patience, rule adherence, exit quality, and overall. Stored per trade. |
| **Tier** | A capital bracket with a minimum balance threshold. Serves two purposes: (1) determines position sizing / risk limits, (2) tracks progress toward financial goals. User can edit tier thresholds via TierEditor on Capital page. |
| **R-Multiple** | Risk-adjusted return: `pnl / (abs(entry_price - stop_price) * quantity)`. Computed automatically when a trade is closed. NULL if no stop_price exists. |
| **Setup** | A predefined trading strategy in the Playbook (e.g., "Episodic Pivot", "Pullback"). Has rules, ideal conditions, risk profile, and auto-computed performance stats (`trade_count`, `win_rate`, `avg_r`). Trades reference setups by name (free-text string, not FK). Setup stored as `is_active` VARCHAR ("active"/"archived"), not boolean. |
| **Tactic** | A free-form entry technique tag on a trade (e.g., "ORB", "PDH"). Distinct from Setup. |
| **Stop History** | Audit trail of every stop loss adjustment on a trade. Records timestamp, old stop, new stop, stop type (initial, manual, breakeven, trailing, target). |
| **Milestone** | Auto-tracked capital/profit goals. |
| **Exit Reason** | Why a trade was closed: `stop_loss`, `target`, `manual`, `trailing`, `system`, `breakeven`. Auto-detected when possible (exit at stop_price → `stop_loss`, exit at target_price → `target`), but user can override. |
| **Breakeven Threshold** | Configurable ±₹ amount on Account model. Trades with PnL within this range are classified as `breakeven`. |
| **Discipline Rating** | A 1-5 self-assessment in daily journal post-market step. Separate from mood. |
| **Coach Personality** | A blend of 5 mentor profiles (Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde) each weighted 0-100%. |
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
| **Nsetools** | Python library for fetching live NSE data. Used by the market data service for quote sync. |
| **Navigation Mode** | Simple/Advanced sidebar preference. Simple mode hides lower-frequency views, while `activeView` still supports all registered app views. |

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

### Operational Dashboard (realized only)
```
net_equity = initial_balance + SUM(all capital_events) + SUM(closed_trade_pnl) + SUM(partial_exit_realized_pnl)
```
Note: uses ALL capital event types (deposit, withdrawal, adjustment, trade_deletion, pyramid, profit, fee).

### Capital Dashboard (deposits/withdrawals only for curve)
```
net_equity = initial_balance + (deposits - withdrawals) + realized_pnl
```
Note: equity curve only includes deposit/withdrawal events, not adjustments (which are reconciliation artifacts).

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

The AI Coach acts as a personalized trading mentor. Its personality blends traits of renowned traders: Mark Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde. Customizable via 0-100% sliders in Settings page.

## Single-User Design

This journal is built for **personal use only** — a single user. Auth exists for session management (login/logout, token expiry) but not for multi-user isolation. No `user_id` scoping on domain models. Trades table has no `account_id` column — all users share the same trade pool.

## Timezone Policy

All trade datetimes are stored in **UTC** in the database. The merge-by-date check converts to **IST (UTC+5:30)** before comparing dates, ensuring `(symbol, date)` means "same trading day in IST". Daily analytics, journal entries, and broker imports all use IST dates. Frontend displays times in IST.
