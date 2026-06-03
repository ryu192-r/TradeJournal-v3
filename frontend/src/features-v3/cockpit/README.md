# Cockpit v3 Preview

Cockpit v3 is the first real page in the isolated V3 preview shell. It renders only inside `/v3-preview`.

## Scope

- Uses N1 `new-ui` tokens/components and N2 V3 shell.
- Uses existing frontend hooks and API clients only.
- Keeps legacy `/dashboard`, `/trades`, `/review`, `/analytics`, `/reports`, `/import`, and `/settings` unchanged.
- Does not import old V2 dashboard or shell components.
- Does not touch backend routes, schemas, migrations, calculations, or API contracts.

## Data Sources

- `useOperationalDashboardQuery()` for existing operational dashboard/risk data.
- `useIntelligenceDashboardQuery()` for existing intelligence dashboard readiness.
- `useTradesQuery()` for existing trade list data.

No new backend endpoints are created.

## Data Honesty

- Missing charges render as `Not added` or `Pending`, never `₹0`.
- Net P&L is withheld until recorded fees exist.
- Deleted trades are excluded from normal metrics.
- Open trades use backend `status` and `remaining_qty` based wrapper logic, not raw `exit_price` checks.
- Invalid values render safe fallbacks instead of `NaN`, `null`, `undefined`, or object text.

## N3 Limitations

- No live dashboard replacement.
- No route migration.
- No daily charges ledger.
- No contract note parsing.
- No exact day-level net P&L after charges.
- No trade detail, edit, close, or destructive flows.
- No full review, analytics, reports, or trades migration.

N3 proves isolated Cockpit structure, data honesty, and responsive shell fit before future migration work.
