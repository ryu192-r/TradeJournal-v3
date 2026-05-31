import type { ActiveView, NavMode } from '@/app/navigation'
import {
  canAccessView,
  getSimpleFallbackView,
  reviewTabsForMode,
} from '@/app/interfaceMode'
import {
  isReviewAnalyticsTabId,
  storeReviewTab,
  type ReviewAnalyticsTabId,
} from '@/app/reviewAnalytics'
import type { ActionTarget } from '@/types/actionsInbox'

type NavigateHandlers = {
  setActiveView: (view: ActiveView) => void
  openDetailTrade: (id: number) => void
}

function resolveReviewTab(tab: string | undefined, navMode: NavMode): ReviewAnalyticsTabId {
  const allowed = reviewTabsForMode(navMode)
  if (tab && isReviewAnalyticsTabId(tab) && allowed.includes(tab)) {
    return tab
  }
  return allowed.includes('queue') ? 'queue' : allowed[0] ?? 'overview'
}

function resolveView(view: string | undefined, navMode: NavMode): ActiveView {
  const raw = (view ?? 'dashboard') as ActiveView
  if (raw === 'analytics') {
    return 'review'
  }
  if (canAccessView(raw, navMode)) {
    return raw
  }
  return getSimpleFallbackView(raw)
}

/**
 * Map backend ActionTarget to Zustand view + optional tab/trade.
 * Pro-only views fall back safely in Simple Mode (e.g. risk → dashboard).
 */
export function navigateActionTarget(
  target: ActionTarget,
  handlers: NavigateHandlers,
  navMode: NavMode = 'simple'
) {
  const tradeId = target.trade_id ?? undefined
  const tab = target.tab ?? undefined
  const view = resolveView(target.view ?? undefined, navMode)

  if (tradeId != null) {
    handlers.openDetailTrade(tradeId)
    return
  }

  if (view === 'review' || target.view === 'analytics') {
    const reviewTab = resolveReviewTab(
      target.view === 'analytics' ? 'overview' : tab,
      navMode
    )
    storeReviewTab(reviewTab)
    handlers.setActiveView('review')
    return
  }

  handlers.setActiveView(view)
}
