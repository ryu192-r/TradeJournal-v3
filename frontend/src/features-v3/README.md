# TradeJournal v3 Preview

`features-v3` contains isolated rebuild work that uses `frontend/src/new-ui`.

N2 scope:

- V3 shell preview only.
- Route: `/v3-preview`.
- Local preview navigation only.
- No API calls.
- No business logic.
- No real route migration.
- No backend changes.

Do not import legacy V2 dashboard, shell, trade review, coaching, edge, recommendation, or current page modules into this folder.

Known limits:

- Does not replace current dashboard, trades, review, analytics, reports, import, settings, or shell.
- Does not implement Cockpit v3.
- Does not load account, trade, P&L, charges, live market, or report data.
- Drawer demo has basic accessible behavior through `new-ui`; no focus trap yet.

Next phases:

- N3: Cockpit v3.
- N4: Trades v3.
- N5: Trade detail v3.
- N6: Review, Analytics, Reports v3 migration.
