# V10 — Mobile QA + Legacy Cleanup + V3 Hardening Report

**Branch**: `hardening/v3-mobile-qa-legacy-cleanup`
**Date**: 2026-06-04

## Goal

Close the V3 rebuild track. No new features. Stabilize layout, remove dead
code, split the V3 chunk for production.

## V3 surfaces audited

All primary V3 surfaces now ship and were checked for layout safety at
360px–1920px conceptually:

Cockpit · Trades · Trade Detail · Add/Edit Trade · Position Actions ·
Review · Analytics · Reports · Playbook · Import · Settings ·
Charges Ledger · Dhan Estimator.

## Mobile findings + fixes applied

| Surface | Risk | Fix |
| --- | --- | --- |
| Reports `DailyTable` (6 cols) | Could push parent overflow on <420px | Wrapped in `overflow-x:auto` + `minWidth: 32rem` |
| Reports `GroupTable` (5 cols) | Same | Wrapped + `minWidth: 26rem` |
| Analytics `GroupTable` (5 cols) | Same | Wrapped + `minWidth: 26rem` |
| `SetupTradesPanel` 6-col grid (`7rem` + content + 4 auto cols) | Definite overflow at ≤500px | Wrapped grid in `overflow-x:auto` scroller with `minWidth: 34rem` |
| Drawer system (`Drawer` primitive) | Footer hidden behind bottom nav? | Already correct — `max-height:100dvh` + body `overflow:auto` keeps footer pinned |
| Z-index layering (nav 20 / overlay 60 / modal 70 / toast 90) | Nav covering modal? | Hierarchy correct — modal above nav |
| Mobile bottom-nav padding for shell canvas | Content under nav? | Already present in `v3Shell.css` (`padding-bottom: calc(var(--tj-mobile-bottom-nav-h) + …)`) |
| `PlaybookV3Page` 2-col layout | Cramped on tablet | Already collapses at 60rem via `playbook.css` |
| `DhanEstimateBreakdown` 2-col table | Tiny risk | Skipped — parent has `overflow: hidden`, only 2 cols |

## Drawer / modal hardening

`Drawer` primitive already has correct mobile behavior:

- `max-height: 100dvh` on panel
- `min-height: 0; overflow: auto` on body
- `border-top` divider on footer keeps action buttons sticky-feeling

PositionActionDrawer · TradePreviewDrawer · DailyChargesEntryDrawer ·
DailyChargesDrawer all use the primitive — no changes needed.

`BrokerImportModal` is a custom modal (not the V3 Drawer primitive) and
remains unchanged per V10 scope ("wrap not rewrite").

## Files removed (verified zero refs)

- `frontend/src/features-v3/shell/V3ImportSection.tsx` — replaced by V9
  ImportV3Page.
- `frontend/src/pages/CreateTradePage.tsx` — V3 trade form lives at
  `features-v3/trade-form/`.
- `frontend/src/pages/EditTradePage.tsx` — same.
- `frontend/src/pages/ReportsPage.tsx` — V3 ReportsV3Page replaces it.
- `frontend/src/pages/ReviewAnalyticsPage.tsx` — V3 AnalyticsV3 + ReviewV3
  replace it.
- `frontend/src/pages/AnalyticsDashboardPage.tsx` — re-export shim only.

Dead exports removed from `V3LiveApp.tsx`:

- `V3LegacyDashboardFallback`
- `V3LegacyTradesFallback`

…and their `lazy(() => import('@/pages/DashboardPage' / TradesPage))`
imports inside V3LiveApp (the page files themselves are kept — still used
by `Phase0Smoke.test.tsx`, `TradesPage.smoke.test.tsx`, and
`v3ShellPreview.test.tsx`).

## Files modified

- `frontend/src/features-v3/shell/V3LiveApp.tsx`
  - Lazy-loaded 9 V3 pages: `TradeDetailV3Page`, `ChargesLedgerPage`,
    `TradeFormV3Page`, `ReviewV3Page`, `AnalyticsV3Page`, `ReportsV3Page`,
    `PlaybookV3Page`, `ImportV3Page`, `SettingsV3Page`.
  - Cockpit + Trades stay eager (default landing views).
  - Removed dead fallback exports.
- `frontend/src/features-v3/reports/ReportsV3Page.tsx` — table wrappers.
- `frontend/src/features-v3/analytics/AnalyticsV3Page.tsx` — table wrapper.
- `frontend/src/features-v3/playbook/components/SetupTradesPanel.tsx` —
  grid scroller for narrow screens.
- `frontend/src/features-v3/__tests__/v3LiveApp.test.tsx` — `findByText`
  for lazy-mounted import view.

## Legacy embeds retained (intentional)

The following pro/advanced views remain wrapped in `tjv3-legacy-embed` +
`ErrorBoundary` inside V3LiveApp. Not rebuilt in V3 yet. Kept as long-term
legacy or deferred V3 work:

