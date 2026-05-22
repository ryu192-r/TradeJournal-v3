# TradeJournal-v3 Bug Fix Backlog

Updated after the latest repository recheck.

Severity legend:

- P0: crashes, data corruption, or endpoint unusable.
- P1: wrong analytics, misleading financial data, broken UX path.
- P2: performance, maintainability, or confusing behavior.
- P3: polish and cleanup.

---

## P0 - Must fix before next feature work

### BUG-001: `/lifecycle/revenge-trades` uses variables before initialization

**Area:** Backend lifecycle analytics  
**File:** `backend/app/routers/lifecycle_analytics.py`  
**Issue:** `revenge_trades_list`, `flagged_pnls`, and `unflagged_pnls` are referenced but not initialized in the visible function body. This will raise `NameError` when the endpoint flags a trade or returns averages.

**Fix:**

```python
revenge_trades_list = []
flagged_pnls = []
unflagged_pnls = []
```

Then append to `flagged_pnls` and `unflagged_pnls` inside the loop.

**Acceptance criteria:**

- Empty trades returns empty payload.
- One non-flagged trade returns `total_flagged = 0`.
- One loss followed by another trade inside the window returns one flagged trade.
- Endpoint does not 500.

---

### BUG-002: Monthly review only covers days 1-28

**Area:** Backend Performance OS  
**File:** `backend/app/routers/performance_os.py`  
**Issue:** `_enrich_monthly()` sets `month_end = date(year, mon, 28)`, which excludes trades from days 29, 30, and 31.

**Fix:**

```python
import calendar
last_day = calendar.monthrange(year, mon)[1]
month_end = date(year, mon, last_day)
```

**Acceptance criteria:**

- Trades on the 29th, 30th, and 31st are included in monthly review.
- February leap years are handled.
- Monthly report tests cover months with 28, 29, 30, and 31 days.

---

### BUG-003: `get_workflow_by_date` maps `mood_rating` to `discipline_rating`

**Area:** Backend Performance OS  
**File:** `backend/app/routers/performance_os.py`  
**Issue:** The dated workflow endpoint returns `"mood_rating": journal.discipline_rating`, while the today endpoint returns both mood and discipline fields correctly.

**Fix:**

Return a consistent journal object for today and by-date endpoints:

```python
journal={
  "id": journal.id,
  "mood_rating": journal.mood_rating,
  "discipline_rating": journal.discipline_rating,
  "rules_followed": journal.rules_followed,
  "rules_violated": journal.rules_violated,
}
```

**Acceptance criteria:**

- `/perf-os/workflow/today` and `/perf-os/workflow/{date}` return the same journal shape.
- Mood and discipline values are not swapped.

---

## P1 - Misleading analytics or workflow defects

### BUG-004: Operational dashboard expectancy formula is wrong

**Area:** Backend dashboard analytics  
**File:** `backend/app/routers/operational_dashboard.py`  
**Issue:** The operational dashboard computes expectancy as `avg_win - avg_loss`. True expectancy is weighted by win rate and loss rate.

**Correct formula:**

```python
expectancy = (win_rate_decimal * avg_win) - (loss_rate_decimal * avg_loss)
```

or, since PnL values already include negative losses:

```python
expectancy = net_pnl / total_trades
```

**Acceptance criteria:**

- Dashboard expectancy matches `/analytics/kpi` for same dataset.
- Tests include mixed wins/losses, all wins, all losses, and no trades.

---

### BUG-005: Market insight text uses regime name where avg PnL should appear

**Area:** Backend market context  
**File:** `backend/app/routers/market_context.py`  
**Issue:** The best-regime insight says `avg INR {best_regime[0]} PnL`, where `best_regime[0]` is the regime label, not the avg PnL.

**Fix:**

Use:

```python
best_regime[1].get("avg_pnl")
```

**Acceptance criteria:**

- Insight reads: `You trade best in bullish markets (avg INR 1234.56 PnL, 55.0% win rate).`

---

### BUG-006: Chart image delete path uses `lstrip` incorrectly

