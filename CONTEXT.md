# Trading Journal v3 — Context

## Glossary

| Term | Definition |
|---|---|
| **Account** | The user's trading account. Holds `initial_balance` and `current_balance`. |
| **Initial Balance** | Starting capital set by user. Does not change unless user edits it. |
| **Current Balance** | Actual available cash. Synced via reconciliation. |
| **Capital Event** | A ledger entry affecting the account. Types: `deposit`, `withdrawal`, `profit`, `fee`, `adjustment`, `trade_deletion`, `pyramid`. |
| **Net Equity** | `initial_balance + deposits - withdrawals + realized_pnl`. Snapshot of total value including locked capital. |
| **Deployed Capital** | `sum(entry_price * qty - fees)` for all open trades. Capital locked in positions. |
| **Available Capital** | `net_equity - deployed_capital`. Cash available for new trades. |
| **Reconciliation** | Process to sync `current_balance` with computed value. Creates `adjustment` event for any delta. |
| **Trade** | A position in a symbol. Status is auto-computed: Open (no exit_price) or Closed (has exit_price). |
| **Open Trade** | Trade with no exit price (`exit_price IS NULL`). Consumes deployed capital. Can be pyramided. Badge: neutral grey. |
| **Closed Trade** | Trade with exit price. Contributes to realized PnL. Badge: green (profit) or red (loss). |
| **Soft Delete** | Setting trade status to `deleted`. Excludes from PnL and deployed capital. If trade was closed, creates `trade_deletion` event to remove realized PnL from account. |
| **Pyramid Event** | Records a share addition to an open position. Captures entry price, quantity, timestamp, fees. Enables broker import reconciliation with manual pyramids. |
| **Tier** | A capital bracket with a minimum balance threshold. Serves two purposes: (1) determines position sizing / risk limits (e.g., Tier 1: ₹0-₹50k → 1 lot), (2) tracks progress toward financial goals. User can edit tier thresholds via TierEditor on Capital page. |
| **R-Multiple** | Risk-adjusted return: `pnl / (abs(entry_price - stop_price) * quantity)`. Computed automatically when a trade is closed. NULL if no stop_price exists. Used by AI Coach for pattern detection and weekly stats. |
| **Setup** | A predefined trading strategy in the Playbook (e.g., "Episodic Pivot", "Pullback"). Has rules, ideal conditions, risk profile, and auto-computed performance stats (`trade_count`, `win_rate`, `avg_r`). Trades reference setups by name (free-text string, not FK). Trade form's setup dropdown fetches from `GET /setups/?is_active=active`. |
| **Tactic** | A free-form entry technique tag on a trade (e.g., "ORB", "PDH"). Distinct from Setup — tactics are still hardcoded in the form, not playbook-linked. |
| **Stop History** | Audit trail of every stop loss adjustment on a trade. Records timestamp, old stop, new stop, stop type (initial, manual, breakeven, trailing, target). Critical for detecting behavioral mistakes like moving stops. |
| **Milestone** | Auto-tracked capital/profit goals (e.g., "First ₹1L profit", "100th trade", "10-trade win streak"). Computed from trade history, not manually created. |
| **Exit Reason** | Why a trade was closed: `stop_loss`, `target`, `manual`, `trailing`, `system`, `breakeven`. Auto-detected when possible (exit at stop_price → `stop_loss`, exit at target_price → `target`), but user can override. Defaults to `system` or `manual` when auto-detection is not possible. |
| **Breakeven Threshold** | User-configurable PnL amount (e.g., ±₹500). Trades with PnL within this range are classified as `breakeven` rather than profit or loss. Affects win rate, analytics, and exit reason. |
| **Discipline Rating** | A 1-5 self-assessment in daily journal post-market step. Separate from mood rating — measures how well the trader followed their rules. Stored in `DailyJournal.discipline_rating`. |
| **Coach Personality** | A blend of 5 mentor profiles (Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde) each weighted 0-100%. Configurable via sliders in Settings page. Persisted to `ai_config.json`. |
| **Max Risk** | Maximum loss if stop is hit: `(entry_price - stop_price) * quantity`. Displayed in trades table column. Shows "—" if no stop set. |
| **P&L %** | Return on trade capital: `pnl / (entry_price * quantity) * 100`. Displayed in trades table. |
| **Cap %** | PnL as percentage of current net equity: `pnl / net_equity * 100`. Displayed in trades table. |
| **SL Inline Edit** | Click the SL cell in the trades table to open a compact inline form with price input + type dropdown (Manual/Trailing/Breakeven). Saves to both `trade.stop_price` and `stop_history` table. |
| **Playbook Stats Sync** | `_update_setup_stats(db, setup_name)` in `trades.py` recomputes `trade_count`, `win_rate`, `avg_r` for a playbook entry after every trade create/update/delete/pyramid. Called for both old and new setup on update. |

