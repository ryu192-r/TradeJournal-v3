# ADR-021: Naive UTC datetime display fix

## Status
Accepted

## Date
2026-05-25

## Context

The backend stores all trade datetimes (`entry_time`, `exit_time`) as **naive UTC** — Python `datetime` objects without timezone info. When serialized to JSON via Pydantic, they produce strings like `"2026-05-20T09:16:00"` (no `Z` suffix, no `+00:00` offset).

JavaScript's `new Date()` constructor interprets strings **without timezone info as local time**. This caused a double-conversion bug:

1. Backend sends `"2026-05-20T09:16:00"` (9:16 AM UTC = 2:46 PM IST)
2. `new Date("2026-05-20T09:16:00")` treats it as **9:16 AM local time (IST)** in Indian timezone
3. `toIST()` adds another +5:30 offset, producing **2:46 PM → 8:16 PM display** — completely wrong

This affected:
- `formatDate()` and `formatDateTime()` in `utils/format.ts` — all date/time displays
- `isoToDatetimeLocal()` in `schemas/tradeForm.ts` — trade form population and editing

The form edit bug: when editing a trade's date, the form displayed the wrong pre-filled time (off by the browser's timezone offset), and saving re-submitted a time that shifted further.

## Decision

Append `Z` to naive datetime strings before parsing in JavaScript. This forces UTC interpretation, after which the IST conversion (+5:30) produces the correct display time.

**Implementation:**
- Added `normalizeTimestring()` in `utils/format.ts` — detects strings without `Z` or `+HH:MM` suffix and appends `Z`
- `formatDate()` and `formatDateTime()` call `normalizeTimestring()` before `new Date()`
- `isoToDatetimeLocal()` in `schemas/tradeForm.ts` uses the same logic to append `Z` to naive strings
- The save path (`datetimeLocalToIso`) already correctly appends `+05:30` — no change needed

## Consequences

- Dates and times display correctly across all timezones
- Trade form editing saves the correct UTC time back to the backend
- No backend changes required — the fix is entirely client-side
- Existing data is unaffected (backend already stores correct UTC times)