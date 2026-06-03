# Trades v3 Preview

Trades v3 is an isolated trade-ledger preview inside `/v3-preview`.

## Scope

- Uses N1 `new-ui` and the N2 V3 shell.
- Uses existing `listTrades()` / `/trades/` API only.
- Uses existing trade date and calculation helpers where needed.
- Does not replace live `/trades`.
- Does not import old `TradesPage` visual components.
- Does not add edit, delete, close, partial exit, import, or add trade flows.
- Does not touch backend files or API contracts.

## Data Rules

- Deleted trades are excluded from default active views.
- Deleted trades appear only when the deleted filter is selected.
- Open trade logic uses backend `status` plus `remaining_qty`; it does not use raw `exit_price == null`.
- Original SL and current protection SL remain visually distinct.
- Trade P&L is labelled as gross/pre daily charges where summary context needs it.
- No fake net P&L is shown.
- Missing setup, notes, and SL values produce safe badges/fallbacks.

## N4 Limitations

- No live route migration.
- No add/edit/delete/close/partial-exit actions.
- No chart/trade detail redesign.
- No daily charges ledger or exact net after charges.
- No broker reconciliation or contract-note parsing.

N4 proves the future trade ledger inside the isolated V3 shell only.