## Capital Flow

1. User sets **Initial Balance**.
2. User adds **Deposits** / **Withdrawals** via Capital Events.
3. User creates **Trades** -> Capital deployed.
4. User exits **Trades** -> PnL realized.
5. **Reconciliation** runs on trade mutations -> Updates `current_balance` via adjustment events.

## Trade Lifecycle

1. **Create** — User enters symbol, entry price, quantity, optional stop/target, setup (from playbook dropdown). Auto-merges with existing trades for same `(symbol, date)`.
2. **Open** — Trade has no `exit_price`. `pnl IS NULL`. Consumes deployed capital. Can be pyramided.
3. **Close** — User adds `exit_price`. PnL computed: `(exit - entry) * qty - fees`. Status auto-set to `closed`. Exit reason auto-detected. Realized PnL added to account.
4. **Delete** — Soft delete: `status = "deleted"`. Excluded from all PnL and deployed capital calculations. If trade was closed, a `trade_deletion` capital event records the removed PnL for audit trail.
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

## Frontend Freshness

- Major views are lazy-loaded in `App.tsx` with `React.lazy`/`Suspense` to keep the initial JS bundle small.
- React Query refetches on mount, window focus, and reconnect.
- Trade-impacting mutations call `invalidateTradeDomain()` to refresh trades, trade detail, capital dashboard/events, analytics, journal weekly stats, and setup playbook stats.
- Capital-event mutations call `invalidateCapitalDomain()` to refresh capital, trade, and analytics data.

## AI Coach Architecture

- **Config**: `backend/app/core/ai_config.py` — `AI_PROVIDERS` dict with 8 providers
- **Client**: `backend/app/core/ai_provider_client.py` — `FORMAT_OLLAMA` vs `FORMAT_OPENAI` routing
- **Router**: `backend/app/routers/daily_journal.py` — 8 coach endpoints
- **Frontend**: `AICoachPage.tsx` — 6 tabs, sidebar nav, provider selector
- **Persistence**: `backend/app/core/ai_config.json`

## AI Coach Personality

The AI Coach acts as a personalized trading mentor. It reviews trades, trade notes, journal entries, and behavioral patterns ("bleeds") to provide structured feedback and improvement plans. Its personality blends traits of renowned traders: Mark Minervini, Manas Arora, Chartitude, QuallaMagie, Pradeep Bonde, and others. The coach is persistent — it remembers past reviews and builds on them over time. The personality blend is **customizable** — users can adjust the weighting of each mentor's influence to match their preferred coaching style.

## Single-User Design

This journal is built for **personal use only** — a single user. Auth exists for session management (login/logout, token expiry) but not for multi-user isolation. No `user_id` scoping on domain models. If multi-user is needed in the future, it would be a separate product built from scratch.

## Daily Journal

Daily journal entries are **hybrid** — structured prompts (pre-market plan, post-market reflection, emotional state, lessons learned) combined with optional free-form notes. The AI Coach uses these entries for weekly reviews and pattern detection.

## Timezone Policy

All trade datetimes are stored in **UTC** in the database. The merge-by-date check converts to **IST (UTC+5:30)** before comparing dates, ensuring `(symbol, date)` means "same trading day in IST". Daily analytics, journal entries, and broker imports all use IST dates. Frontend displays times in IST.
