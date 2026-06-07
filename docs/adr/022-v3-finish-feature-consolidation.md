# ADR-022: V3 finish — feature consolidation and culls

## Status
Accepted

## Date
2026-06-07

## Context

The codebase is mid-migration from V2 (`pages/*` + `components/*`) to V3 (`features-v3/*` + `new-ui/*`). `V3LiveApp` is live, but several backend feature areas still surface only through legacy pages embedded via `tjv3-legacy-embed`. Multiple backend routers also overlap conceptually:

- `edge_command_center`, `recommendations`, `coaching_intelligence` all answer "what should I do now / where is my drift / what to focus on" via deterministic computation.
- `coach` covers conversational LLM coaching, with mentor personality weights (5 mentor profiles).
- `trade_review_v2` provides per-trade structured scoring; `coach.trade-review` does the same via LLM.
- `daily_journal`, `performance_os.DailyWorkflow`, and `DailySANotesPage` all capture daily pre/post-market notes.
- `risk_dashboard`, `market_context`, `market_regime` overlap with cockpit's `risk_summary` and with the user's daily journaling.
- `trade_ideas` tracks pre-trade idea staging; the user maintains watchlists in TradingView.

The result is a frontend that feels thin compared to the rich backend, with parallel surfaces and a junk-drawer "Intelligence" group in the sidebar.

## Decision

Consolidate before porting. Six conceptual clusters become a smaller, sharper surface:

1. **Intelligence (deterministic)** — fold into Cockpit. `edge_command_center` is the canonical "what to do now" feed. `recommendations` and `coaching_intelligence` routers are deprecated; their best fields move into the `edge_command_center` response. Frontend stops calling them; backend tables retained until cooling period passes.

2. **Coach (LLM)** — separate slice (`features-v3/coach/`). Tabs kept: Daily Briefing, Weekly Review, Ask, Trade Review, History. Tabs dropped: Pattern Detection, Rule Check (they duplicate the deterministic Edge feed). Mentor personality (`/ai/mentors`, weights, panel) removed entirely.

3. **Trade Review** — single surface. `trade_review_v2` router is deleted; useful fields fold into `/coach/trade-review`.

4. **Risk** — no standalone page. Cockpit's risk command center is the canonical surface. `risk_dashboard` router stays (powers cockpit), `RiskPage` is deleted.

5. **Market** — no standalone page. `market_context` snapshot renders inline at the top of the Journal slice. `market_regime/performance` powers a new "By Regime" tab in Analytics.

6. **Daily journaling** — single slice (`features-v3/journal/`). Canonical model: `daily_journal`. Pre-market = bias notes only. Post-market = notes + mood. Dropped: pre-market checklist, in-app watchlist, discipline rating. `DailySANotesPage`, `PerformanceOSPage`, and the `performance_os` router are removed. `DailyWorkflow`, `WeeklyReview`, `MonthlyReview`, `TradeIdea` tables retained for deferred drop.

7. **Trade Ideas** — killed entirely. The user stages ideas in TradingView. A "Missed Trades" feature is parked as future scope.

## Consequences

- Sidebar shrinks from ~21 routes to 13 (Cockpit, Trades, Calendar, Review, Journal, Analytics, Playbook, Lifecycle, Capital, Charges, Reports, Coach, Settings).
- The simple/pro nav-mode toggle is no longer needed; one nav config remains.
- All destructive backend changes (table/column drops) are deferred to a separate migration after a 1–2 week confidence window.
- Frontend build asserts zero references to deprecated routers before each backend removal.
- Several new-ui-native slice ports (Coach, expanded Journal) are required; tracked in `docs/V3_FINISH_PLAN.md` phases 3 and 4.

## Implementation

Plan file: `docs/V3_FINISH_PLAN.md`. GitHub issues: epic + one per phase (0–10).
