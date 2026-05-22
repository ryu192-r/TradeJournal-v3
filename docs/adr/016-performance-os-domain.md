# ADR-016: Performance OS Daily Review Domain

## Status
Accepted

## Context
Daily prep, trade execution notes, end-of-day reflection, weekly review, and monthly review were spread across separate pages. This made the journal feel like several products instead of one trading workflow.

## Decision
Performance OS is the main daily workflow shell.

It owns:
- Daily workflow phase state: `pre_market`, `execution`, `review`, `behavior`.
- Pre-market checklist and plan notes.
- Intraday notes.
- Post-market notes, mood rating, and discipline rating.
- Weekly and monthly review summaries.

Journal and SA notes are supporting writing surfaces, not competing daily workflow entry points. Review Stream remains a task queue for trades that need deeper review.

## Consequences
- The user can run the trading day from one screen.
- Daily notes and review state are easier to connect to trades and analytics.
- Future Journal and SA Notes work should embed into or link from Performance OS instead of adding another parallel workflow.

## Implementation
- Backend router: `backend/app/routers/performance_os.py`
- Models: `DailyWorkflow`, `WeeklyReview`, `MonthlyReview`
- Frontend page: `frontend/src/pages/PerformanceOSPage.tsx`
- Query hooks: `frontend/src/hooks/usePerformanceOS.ts`
