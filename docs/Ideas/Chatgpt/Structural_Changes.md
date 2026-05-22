# TradeJournal-v3 Structural Changes Recommended

This file focuses on architecture and code organization changes to support the UI/UX overhaul and new TradingOS Foundation.

## 1. Backend domain consolidation

The latest repo adds many routers and models. The risk is formula drift, because risk, equity, remaining quantity, partial realized PnL, and dashboard summaries are computed in several places.

### Add shared services

```text
backend/app/services/position_service.py
backend/app/services/risk_service.py
backend/app/services/capital_snapshot_service.py
backend/app/services/lifecycle_service.py
backend/app/services/report_service.py
backend/app/services/calendar_service.py
```

### Responsibility split

#### `position_service.py`

- remaining quantity
- partial realized PnL
- full realized PnL
- open/closed status helpers
- live unrealized PnL
- close-after-partial-exit logic

#### `risk_service.py`

- deployed capital
- open risk
- portfolio heat
- positions without stops
- setup/symbol concentration
- warning generation

#### `capital_snapshot_service.py`

- initial balance
- deposits
- withdrawals
- realized PnL
- partial realized PnL
- deployed capital
- net equity
- available capital

#### `lifecycle_service.py`

- emotion summaries
- execution grade summaries
- revenge trade detection
- overtrading detection
- discipline score
- early exit analysis

#### `calendar_service.py`

- daily PnL rollups
- trade count per day
- journal state per day
- workflow state per day
- behavior warning markers

#### `report_service.py`

- weekly report payload
- monthly report payload
- setup report payload
- behavior report payload
- HTML/PDF export data

## 2. API structure cleanup

### Current issue
Feature endpoints are growing quickly. Keep routers, but move formulas out of routers.

### Target pattern

```text
router -> schema validation -> service -> response schema
```

Routers should not contain heavy calculations.

## 3. Frontend structure cleanup

### Proposed folder structure

```text
frontend/src/
  app/
    routes.ts
    navigation.ts
    queryClient.ts
  components/
    shell/
      AppShell.tsx
      Sidebar.tsx
      BottomNav.tsx
      TopBar.tsx
    dashboard/
      widgets/
      DashboardPage.tsx
      widgetRegistry.ts
    trades/
      grid/
      detail/
      filters/
      partial-exits/
    performance-os/
      DailyWorkflow.tsx
      WeeklyReview.tsx
      MonthlyReview.tsx
      JournalEditor.tsx
    reports/
      ReportBuilder.tsx
      ReportPreview.tsx
    calendar/
      CalendarPage.tsx
      DayDrawer.tsx
    analytics/
    lifecycle/
    risk/
    market/
    ui/
  domains/
    trades/
    risk/
    lifecycle/
    performance-os/
    market/
    reports/
```

## 4. Navigation state

Current app uses Zustand `activeView`. That is acceptable for now, but the product is becoming large enough to benefit from URL routing.

### Short-term

Keep Zustand, but move navigation config into one file:

```text
frontend/src/app/navigation.ts
```

Include:

- groups
- view id
- label
- icon
- simple/pro visibility
- mobile visibility

### Mid-term

Move to real routes:

```text
/dashboard
/trades
/trades/:id
/performance-os
/calendar
/reports
/playbook
/risk
/market
/settings
```

This makes deep linking, browser back/forward, and screenshots easier.

## 5. Widget system

Create a dashboard widget contract:

```ts
type DashboardWidget = {
  id: string
  title: string
  defaultSize: 'sm' | 'md' | 'lg'
  component: React.ComponentType
  requires?: string[]
  simpleMode?: boolean
}
```

Store user config in localStorage first:

```text
tjv3-dashboard-widgets-v1
```

Later store in backend if needed.

## 6. Report engine

Add report payload endpoints before PDF generation.

```text
GET /api/v1/reports/weekly?week_start=YYYY-MM-DD
GET /api/v1/reports/monthly?month=YYYY-MM
GET /api/v1/reports/setup/{setup_name}
GET /api/v1/reports/behavior?from_date=&to_date=
```

Frontend should render the report from JSON. Exporters should reuse that same JSON.

## 7. Calendar aggregate endpoint

Avoid one request per day. Add:

```text
GET /api/v1/calendar/month?month=YYYY-MM
```

Payload shape:

```json
{
  "month": "2026-05",
  "days": [
    {
      "date": "2026-05-21",
      "trade_count": 3,
      "net_pnl": "1250.00",
      "win_rate": 66.7,
      "journal_done": true,
      "workflow_phase": "review",
      "discipline_rating": 4,
      "warnings": ["overtrading"]
    }
  ]
}
```

## 8. Tag system migration

Current tags are free-form lists on trades. Keep this for now, but plan a real taxonomy.

### Future schema

```text
tags
- id
- name
- category
- color
- description

taggings
- id
- tag_id
- entity_type
- entity_id
- created_at
```

Supported entity types:

- trade
- journal
- setup
- idea
- report

## 9. Event/timeline unification

`TradeTimeline` should become the audit spine for trade lifecycle events.

Recommended event types:

- trade_opened
- trade_updated
- stop_updated
- target_updated
- pyramided
- partial_exit
- trade_closed
- trade_deleted
- emotion_logged
- execution_graded
- review_added
- image_added
- image_deleted

Stop history can remain for stop-specific analytics, but it should also emit timeline events consistently.

## 10. Testing structure

Add tests by domain:

```text
backend/tests/
  test_position_service.py
  test_risk_service.py
  test_lifecycle_service.py
  test_performance_os.py
  test_market_context.py
  test_reports.py
  test_calendar.py

frontend/src/
  components/dashboard/__tests__/
  components/trades/__tests__/
  components/performance-os/__tests__/
```

## 11. Observability

Keep the new timing middleware and frontend performance marks, but add structured fields:

- route
- method
- status_code
- duration_ms
- query_count if available
- cache hit/miss for market quotes

Add dashboard developer panel in dev mode only:

- last queries
- slow endpoints
- stale data warnings
- quote sync status

## 12. Structural priority order

1. Extract shared backend services.
2. Fix P0/P1 bugs.
3. Add tests around shared services.
4. Move navigation config into a single file.
5. Introduce grouped sidebar and mobile bottom nav.
6. Add calendar aggregate endpoint.
7. Add reports payload endpoints.
8. Consolidate Journal/SA Notes/Performance OS.
9. Add widget registry.
10. Migrate tags when analytics needs cross-entity tagging.
