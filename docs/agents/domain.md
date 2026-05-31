# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses **single-context** layout:

- `CONTEXT.md` at repo root — domain glossary, trade lifecycle, formulas
- `docs/adr/` at repo root — Architecture Decision Records (20+ ADRs)
- `docs/ARCHITECTURE.md` — complete file map, all endpoints, models, services, components, design tokens

## Before exploring, read these

1. **`CONTEXT.md`** — domain glossary with exact terms for trades, P&L, R-multiple, capital events, setups, etc.
2. **`docs/adr/`** — read ADRs that touch the area you're about to work in. ADR naming convention: `NNN-short-title.md`.
3. **`docs/ARCHITECTURE.md`** — file map, endpoint list, model relationships, frontend components.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

Key glossary terms for this project:
- **Trade** — a complete position (entry → exit). NOT "order" or "position".
- **P&L** — profit and loss. NOT "profit" or "gain/loss".
- **R-multiple** — actual P&L divided by initial risk. NOT "risk-reward ratio".
- **Setup / Playbook** — a named trading pattern. NOT "strategy" or "system".
- **Partial exit** — selling a portion of an open position. NOT "partial close" or "scale out".
- **Pyramid** — adding shares to an open position. NOT "add" or "average down".
- **Capital event** — deposit, withdrawal, or system adjustment. NOT "transaction" or "cash flow".
- **Deployed capital** — entry price × remaining quantity for open positions. NOT "margin" or "exposure".

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0012 (trade status lifecycle) — but worth reopening because…_

## ADRs relevant to common tasks

| ADR | Title | When to read |
|-----|-------|-------------|
| 001 | Trade merge by date | Before touching trade creation/merge logic |
| 002 | Capital reconciliation | Before touching account balance or capital events |
| 004 | Long-only trades | Before adding shorting support |
| 007 | Decimal string serialization | Before changing API response formats |
| 011 | Dual state management | Before touching Zustand/React Query split |
| 012 | Trade status lifecycle | Before touching trade status handling |
| 019 | Partial exits and remaining quantity | Before touching partial exit logic |
| 020 | Live quote cache | Before touching market data |
| 021 | Naive IST datetime display fix | Before touching any datetime handling |
