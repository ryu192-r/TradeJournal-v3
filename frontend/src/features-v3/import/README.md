# Import V3 (V9)

V3-native broker import workspace. **Wraps** the existing `BrokerImportModal` —
the parser, endpoints, and import business logic are unchanged.

## What it does

- Lists supported brokers live from `GET /trades/brokers` (no faked sources).
- Per-broker CSV template download via `GET /trades/import/template/{broker}`.
- Honest C5 metadata badge per broker (Zerodha/Dhan auto-map exchange/segment/
  product_type/executed_order_count; generic CSV does not).
- Instructions panel that documents:
  - Imported P&L is gross / pre-charges; daily charges live in Charges Ledger.
  - Duplicate handling: fingerprint/order-ID match → skipped at preview.
  - Lifecycle data (stops, partial exits, reviews) is user-managed.
- "Last import" panel showing **only** what the backend response reported
  (added / updated / skipped / total / error count + first 8 issues). No fake counts.
- Legacy fallback button reopens the same modal — provided for parity with the
  pre-V9 entrypoint.

## What it does NOT do

- No new parser. No new backend.
- No fake import success or row counts.
- No silent imports — preview step in the modal is preserved.
- Does not replace `BrokerImportModal` — it wraps it.

## Files

```
ImportV3Page.tsx                  # entry, modal wiring, last-result state
index.ts
components/
  ImportSourceCards.tsx           # broker cards (live data)
  ImportInstructionsPanel.tsx     # gross-P&L + metadata + lifecycle notes
  ImportResultSummary.tsx         # last-run result, honest only
  ImportFallbackPanel.tsx         # legacy modal entrypoint
hooks/
  useBrokersQuery.ts              # GET /trades/brokers
utils/
  importStatusFormatters.ts       # safe summarize, broker copy/metadata flag
__tests__/                        # vitest unit + page tests
```

## Modification

Added one **additive** prop to `BrokerImportModal`:

```ts
onImportComplete?: (result: BrokerImportResult) => void
```

This fires after the parser response is set (success or error), so the V3 page
can show "Last import" without modifying flow. `onImported` callback is
unchanged.
