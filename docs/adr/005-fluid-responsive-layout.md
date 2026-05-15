# ADR-005: Fluid Responsive Layout via CSS clamp()

## Status
Accepted

## Context
Traditional breakpoint-based responsive design causes layout jumps at specific widths. A trading journal needs smooth scaling across phone, tablet, and desktop.

## Decision
Page containers use CSS `clamp()` variables defined in `frontend/src/index.css`:
- `--page-px` — horizontal padding
- `--page-py` — vertical padding
- `--page-gap` — gap between elements
- `--heading-size` — page heading font size
- `--cell-px` / `--cell-py` — table cell padding
- `--text-sm` / `--text-xs` — small text sizes

Example: `--page-px: clamp(0.75rem, 4vw, 2rem)`

Tailwind usage: `text-[length:var(--x)]` (not `text-[var(--x)]` — Tailwind treats `var()` as color by default).

## Consequences
- ✅ Smooth scaling — no breakpoint jumps
- ✅ Single CSS variable change adjusts entire page
- ✅ Works across all screen sizes
- ⚠️ Requires `text-[length:var(--x)]` syntax (easy to forget)
- ⚠️ Not all Tailwind utilities support CSS variables natively

## Implementation
- `frontend/src/index.css` — clamp() variable definitions
- All page containers: `DashboardPage`, `AnalyticsDashboardPage`, `TradesPage`, `JournalPage`, `AICoachPage`, `CapitalPage`, `SettingsPage`
