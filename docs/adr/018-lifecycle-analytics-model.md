# ADR-018: Lifecycle Analytics Model

## Status
Accepted

## Context
Trade outcome alone does not explain behavior. The system needs deterministic analytics for emotion logs, execution grades, revenge trades, overtrading, early exits, and discipline before AI coaching summarizes anything.

## Decision
Lifecycle analytics are first-class backend endpoints under `/api/v1/lifecycle`.

The lifecycle model uses:
- `EmotionLog` rows for emotional state over a trade.
- `ExecutionGrade` rows for A-F execution dimensions.
- `TradeTimeline` rows for lifecycle events.
- Trade, journal, and exit data for behavioral signals.

AI Coach may consume lifecycle outputs, but deterministic analytics remain the source of truth.

## Consequences
- Behavioral insights are reproducible and testable.
- AI reviews can cite structured inputs rather than infer from raw notes only.
- Analytics endpoints must avoid serializing non-finite values and should handle empty datasets explicitly.

## Implementation
- Backend router: `backend/app/routers/lifecycle_analytics.py`
- Models: `EmotionLog`, `ExecutionGrade`, `TradeTimeline`
- Frontend hooks: `frontend/src/hooks/useLifecycleAnalyticsQuery.ts`, `frontend/src/hooks/useBehavioralIntelligenceQuery.ts`