**Area:** Backend trade image handling  
**File:** `backend/app/routers/trades.py`  
**Issue:** `url.lstrip("/uploads/")` does not remove a prefix; it strips any matching characters from the left. This can produce wrong file paths.

**Fix:**

Use a safe prefix removal:

```python
prefix = "/uploads/"
if not url.startswith(prefix):
    raise HTTPException(status_code=400, detail="Invalid upload URL")
rel_path = url[len(prefix):]
filepath = os.path.join(settings.UPLOAD_DIR, rel_path)
```

Also validate that the resolved path stays inside `UPLOAD_DIR`.

**Acceptance criteria:**

- Deleting an uploaded image removes the correct file.
- Path traversal attempts are rejected.
- URLs that do not start with `/uploads/` are rejected.

---

### BUG-007: Full remaining partial exit should close or explicitly reject

**Area:** Backend partial exits / trade lifecycle  
**File:** `backend/app/routers/partial_exit.py`  
**Issue:** `create_partial_exit()` allows `payload.qty == remaining`, but leaves the trade open. That creates an open trade with zero remaining quantity.

**Fix options:**

Option A: reject full remaining exits in partial-exit endpoint:

```python
if payload.qty >= remaining:
    raise HTTPException(400, "Use full close for remaining quantity")
```

Option B: automatically close the trade:

- set `trade.exit_price`
- set `trade.exit_time`
- compute final `trade.pnl`
- set `status = closed`
- add `trade_closed` timeline event

**Acceptance criteria:**

- No open trade can have `remaining_qty <= 0`.
- Risk dashboard excludes fully exited positions.
- Trade detail clearly separates partial realized PnL from final realized PnL.

---

### BUG-008: Soft delete records timeline event as `trade_closed`

**Area:** Backend trade lifecycle  
**File:** `backend/app/routers/trades.py`  
**Issue:** Soft delete adds a timeline event with `event_type="trade_closed"` and `note="Trade deleted"`. This makes audit history ambiguous.

**Fix:**

- Add `trade_deleted` to `VALID_EVENT_TYPES` in `backend/app/models/trade_timeline.py`.
- Use `event_type="trade_deleted"` on soft delete.

**Acceptance criteria:**

- Timeline distinguishes normal close from deletion.
- Trade detail history remains accurate.

---

### BUG-009: Trade update timeline old stop/target values are captured after mutation

**Area:** Backend trade update  
**File:** `backend/app/routers/trades.py`  
**Issue:** `update_trade()` sets fields first, then creates stop/target timeline entries. This means `old_stop` and `old_target` may record the new value instead of the previous value.

**Fix:**

Capture previous values before mutating fields:

```python
old_stop = db_trade.stop_price
old_target = db_trade.target_price
```

**Acceptance criteria:**

- Timeline displays true old and new stop/target values.
- Tests cover stop and target updates.

---

## P2 - Performance, UX, and maintainability bugs

### BUG-010: Performance OS textareas mutate backend on every keystroke

**Area:** Frontend Performance OS  
**File:** `frontend/src/pages/PerformanceOSPage.tsx`  
**Issue:** `onChange` calls `updateMut.mutate(...)` directly for notes fields. This can flood the backend and create race conditions.

**Fix:**

- Keep local textarea state.
- Debounce save by 800-1200 ms.
- Show `Saving...` / `Saved` indicator.
- Save immediately on blur.

**Acceptance criteria:**

- Typing a 200-character note does not trigger 200 HTTP requests.
- Latest text wins if saves return out of order.

---

### BUG-011: `PartialExit.created_at` is an Integer, not DateTime

**Area:** Backend model quality  
**File:** `backend/app/models/partial_exit.py`  
**Issue:** `created_at = Column(Integer)` has no default and does not match the rest of the schema style.

**Fix:**

```python
created_at = Column(DateTime, server_default=func.now())
```

Add Alembic migration.

**Acceptance criteria:**

- New partial exits have creation timestamps.
- Existing rows migrate safely.

