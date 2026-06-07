# V3 Finish Plan

## Status
Active — 2026-06-07. Phase 1 complete (commit `8b479d0`).

Owner: ryu192-r. Tracked in GitHub issues (epic + one issue per phase).

## Why this plan exists

The codebase is mid-migration from a V2 page-based UI (`frontend/src/pages/*` + `frontend/src/components/*`) to a V3 feature-sliced UI (`frontend/src/features-v3/*` + `frontend/src/new-ui/*`). The shell already runs V3 (`V3LiveApp`), but ~9 backend feature areas still surface only through legacy pages embedded in the V3 shell via `tjv3-legacy-embed`. Two navigation configs, three design systems, and several overlapping backend routers compound the impression that things are "all over the place."

Goal: finish V3 so the frontend matches the rich backend, with consolidation (not 1:1 ports) where backend features overlap.

## Decisions locked (see ADRs 022 / 023 / 024)

### Intelligence cluster

- **Cockpit absorbs the deterministic "what to do now" feed.** A new section in `CockpitV3Page` is fed by `edge_command_center`. No standalone Intelligence sidebar item.
- **Coach stays standalone** as a V3 slice (`features-v3/coach/`) — distinct mental model (LLM, conversational, history).
- Coach tabs kept: Daily Briefing, Weekly Review, Ask, Trade Review, History. **Dropped: Pattern Detection, Rule Check** (they overlap with the deterministic Edge feed).
- **Killed routers** (deferred destructive drops): `recommendations`, `coaching_intelligence`, `trade_review_v2`, `trade_ideas`, `performance_os`. Best fields from `trade_review_v2` fold into `/coach/trade-review`.
- **Killed feature**: mentor personality (5 mentors with weight sliders). `/ai/mentors`, `AiPersonalityPanel.tsx` removed.

### Market + Risk cluster

- **Risk has no standalone page.** Cockpit's risk command center is the canonical surface.
- **Market context strip** (`Nifty trend, FII/DII, VIX, breadth`) renders inline at the top of the Journal slice.
- **"By Regime" tab** added to AnalyticsV3Page, fed by `market_regime/performance` — answers "is my edge holding in this regime."
- Kept routers: `market_context`, `market_regime`. No standalone Market view.

### Journal cluster (merged)

- Single slice `features-v3/journal/`. Display name **"Journal"** (model-aligned).
- Top: market_context snapshot strip (read-only).
- Pre-market: bias notes only (no checklist, no in-app watchlist — user maintains watchlist in TradingView).
- Post-market: notes + mood. **Discipline rating dropped** (column kept nullable; deferred drop).
- Canonical model: `daily_journal`. **Dropped models** (deferred destructive migration): `DailyWorkflow`, `WeeklyReview`, `MonthlyReview`, `TradeIdea`. **Killed pages**: `DailySANotesPage`, `PerformanceOSPage`, `RiskPage`, `MarketContextPage`, `TradeIdeasPage`.

### Design system

- **`frontend/src/new-ui/` is canonical.** Token-driven, primitive set, layout/data-display/feedback/overlays/navigation. See ADR 023.
- **Carve-outs from `components/ui/` retained** (no new-ui equivalent yet): `BottomSheet`, `PullToRefresh`, `InstallPrompt`, `ErrorBoundary`, `ActionsInbox`.
- **Dropped**: `GlassButton`, `GlassCard`, `GlassInput`, `GlassSelect`, `GlassTextarea`, `GlassBadge`, `SharedUI.tsx`, `StateComponents.tsx`. The "glass" aesthetic is no longer the design direction.
- **Per-slice CSS rule**: layout/grid/gap only. Tokens (font sizes, colors, radii, shadows) come from `new-ui/tokens` and are never redefined in slice CSS. Lint/audit enforces this.

### Navigation

- Single nav config. `simple/pro` toggle and `interfaceMode.ts` removed.
- Sidebar groups (5):
  | Group   | Items                                          |
  |---------|------------------------------------------------|
  | Today   | Cockpit, Trades, Calendar, Journal, Review     |
  | Insight | Analytics, Playbook, Lifecycle                 |
  | Money   | Capital, Charges, Reports                      |
  | AI      | Coach                                          |
  | System  | Settings                                       |
- Mobile bottom nav: Cockpit · Trades · + (FAB) · Journal · Review.
- Import → topbar action button, not a sidebar item.
- `ActiveView` union shrinks: kept `dashboard, trades, calendar, review, journal, analytics, playbook, lifecycle, capital, charges, reports, coach, settings`. Dropped `ideas, perf-os, sa-notes, risk, market, recommendations, coaching-intelligence, edge-center`.

### Legacy fallbacks