`capital · ideas · coach · perf-os · sa-notes · journal · calendar ·
lifecycle · risk · market · recommendations · coaching-intelligence ·
edge-center`.

Legacy fallbacks (toggle-on-demand from V3 page actions) — kept:

- `pages/TradeDetailPage.tsx` — fallback from TradeDetailV3.
- `components/playbook/SetupPlaybookPage.tsx` — fallback from PlaybookV3.
- `pages/SettingsPage.tsx` — fallback from SettingsV3.

`/v3-preview` demo route in `App.tsx` — kept.

## Bundle / build output

V3LiveApp chunk (initial shell + Cockpit + Trades):

| Phase | Size | Gzip |
| --- | --- | --- |
| Pre-V10 (V9 build) | 132 kB | 32.66 kB |
| Post-V10 | **17 kB** | **~5 kB** |

Per-page chunks created on demand:

| Chunk | Raw | Gzip |
| --- | --- | --- |
| `charges` | 40 kB | 10.7 kB |
| `import` | 24 kB | 6.5 kB |
| `playbook` | 24 kB | 6.6 kB |
| `trade-detail` | 19 kB | — |
| `settings` | 17 kB | — |
| `trade-form` | 11 kB | — |
| `reports` | 11 kB | — |
| `review` | 7.8 kB | — |
| `analytics` | 6.1 kB | — |

Heavy vendor bundles unchanged: `vendor-recharts` 337 kB and
`TradeLightweightChart` 179 kB — both already lazy-loaded by their
consumers.

## Tests

- 468 / 468 pass across 54 files.
- 1 test file updated to support lazy import (`v3LiveApp.test.tsx`).
- No new tests added — V10 is hardening; existing suite covers the
  surfaces and the deleted files had no tests.

## Validation results

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 468 / 468 pass.
- `npm run build` — clean (1.47 s).
- `npm run lint` — only pre-existing
  `src/components/charts/TradeLightweightChart.tsx:181` warning.
- `git diff --check` — clean.

## Backend

Untouched. No backend tests run.

## Confirmations

- P&L logic unchanged.
- Realized / unrealized P&L logic unchanged.
- Partial exit logic unchanged.
- Stop-loss lifecycle (original SL / current protection SL) unchanged.
- Daily charges accounting unchanged.
- Dhan estimator logic unchanged.
- Broker import parsing unchanged.
- Settings persistence unchanged.
- Auth/session behavior unchanged.

## Manual QA status

Not yet run by user — automated checks all green. Recommended desktop +
mobile spot-checks before deploy:

1. Cockpit / Trades / Review / Analytics / Reports at 375 px and 1440 px.
2. Open trade preview drawer + position action drawer on mobile —
   confirm action footer visible.
3. Reports daily table — confirm horizontal scroll on narrow screens.
4. Playbook setup detail with many trades — confirm grid scrolls.
5. Settings AI provider — confirm masked secret + test connection works.
6. Import — confirm broker cards render + modal opens.
7. Confirm legacy fallback buttons (PlaybookV3, SettingsV3, TradeDetailV3)
   still open the legacy pages.

## Known limitations

- Legacy embed views (capital/coach/perf-os/etc.) keep V2 styling. Not in
  V10 scope — port piecewise in future phases or accept long-term as
  legacy.
- `BrokerImportModal` retains its V2 modal styling (wrapped, not
  rebuilt). V10 scope explicitly forbids parser/flow rewrites.
- `vendor-recharts` (337 kB) only loads when Analytics or Cockpit charts
  render. Further reduction would require switching chart library — out
  of scope.
- Two pages still kept solely to support smoke tests
  (`pages/DashboardPage.tsx`, `pages/TradesPage.tsx`). Remove during a
  later test cleanup if those smoke tests are migrated to V3 surfaces.

## Recommendation for production deployment

The V3 rebuild track is feature-complete and hardened.

1. Merge `hardening/v3-mobile-qa-legacy-cleanup` to main.
2. Run a single manual mobile QA pass (15 min) covering the seven steps
   above.
3. Bump service worker cache (`tj-v3-v4` → `tj-v3-v5`) before deploy so
   old V2 chunks are evicted.
4. Deploy.

Suggested follow-up phases (not blocking):

- **L1 — Legacy view cleanup**: pick 2–3 legacy embeds (capital, ideas,
  coach) and decide port-vs-deprecate per view.
- **L2 — Smoke test migration**: move `Phase0Smoke.test.tsx` and
  `TradesPage.smoke.test.tsx` onto V3 surfaces, then delete
  `pages/DashboardPage.tsx` and `pages/TradesPage.tsx`.
- **L3 — Broker import V3**: rebuild `BrokerImportModal` against V3
  Drawer primitive (low priority — current modal works).
