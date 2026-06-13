# ADR-025: Trading Improvement Loop (Improvement Actions + Daily Focus Action)

## Status
Accepted

## Date
2026-06-13

## Context

V3 removed the old Performance OS daily-review page (ADR-016, superseded by ADR-022). What remains missing is a deliberate, evidence-backed way for the trader to turn lessons into a concrete behavior change and check whether it actually held — a practical truth-reflection loop rather than another dashboard or journaling surface.

The Journal is the evidence log. Analytics and the Cockpit Edge feed describe *what happened*. Neither closes the loop of: lesson → improvement action → daily commitment → later review of adherence.

A `grill-with-docs` session resolved the direction: suggestions should be deterministic and evidence-backed first; AI is optional and only for explanation/coaching. TradingView and in-app Trade Ideas must not be required for the loop to work.

## Decision

Introduce the **Trading Improvement Loop** as a backend domain plus a manual-first surface.

- **Improvement Action** is the core unit: a trackable behavior change with `title`, `description`, `status`, `due_session`, `contract_type`, `contract_params`, and `source_evidence`. Stored in a dedicated `improvement_actions` table, user-scoped.
- **Status** lifecycle: `suggested` → `active` → `kept` / `broken` / `retired`. It tracks behavior adherence, not task completion.
- **Daily Focus Action**: exactly one Improvement Action may be the focus for a given `due_session` date (`is_daily_focus`). The API resolves the one-focus-per-day rule by clearing any prior focus for that date when a new one is selected; selecting a `suggested` action promotes it to `active`.
- **Improvement Backlog**: `suggested`/`active` actions that are not the current Daily Focus Action.
- **Verifiable Behavior Contracts** are preferred. Initial contract types: `no_early_entry`, `max_trades`, `cooldown_after_loss`, `stop_not_widened`, and `manual_check` (the fallback Manual-Check Action).

This first slice is **manual-first**: create / edit / list / select-focus only. There is no suggestion engine, no verification engine, and **no AI dependency**. Those are deliberately deferred so the loop is usable and testable on its own.

API lives under a dedicated `/improvement` prefix (`improvement_actions.py` router); the legacy `/perf-os` surface is deprecated in V3:
`GET|POST /improvement/actions`, `GET|PUT|DELETE /improvement/actions/{id}`,
`POST /improvement/actions/{id}/select-focus|clear-focus`, and
`GET /improvement/daily-focus/{date}` returning `{focus, backlog}`.

## Consequences

- A small new table and router are added; no existing endpoints change. The dropped Performance OS page is **not** revived — the loop surfaces inside the V3 structure (`features-v3` + `new-ui`).
- Deterministic suggestion and verification engines can layer on later by populating `source_evidence` and evaluating `contract_type`/`contract_params` against trade, journal, grade, stop-history, and emotion evidence — without reworking the data model.
- AI remains optional and explanatory; the loop must keep working with it disabled.
- TradingView and in-app Trade Ideas are intentionally not coupled to the loop.

## Alternatives considered

- **Reuse the Actions Inbox** (`actions_inbox`): it is a read-only aggregation of derived actionable items, not a user-owned, lifecycle-tracked behavior contract store. Rejected for this purpose.
- **Add fields to the daily journal/workflow**: would duplicate Journal responsibilities and couple the loop to a per-day record rather than a first-class, multi-day Improvement Action.
