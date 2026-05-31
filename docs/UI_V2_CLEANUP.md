# UI V2 Product Cleanup (2026-05-31)

## Goal

Tighten information architecture, reduce dashboard clutter, unify layout tokens, and add a global actions inbox — without new product features.

## Information architecture (5 areas)

| Area | Primary nav (Simple) | Advanced / More |
|------|----------------------|-----------------|
| **Dashboard** | Dashboard | Widget customize restores legacy blocks |
| **Trades** | Trades | Ideas, Calendar |
| **Review & Analytics** | Review & Analytics (single page, 7 tabs) | Perf OS, Journal, SA Notes, Reports, Coach, Lifecycle, Risk, Market, Intelligence, Coaching Intel, Edge Center |
| **Playbook & Knowledge** | Playbook | — |
| **Settings** | Settings, Capital | — |

Navigation source: `frontend/src/app/navigation.ts`.

## What changed

### Navigation & shell

- Rebuilt sidebar sections into the five areas above.
- Mobile bottom nav: **Dashboard · Trades · + · Review · More** (Pro views under More).
- Global **Actions inbox** (`ActionsInbox.tsx`): fixed bell bottom-right, badge count, mobile bottom sheet + desktop slide-over.
- **Review & Analytics merge** (2026-05-31): one page replaces separate Review stream + Analytics dashboard.

### Review & Analytics (merged)

**Page:** `frontend/src/pages/ReviewAnalyticsPage.tsx`

**Tabs** (`frontend/src/app/reviewAnalytics.ts`):

| Tab | Content (existing widgets) |
|-----|----------------------------|
| Overview | KPI metrics, streaks, monthly pulse |
| Mistakes | `TradeReviewBatchPanel` (Trade Review V2 batch) |
| Setups | Setup performance matrix |
| Time Analysis | Day-of-week, time-of-day, holding period |
| Risk / R:R | P&L heatmap, R distribution, drawdown |
| Equity Curve | Equity curve + monthly P&L |
| Review Queue | `TradeReviewStream` (card-by-card review) |

**Removed duplication:**

- Standalone **Analytics** nav item removed (Simple + Advanced).
- Old long-scroll Analytics page sections dropped from primary UX: **Behavior & Context** block (Lifecycle/Behavioral/Playbook/Market widgets) — still available on Dashboard via widget customize, not duplicated here.
- `AnalyticsDashboardPage.tsx` → thin re-export of `ReviewAnalyticsPage` for backward-compatible imports.

**Routing:**

- `activeView === 'review'` → default tab **Review Queue**.
- `activeView === 'analytics'` (legacy) → redirects to `review` + **Overview** tab via `appStore.setActiveView`.
- Tab choice persisted in `sessionStorage` (`tjv3-review-analytics-tab-v1`).

**Panels module:** `frontend/src/components/analytics/AnalyticsTabPanels.tsx` (extracted chart/section components).

### Dashboard (command center)

- Default widgets (`tjv3-dashboard-widgets-v2`): P&L summary, quick performance, open actions, recent trades, compact open positions.
- Legacy widgets hidden by default; restore via **Widgets** customize.
- Title: **Command Center**.

### Trade detail

- Structured sections: Summary → P&L → Entry/Exit → Risk/Reward → Chart → Notes/Tags/Mistakes → Review.
- Mistake tags from Trade Review V2 when available.

### Shared layout

- `frontend/src/components/layout/layoutTokens.ts`: `CARD`, `CARD_COMPACT`, `SECTION_LABEL`, `PAGE_STACK`.
- Review & Analytics uses `PageShell` + sticky tab bar in `CARD` for consistent spacing with V2.

### Interface Mode (Simple / Pro)

**Setting:** Settings → **Interface Mode** (`navMode` in `app-storage`, default **Simple**).

| Mode | Navigation | Review & Analytics tabs | Dashboard widgets |
|------|------------|-------------------------|-------------------|
| **Simple** | Dashboard, Trades, Review & Analytics, Playbook, Settings (+ mobile More: Playbook, Settings) | Overview, Review Queue only | Core widgets only; Pro widgets hidden (marked Pro in customize when Pro enabled) |
| **Pro** | All sections including **Edge Lab**, Capital, Perf OS, Coach, Risk, Market, etc. | All 7 tabs | Full widget customize including intelligence / deep sections |

- Legacy `advanced` persisted value migrates to `pro` on load.
- Pro-only `activeView` in Simple Mode → **ProModeGate** with enable / go-back actions (`ProModeGate.tsx`).
- Sidebar mode toggle removed; single control in Settings.

## Mobile responsiveness (2026-05-31)

Hardening pass — layout only, no new features.

### Global

- **`index.html`**: `viewport-fit=cover` on viewport meta (notch / home-indicator safe areas).
- **`index.css`**: `100dvh` min-height, `overflow-x: clip`, iOS 16px input rule (prevents focus zoom), utility classes:
  - `.app-shell`, `.main-content`, `.page-container`
  - `.scroll-tabs`, `.table-scroll`, `.chart-container`
  - Recharts `min-width: 0` guard
