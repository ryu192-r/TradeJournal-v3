# ADR-024: Cockpit absorbs the deterministic intelligence feed

## Status
Accepted

## Date
2026-06-07

## Context

The backend has four routers in the "tell me what to do / focus on / fix" cluster:

| Router                   | Output                                                     | Style         |
|--------------------------|------------------------------------------------------------|---------------|
| `edge_command_center`    | Single feed: focus / avoid / next-best-action              | deterministic |
| `recommendations`        | Dashboard + summary of actionable intel                    | deterministic |
| `coaching_intelligence`  | Weekly plan, setup confidence, drift, review prompts       | deterministic |
| `coach`                  | Daily/weekly review, ask, patterns, rule-check, trade-review | LLM          |

`edge_command_center` itself documents that it is "the unified what-should-I-do-now intelligence surface" — a half-finished consolidation effort.

Cockpit (`CockpitV3Page`, fed by `dashboard/operational`) is already the user's "right now" view: KPIs, open trades with live quotes, risk summary, capital, streaks, equity curve. The Edge feed answers the same question — "what should I attend to right now" — and a separate sidebar item for it forces an extra click for no information gain.

## Decision

The deterministic Edge feed is rendered **inside Cockpit**, not as a standalone slice.

- A new section between KPIs and Live Positions in `CockpitV3Page` consumes `edge_command_center`'s response.
- `EdgeCommandCenterPage` (legacy) is deleted; the `edge-center` `ActiveView` is removed.
- `recommendations` and `coaching_intelligence` are deprecated: their best fields fold into the `edge_command_center` response shape, frontend callers are removed, and the routers are taken offline after a cooling period.
- `coach` remains a separate V3 slice (`features-v3/coach/`) — LLM/conversational is a different mode from a deterministic feed.
- The Cockpit "Edge" section may include sub-areas (Focus / Avoid / Drift / Setup confidence) that visually correspond to the merged response, but it is one section, not tabs.

## Consequences

- The sidebar loses a route; "Intelligence" disappears as a sidebar group entirely.
- Cockpit becomes the actual command center it claims to be. First paint can rely on `dashboard/operational` plus one additional `edge_command_center` call (or both can be aggregated server-side later).
- Three deterministic intelligence sources collapse into one canonical response shape (`edge_command_center`).
- `coach` is reachable from its own AI-group sidebar item, not buried in an Intelligence drawer.

## Implementation

- Tracked in `docs/V3_FINISH_PLAN.md` Phase 2.
- Backend folding of `recommendations` + `coaching_intelligence` fields into `edge_command_center` response is part of Phase 2; router removal is deferred until the frontend cuts over.
- Frontend hook: `useEdgeCommandCenterQuery` (new) — returns the unified response.
