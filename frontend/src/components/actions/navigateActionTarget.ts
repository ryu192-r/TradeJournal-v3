import type { ActiveView } from '@/app/navigation'
import {
  isReviewAnalyticsTabId,
  storeReviewTab,
  type ReviewAnalyticsTabId,
} from '@/app/reviewAnalytics'
import type { ActionTarget } from '@/types/actionsInbox'

const ALL_REVIEW_TABS: ReviewAnalyticsTabId[] = [
  'overview',
  'mistakes',
  'setups',
  'time',
  'risk',
  'equity',
  'queue',
]

type NavigateHandlers = {
  setActiveView: (view: ActiveView) => void
  openDetailTrade: (id: number) => void
}

function resolveReviewTab(tab: string | undefined): ReviewAnalyticsTabId {
  if (tab && isReviewAnalyticsTabId(tab) && ALL_REVIEW_TABS.includes(tab)) {
    return tab
  }
  return 'queue'
}

function resolveView(view: string | undefined): ActiveView {
  const raw = (view ?? 'dashboard') as ActiveView
  if (raw === 'analytics') return 'review'
  return raw
}

/**
 * Map backend ActionTarget to Zustand view + optional tab/trade.
 */
export function navigateActionTarget(
  target: ActionTarget,
  handlers: NavigateHandlers,
) {
  const tradeId = target.trade_id ?? undefined
  const tab = target.tab ?? undefined
  const view = resolveView(target.view ?? undefined)

  if (tradeId != null) {
    handlers.openDetailTrade(tradeId)
    return
  }

  if (view === 'review' || target.view === 'analytics') {
    const reviewTab = resolveReviewTab(
      target.view === 'analytics' ? 'overview' : tab,
    )
    storeReviewTab(reviewTab)
    handlers.setActiveView('review')
    return
  }

  handlers.setActiveView(view)
}
