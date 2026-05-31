export type ReviewAnalyticsTabId =
  | 'overview'
  | 'mistakes'
  | 'setups'
  | 'time'
  | 'risk'
  | 'equity'
  | 'queue'

export const REVIEW_ANALYTICS_TAB_KEY = 'tjv3-review-analytics-tab-v1'

export const REVIEW_ANALYTICS_TABS: Array<{ id: ReviewAnalyticsTabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'mistakes', label: 'Mistakes' },
  { id: 'setups', label: 'Setups' },
  { id: 'time', label: 'Time Analysis' },
  { id: 'risk', label: 'Risk / R:R' },
  { id: 'equity', label: 'Equity Curve' },
  { id: 'queue', label: 'Review Queue' },
]

export function isReviewAnalyticsTabId(value: string): value is ReviewAnalyticsTabId {
  return REVIEW_ANALYTICS_TABS.some((t) => t.id === value)
}

export function readStoredReviewTab(): ReviewAnalyticsTabId | null {
  try {
    const raw = sessionStorage.getItem(REVIEW_ANALYTICS_TAB_KEY)
    if (raw && isReviewAnalyticsTabId(raw)) return raw
  } catch {
    /* ignore */
  }
  return null
}

export function storeReviewTab(tab: ReviewAnalyticsTabId) {
  try {
    sessionStorage.setItem(REVIEW_ANALYTICS_TAB_KEY, tab)
  } catch {
    /* ignore */
  }
}
