import type { ActiveView, NavMode } from '@/app/navigation'
import { isViewVisibleInMode, viewMeta } from '@/app/navigation'
import type { ReviewAnalyticsTabId } from '@/app/reviewAnalytics'

/** User-facing labels; stored value is NavMode */
export function interfaceModeLabel(mode: NavMode): string {
  return mode === 'simple' ? 'Simple Mode' : 'Pro Mode'
}

export function isProMode(mode: NavMode): boolean {
  return mode === 'pro'
}

/** Views only available in Pro Mode */
export const PRO_ONLY_VIEWS = new Set<ActiveView>([
  'analytics',
  'ideas',
  'calendar',
  'capital',
  'perf-os',
  'journal',
  'sa-notes',
  'reports',
  'coach',
  'lifecycle',
  'risk',
  'market',
  'recommendations',
  'coaching-intelligence',
  'edge-center',
])

export function canAccessView(view: ActiveView, mode: NavMode): boolean {
  if (view === 'analytics') return mode === 'pro'
  return isViewVisibleInMode(view, mode)
}

export function getSimpleFallbackView(view: ActiveView): ActiveView {
  if (isViewVisibleInMode(view, 'simple')) return view === 'analytics' ? 'review' : view
  const map: Partial<Record<ActiveView, ActiveView>> = {
    analytics: 'review',
    ideas: 'trades',
    calendar: 'trades',
    capital: 'settings',
    coach: 'review',
    'perf-os': 'review',
    journal: 'review',
    'sa-notes': 'review',
    reports: 'review',
    lifecycle: 'review',
    risk: 'dashboard',
    market: 'dashboard',
    recommendations: 'dashboard',
    'coaching-intelligence': 'dashboard',
    'edge-center': 'dashboard',
  }
  return map[view] ?? 'dashboard'
}

export type DashboardWidgetId =
  | 'kpis'
  | 'performance'
  | 'actions'
  | 'recent'
  | 'open'
  | 'alerts'
  | 'edge'
  | 'equity'
  | 'live'
  | 'workflow'
  | 'risk'
  | 'intelstrip'
  | 'intelligence'
  | 'deep'

export const PRO_DASHBOARD_WIDGETS = new Set<DashboardWidgetId>([
  'alerts',
  'edge',
  'equity',
  'live',
  'workflow',
  'risk',
  'intelstrip',
  'intelligence',
  'deep',
])

export function isProDashboardWidget(id: DashboardWidgetId): boolean {
  return PRO_DASHBOARD_WIDGETS.has(id)
}

export const SIMPLE_REVIEW_ANALYTICS_TABS: ReviewAnalyticsTabId[] = ['overview', 'queue']

export const PRO_REVIEW_ANALYTICS_TABS: ReviewAnalyticsTabId[] = [
  'overview',
  'mistakes',
  'setups',
  'time',
  'risk',
  'equity',
  'queue',
]

export function reviewTabsForMode(mode: NavMode): ReviewAnalyticsTabId[] {
  return isProMode(mode) ? PRO_REVIEW_ANALYTICS_TABS : SIMPLE_REVIEW_ANALYTICS_TABS
}

export function viewLabel(view: ActiveView): string {
  return viewMeta[view]?.label ?? view
}

/** Normalize legacy persisted navMode */
export function normalizeNavMode(raw: unknown): NavMode {
  if (raw === 'pro' || raw === 'advanced') return 'pro'
  return 'simple'
}
