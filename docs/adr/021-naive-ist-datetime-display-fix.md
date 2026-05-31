# ADR-021: Naive IST datetime display fix

## Status
Accepted

## Date
2026-05-25

## Context

The backend stores trade datetimes (`entry_time`, `exit_time`) as **naive IST wall-clock** values — Python `datetime` objects without timezone info. When serialized to JSON via Pydantic, they produce strings like `"2026-05-20T09:16:00"` (no `Z` suffix, no `+05:30` offset).

JavaScript's `new Date()` constructor interprets strings **without timezone info as browser-local time**. That is unsafe for users outside IST and for `YYYY-MM-DD` calendar grid alignment.

Example failure mode:

1. Backend sends `"2026-05-20T09:16:00"` (9:16 AM IST wall clock)
2. Browser parses it as local time in whatever timezone the device uses
3. Calendar/display code can shift date/time or weekday

This affected:
- `formatDate()` and `formatDateTime()` in `utils/format.ts` — all date/time displays
- `isoToDatetimeLocal()` in `schemas/tradeForm.ts` — trade form population and editing

The form edit bug: when editing a trade's date, the form displayed the wrong pre-filled time (off by the browser's timezone offset), and saving re-submitted a time that shifted further.

## Decision

Do not parse naive backend datetimes as instants. Treat naive strings as IST components.

**Implementation:**
- `formatDate()` and `formatDateTime()` extract year/month/day/time components directly from strings
- `isoToDatetimeLocal()` strips timezone suffixes and keeps `YYYY-MM-DDTHH:mm`
- `datetimeLocalToIso()` sends the entered naive IST value with seconds
- Calendar helpers parse `YYYY-MM-DD` manually and use Asia/Kolkata only for explicit instants

## Consequences

- Dates and times display correctly across all timezones
- Trade form editing saves the intended IST wall-clock time back to the backend
- Existing naive IST data is unaffected
