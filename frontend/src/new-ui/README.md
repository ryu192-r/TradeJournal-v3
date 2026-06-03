# TradeJournal v3 New UI

`new-ui` is isolated design-system foundation for future frontend rebuild phases. It is not wired into current routes. Current app remains legacy stable UI and fallback UI.

## Purpose

Create reusable, presentational UI blocks for Midnight Fintech Cockpit: premium India-first trading command center for serious traders. Components must feel calm, sharp, data-first, dark, readable, and scalable.

N1 does not fix current V2 dashboard, current shell, trades workflow, route migration, backend modeling, daily charges ledger, mobile behavior of existing pages, or production quality of live routes.

## Structure

```txt
frontend/src/new-ui/
  tokens/
  primitives/
  layout/
  feedback/
  data-display/
  overlays/
  navigation/
  utils/
  __tests__/
```

## Tokens

`tokens/tokens.css` defines scoped CSS variables under `.tjv3-ui`. Future v3 pages should wrap content with `AppCanvas` or another `.tjv3-ui` container.

Token names are prefixed with `--tj-*` to avoid collisions. Tokens cover color, effects, radius, spacing, typography, layout, z-index, and motion.

`tokens/tokens.ts` mirrors token names for TypeScript references.

## Component Rules

- Keep components presentational.
- Do not put business logic inside `new-ui`.
- Do not fetch data inside primitives.
- Do not import old V2 visual components into `new-ui`.
- Do not couple components to routes, Zustand, React Query, backend schemas, or API contracts.
- Keep APIs small: `children`, `className`, variants, accessible props.
- Use safe formatting for incomplete values.
- Prefer composition over giant components.

## Accessibility

- Use semantic buttons, links, sections, and dialog roles.
- Preserve keyboard focus and focus-visible states.
- Add labels for icon-only controls.
- Do not rely on color-only meaning for statuses.
- Drawer supports close button, Escape close, and backdrop close. Focus trap is not implemented in N1.

## Responsive

- Prefer fluid spacing tokens and `minmax(0, ...)`.
- Use wrapping layouts and `auto-fit` grids.
- Avoid fixed widths that break at 360px.
- Use tabular numeric text for financial values.
- Ensure long values can truncate or wrap without horizontal overflow.

## Do

- Wrap v3 screens in `AppCanvas`.
- Use `MoneyValue`, `PercentValue`, and `RMultipleValue` for displayed numbers.
- Use `Panel`, `MetricCard`, `DataList`, and `TableShell` for cockpit surfaces.
- Keep density readable for trading workflows.
- Keep color restrained: accent for selection/actions, semantic color for states.

## Don't

- Do not migrate routes in N1.
- Do not redesign current live pages from `new-ui`.
- Do not delete V2 UI files.
- Do not import legacy `components/ui` or V2 dashboard components into `new-ui`.
- Do not add API calls, trade calculations, P&L logic, stop logic, or route state.
- Do not display `NaN`, `undefined`, `null`, `[object Object]`, or invalid currency.

## Example

```tsx
import { AppCanvas, MetricCard, MoneyValue, Panel } from '@/new-ui'

export function FutureCockpitPreview() {
  return (
    <AppCanvas>
      <Panel title="Risk">
        <MetricCard
          label="Open Risk"
          value={<MoneyValue value={12500} />}
          description="Position exposure display only"
        />
      </Panel>
    </AppCanvas>
  )
}
```

## Future Phases

- N2: New shell behind feature flag or isolated route wrapper.
- N3: Cockpit v3.
- N4: Trades v3.
- Later: Trade detail v3, Review, Analytics, Reports migration.