---

### BUG-012: Current docs are stale after TradingOS changes

**Area:** Documentation  
**Files:** `PROJECT_OVERVIEW.md`, `FEATURE_ROADMAP.md`, `AGENTS.md`, `CONTEXT.md`  
**Issue:** Current docs do not fully describe the new Performance OS, operational dashboard, risk dashboard, lifecycle analytics, market context, partial exits, and trade review engine.

**Fix:**

- Update project overview.
- Update feature roadmap.
- Add new domain glossary entries.
- Add endpoint map for new routers.
- Add testing commands for new modules.

**Acceptance criteria:**

- New contributor can understand the new architecture from docs alone.
- Roadmap does not list completed work as planned.

---

### BUG-013: Risk and capital formulas are duplicated across modules

**Area:** Backend architecture  
**Files:** `risk_dashboard.py`, `operational_dashboard.py`, `capital_dashboard.py`, `trades.py`, `partial_exit.py`  
**Issue:** Remaining quantity, deployed capital, net equity, open risk, and partial realized PnL are computed in multiple places. This increases drift risk.

**Fix:**

Create shared services:

```text
backend/app/services/position_service.py
backend/app/services/risk_service.py
backend/app/services/capital_snapshot_service.py
```

**Acceptance criteria:**

- Dashboard, risk page, trade list, and capital page use the same formulas.
- Tests validate shared calculations once.

---

### BUG-014: Live quote provider needs stale/fallback handling

**Area:** Market data  
**Files:** `market_data_service.py`, `market_context.py`, frontend live quote hooks  
**Issue:** Live quotes rely on a single provider path. If quotes fail, UI shows missing LTP without strong stale/error state.

**Fix:**

- Add provider status in `/market/sync-quotes` response.
- Add `stale_after_seconds` policy.
- Surface stale quotes in Dashboard and Trades.
- Add fallback/manual import path.

**Acceptance criteria:**

- UI can show Fresh, Stale, Failed, or Not Synced.
- Sync failures are visible.

---

## P3 - UI polish and cleanup

### BUG-015: Sidebar is again a long flat list

**Area:** Frontend information architecture  
**File:** `frontend/src/components/layout/Sidebar.tsx`  
**Issue:** The sidebar now contains many high-level views in one flat list. This conflicts with the planned decluttered/grouped navigation.

**Fix:**

- Introduce grouped nav sections.
- Add Simple Mode.
- Add mobile bottom nav.

**Acceptance criteria:**

- Navigation fits in one mental model.
- Advanced pages do not crowd daily workflow pages.

---

### BUG-016: Old Journal, SA Notes, Performance OS, Review, and AI Coach overlap

**Area:** Product structure  
**Files:** `JournalPage.tsx`, `DailySANotesPage.tsx`, `PerformanceOSPage.tsx`, AI Coach, Review Stream  
**Issue:** There are multiple places to write reflections and reviews. This can confuse daily workflow.

**Fix:**

Define ownership:

- Performance OS: daily workflow shell.
- Journal: structured/rich editor inside Performance OS.
- Review Stream: queue of trades needing review.
- AI Coach: deep review and summaries.
- SA Notes: note type or section, not separate core flow.

**Acceptance criteria:**

- User knows where to write pre-market, post-market, and trade review notes.
- No duplicate daily note fields compete.

---

## Regression test checklist

- Create trade -> appears in Dashboard, Trades, Risk, Analytics, Playbook stats.
- Pyramid trade -> remaining quantity, deployed capital, risk update correctly.
- Partial exit -> remaining quantity, partial realized PnL, risk update correctly.
- Full close after partial exit -> total realized PnL is correct.
- Soft delete -> dashboard, risk, capital, playbook stats exclude the trade.
- Add emotion -> lifecycle emotion summary updates.
- Add execution grade -> discipline score updates.
- Add stop -> risk warning disappears.
- Upload/delete chart image -> file and DB both update.
- Market quote sync failure -> user sees failure/stale state.
- Monthly report includes trades from every day of month.