- **`frontend/src/lib/mobileLayout.ts`**: shared class constants + QA viewport list (360×740 … 1280 desktop).

### Shell

- **`App.tsx`**: `app-shell` + `main-content` + scroll region with bottom-nav + safe-area padding.
- **`PageShell`**: uses `PAGE_CONTAINER_CLASS` — `min-w-0`, `max-w-[1400px]`, mobile bottom padding.
- **`Sidebar` / `TopBar`**: safe-area offsets for hamburger, top bar, bottom nav.
- **`ActionsInbox`**: bell `right` respects `safe-area-inset-right`.

### Components

- **`SharedUI` PageHeader**: stacks title/actions on narrow screens; tab bar uses `.scroll-tabs`.
- **`ResponsiveTabs`**, **`BottomSheet`**, **`PullToRefresh`**: width/overflow guards.
- **`layoutTokens`**: `CARD` / `PAGE_STACK` include `min-w-0 max-w-full`.
- **Tables**: `.table-scroll` on Trades table; Reports already scrollable.
- **Charts**: `.chart-container` + Recharts global fix; trade chart uses `dvh` + responsive min-height.
- **Forms**: submit buttons full-width on mobile (`FormComponents`).
- **Settings**: wrapped in `PageShell`; long email truncates.

### Tests

- `frontend/src/test/mobileLayout.test.tsx` — viewport meta, PageShell classes, token guards, QA sizes.

### Manual QA viewports

| Size | Device class |
|------|----------------|
| 360×740 | small Android |
| 390×844 | iPhone 14 |
| 412×915 | Pixel-class Android |
| 430×932 | iPhone 14 Pro Max |
| 768×1024 | tablet |
| 1280×800 | desktop |

Checklist: no horizontal scroll at `initial-scale=1`, bottom nav + FAB + bell non-overlapping, modals/sheets fit height, tabs scroll horizontally.

## Follow-up (not done)

- [ ] URL routes / deep links per tab (e.g. `?tab=equity`).
- [ ] Capital under Settings only in Simple mode.
- [ ] Lazy-load analytics API only for non-queue tabs.
- [ ] Settings toggle to hide Edge Center / Coaching Intel.
- [ ] E2E Playwright: bottom nav + FAB + Actions bell overlap on small screens (manual QA done 2026-05-31; see below).
- [x] Backend: `GET /api/v1/actions/inbox?interface_mode=simple|pro` — aggregates trade reviews, workflow, journal rules, risk, edge priorities; frontend `ActionsInbox` consumes via `useActionsInboxQuery`.

## Mobile QA — Actions bell (2026-05-31)

Tested layout intent for **~390×844 (iPhone)** and **~412×915 (Android)** via CSS tokens + component structure (Vitest/jsdom; manual confirm on device recommended).

| Check | Result |
|-------|--------|
| Bell vertical position | `--actions-bell-bottom-mobile` = nav height + FAB rise + gap + safe-area — sits **above** center FAB, not over Review/More tabs |
| Bell vs bottom nav z-index | Bell `z-45`, nav `z-40` — visible but below modals (`z-100+`) |
| Bell vs trade forms | Hidden when `tradeFormMode !== 'list'` (create/edit/detail) |
| Drawer height / scroll | Mobile `BottomSheet` `flush` + inner `max-h-[min(72dvh,32rem)]`, `overscroll-contain` on list — header/footer fixed, body scrolls |
| FAB overlap | Center FAB unchanged; bell anchored **bottom-right** with extra bottom offset |
| Dark mode | Uses theme tokens (`bg-accent`, `bg-bg-low`, `text-text-*`, `border-border`) — no hardcoded colors |
| Badge | `open_count` from API; cap `9+`; hidden at 0 |

**Copy:** empty = “You're all set” + session message; error = “Couldn't load actions” + retry (no raw stack traces).

**Routing (Simple):** Pro-only targets (`risk`, `edge-center`, `coach`, `perf-os`, pro review tabs) fall back via `navigateActionTarget` + `getSimpleFallbackView` (e.g. risk → dashboard, review pro tab → queue).
- [ ] Remove `analytics` from `ActiveView` type after migration period.

## Verification

```bash
cd frontend && npx tsc --noEmit
cd frontend && npx vitest run
cd backend && python3 -m pytest tests/ -v
```

Manual checks:

1. Sidebar **Review & Analytics** → lands on Review Queue tab.
2. Tabs switch without layout jump; horizontal scroll on narrow screens.
3. Legacy `setActiveView('analytics')` (if any bookmark) → Overview tab.
4. Actions bell sits above bottom nav + FAB (`--actions-bell-bottom-mobile`); drawer scrolls inside sheet.
5. Simple Mode: tapping a Pro-only action routes to allowed fallback (not a blank gate).
