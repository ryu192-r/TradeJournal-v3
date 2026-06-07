# ADR-023: `new-ui` as canonical design system

## Status
Accepted

## Date
2026-06-07

## Context

The frontend has three parallel UI worlds:

| System              | Location                          | Contents                                                                                      |
|---------------------|-----------------------------------|-----------------------------------------------------------------------------------------------|
| `new-ui/`           | `frontend/src/new-ui/`            | Tokens (`tokens.css`, ~19KB of CSS variables), primitives (Button, Card, Chip, Badge, Panel, Surface), layout (Stack, Cluster, Grid, Section, Page), data-display (MetricCard, MoneyValue, RMultipleValue, PercentValue, DataRow, Value), feedback (EmptyState, ErrorState, LoadingState, Skeleton), overlays (Drawer, Sheet), navigation (Tabs, NavItem, SegmentedControl) |
| `components/ui/`    | `frontend/src/components/ui/`     | `GlassButton`, `GlassCard`, `GlassInput`, `GlassSelect`, `GlassTextarea`, `GlassBadge`, `BottomSheet`, `PullToRefresh`, `SharedUI` (PageHeader, KpiCard, MetricCard, SectionHeader, StatusBadge, Tabs, AlertRow, etc.), `StateComponents` (EmptyState, ErrorState, Skeletons), `LoadingState`, `ErrorBoundary`, `InstallPrompt` |
| Per-feature `.css`  | `features-v3/<slice>/*.css`       | Slice-local layout                                                                            |

`new-ui/` and `components/ui/` are direct duplicates for: MetricCard, EmptyState, ErrorState, Badge, Tabs, Card, Button. The "glass" aesthetic implied by the `Glass*` family is no longer the design direction.

## Decision

`frontend/src/new-ui/` is the canonical design system going forward. `Glass*`, `SharedUI`, and `StateComponents` are removed.

**Carve-outs retained from `components/ui/`** (no `new-ui` equivalent yet, kept as-is):

- `BottomSheet` (mobile slide-up modal)
- `PullToRefresh` (mobile interaction wrapper)
- `InstallPrompt` (PWA-specific)
- `ErrorBoundary` (cross-cutting React error boundary)
- `ActionsInbox` (cross-cutting global inbox)

**Slice-local CSS rule:** files under `features-v3/<slice>/*.css` may declare layout (grid, flex, gaps, positioning, container queries) but **must not** redefine tokens — font sizes, colors, radii, shadows, spacing scales come from `new-ui/tokens` via CSS variables. Lint/audit enforces this.

## Consequences

- Every `Glass*` and `SharedUI` import migrates to a `new-ui` equivalent. This is the largest blast-radius phase in the V3 finish plan and ships slice-by-slice (see `docs/V3_FINISH_PLAN.md` Phase 7).
- `AGENTS.md` is updated: the canonical-card snippet (`CARD = 'bg-card rounded-2xl border border-border ...'`) is replaced by the `new-ui` `Card`/`Surface` primitive. Glass references are removed.
- Slice CSS authors gain a clear rule: layout-only. New tokens are added to `new-ui/tokens.css` if needed, never inline in a slice.
- Visual regressions are possible during the swap. Ship per slice with screenshot diffs.

## Implementation

- Migration tracked in `docs/V3_FINISH_PLAN.md` Phase 7.
- After the swap, the following files/directories are deleted:
  - `frontend/src/components/ui/GlassButton.tsx`, `GlassCard.tsx`, `GlassInput.tsx`, `GlassSelect.tsx`, `GlassTextarea.tsx`, `GlassBadge.tsx`
  - `frontend/src/components/ui/SharedUI.tsx`
  - `frontend/src/components/ui/StateComponents.tsx`
- Retained: `BottomSheet.tsx`, `PullToRefresh.tsx`, `InstallPrompt.tsx`, `ErrorBoundary.tsx`, `ActionsInbox` directory.