Three "open legacy workspace" escape hatches in `V3LiveApp` exist because the V3 versions are incomplete: `TradeDetailV3`, `PlaybookV3`, `SettingsV3`. Each is audited, missing features ported, then the fallback toggle and the legacy page are deleted.

## Execution sequence

Each phase is one PR-shaped chunk. Tests and typecheck must pass before merge:

```bash
cd backend && python3 -m pytest tests/ -v
cd frontend && npx vitest run
cd frontend && npx tsc --noEmit
cd frontend && npm run build
```

| #  | Phase                              | Summary                                                                                         | Risk     |
|----|------------------------------------|-------------------------------------------------------------------------------------------------|----------|
| 0  | Foundation                         | ADRs published, lint rule "no tokens in slice CSS"                                              | none     |
| 1  | Demolition Round 1 ✅               | Delete `TradeIdeas` (page+router+ActiveView), `RiskPage`, `MarketContextPage`, simple/pro toggle, `interfaceMode.ts`, mentor personality (panel + `/ai/mentors`) | low      |
| 2  | Cockpit absorbs Edge               | New Edge feed section in `CockpitV3Page` from `edge_command_center`. Delete `EdgeCommandCenterPage`. Frontend stops calling `/recommendations` and `/coaching-intelligence`. | medium   |
| 3  | Coach V3 native port               | `features-v3/coach/CoachV3Page` with 5 tabs (drop Pattern + Rule Check). Delete `AICoachPage`, `RecommendationsPage`, `CoachingIntelligencePage`. Cherry-pick `trade_review_v2` fields into `/coach/trade-review`. Remove `trade_review_v2` router. | high     |
| 4  | Journal merge                      | Add `bias_notes` and `market_snapshot` fields to `daily_journal`. Port `JournalV3Page` to top-strip + pre-market bias + post-market notes/mood. Delete `DailySANotesPage`, `PerformanceOSPage`, `performance_os` router. Stop reading/writing `discipline_rating` and `DailyWorkflow`/`WeeklyReview`/`MonthlyReview`/`TradeIdea` (tables retained for deferred drop). | high     |
| 5  | Analytics "By Regime" tab          | Tab in `AnalyticsV3Page` fed by `market_regime/performance`                                     | low      |
| 6  | Close 3 legacy fallbacks           | Audit `TradeDetailV3` / `PlaybookV3` / `SettingsV3` vs legacy. Ship missing features. Delete fallback toggles and legacy pages. | medium each |
| 7  | Design system swap                 | Wire `new-ui` everywhere. Drop `Glass*`, `SharedUI`, `StateComponents`. Keep mobile/PWA carve-outs. Audit slice CSS for token leaks. Ship slice-by-slice. | medium (broad)   |
| 8  | Nav consolidation                  | `v3Navigation` adopts the 5-group structure. Drop `app/navigation.ts` duplicates. Shrink `ActiveView` union. | low      |
| 9  | Old pages cleanup                  | Delete `pages/{Dashboard,Trades,TradeDetail,Journal,Capital,Calendar,Lifecycle}.tsx` and legacy `Sidebar`. | low      |
| 10 | Docs                               | Update `AGENTS.md`, `ARCHITECTURE.md`, refresh `CONTEXT.md`. Confirm ADRs 022/023/024 accepted. | low      |

After Phase 10 (and a 1–2 week confidence window), a follow-up alembic migration drops the deferred tables/columns: `daily_workflows`, `weekly_reviews`, `monthly_reviews`, `trade_ideas`, `daily_journal.discipline_rating`. Backups taken before drop.

## Risks and safeguards

- **Backend table drops are destructive.** All drops are deferred to a follow-up migration. Phases 1–10 only stop reads/writes. Tables remain queryable for emergency rollback.
- **Frontend → backend coupling.** Before deleting a router, grep `frontend/src/lib/endpoints.ts` and `frontend/src/features-v3/**` and `frontend/src/components/**` for callers. Build must pass with no references.
- **Phase 7 (design system swap) has the largest blast radius.** Ship per slice with visual diff captured each PR. Do not collapse into one PR.
- **Coach migration** (Phase 3) involves provider-specific request/response wiring. Keep AI provider config (`backend/app/core/ai_config.py`) untouched in this phase except for removing mentor personality.

## Out of scope (parked for after V3)

- "Missed Trades" slice (capture trades you didn't take with reasoning).
- Weekly/Monthly review surface (we may rebuild on `trade_review_v2`-style scoring later, but for now the per-trade Review queue covers the workflow).
- Optional rename of Journal → "Situational Awareness" (deferred; "Journal" stays for model alignment).

## Related ADRs

- ADR-022 — V3 finish: feature consolidation and culls
- ADR-023 — `new-ui` as canonical design system
- ADR-024 — Cockpit absorbs the deterministic intelligence feed
