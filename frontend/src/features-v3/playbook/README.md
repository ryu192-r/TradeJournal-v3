# Playbook V3 (V8)

V3-native strategy/setup library page.

## What it does

- Renders the user's **playbook records** (`/setups` API) alongside **trade-derived setups**
  (setup names that appear on trades but lack a backend record), plus an **Untagged** bucket
  for trades with no setup.
- Per-setup performance: gross P&L, win rate, avg R, best/worst trade, reviewed/pending counts,
  last traded date. Uses gross P&L (pre daily charges) only — no fake net allocation.
- Per-setup tactics, ideal conditions, and risk profile (read-only display from playbook record).
- Per-setup **rules editor** backed by `useUpdateSetupMutation` — only available for setups
  with a real playbook record. Trade-derived and untagged setups show an honest "no playbook
  record" empty state.
- Linked trades list (latest 25) with quick links to Trade Detail v3 and Review v3.
- Review insights: top review tags + recent review note excerpts. No AI summarization,
  no invented lessons.
- Library filters: All / Active / Archived / Profitable / Losing / No trades / Not enough data
  / Needs review / Untagged.

## Files

```
PlaybookV3Page.tsx              # entry point, layout, state
playbook.css                    # responsive grid + card hover
components/
  PlaybookHeader.tsx            # library summary metric strip
  SetupLibraryPanel.tsx         # left column: search + filter + cards
  SetupListCard.tsx             # one setup card
  SetupDetailPanel.tsx          # right column: composes detail panels
  SetupPerformancePanel.tsx     # 8+ metric cards
  SetupTacticsPanel.tsx         # tactics, ideal conditions, risk profile
  SetupRulesPanel.tsx           # editable rules (backend persistence)
  SetupTradesPanel.tsx          # linked trades table
  SetupReviewInsightsPanel.tsx  # top tags + recent note excerpts
utils/
  playbookGrouping.ts           # combineSetups: backend ∪ trade-derived ∪ untagged
  playbookMetrics.ts            # computeSetupPerformance, summarizeLibrary, computeReviewInsights
  playbookFilters.ts            # PLAYBOOK_FILTER_OPTIONS, applyPlaybookFilters
__tests__/                      # vitest unit + page tests
```

## What it does NOT do

- No AI coaching, no AI lessons, no AI rule suggestions.
- No fake setup performance.
- No setup-level net P&L (gross only, labeled "Pre daily charges").
- No backend changes.
- Does not delete legacy playbook — `V3LiveApp` exposes a "Open legacy playbook" fallback.
