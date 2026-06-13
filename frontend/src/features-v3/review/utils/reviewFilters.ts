import type { ApiTrade } from '@/types'
import { isDeletedTrade, getTradeGrossPnl, hasMissingSetup } from '../../trades/utils/tradesV3Metrics'
import { tradeMatchesPeriod } from '../../trades/utils/tradesV3Filters'
import { isReviewable, isReviewed } from './reviewStatus'

export type ReviewFilter = 'pending' | 'reviewed' | 'today' | 'week' | 'winners' | 'losers' | 'untagged' | 'unclassified'

export const REVIEW_FILTER_OPTIONS: { value: ReviewFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'unclassified', label: 'Unclassified' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'winners', label: 'Winners' },
  { value: 'losers', label: 'Losers' },
  { value: 'untagged', label: 'Untagged setup' },
]

/** Reviewable (closed, non-deleted) trades only, filtered. */
export function filterReviewTrades(trades: ApiTrade[], filter: ReviewFilter, todayKey?: string): ApiTrade[] {
  const reviewable = trades.filter((t) => !isDeletedTrade(t) && isReviewable(t))
  return reviewable.filter((t) => {
    switch (filter) {
      case 'pending': return !isReviewed(t)
      case 'reviewed': return isReviewed(t)
      case 'today': return tradeMatchesPeriod(t, 'today', todayKey)
      case 'week': return tradeMatchesPeriod(t, 'week', todayKey)
      case 'winners': return (getTradeGrossPnl(t) ?? 0) > 0
      case 'losers': return (getTradeGrossPnl(t) ?? 0) < 0
      case 'untagged': return hasMissingSetup(t)
      case 'unclassified': return t.entry_context == null
      default: return true
    }
  })
}

export interface ReviewSummary {
  pending: number
  reviewed: number
  unclassified: number
  total: number
}

export function summarizeReview(trades: ApiTrade[]): ReviewSummary {
  const reviewable = trades.filter((t) => !isDeletedTrade(t) && isReviewable(t))
  const reviewed = reviewable.filter(isReviewed).length
  const unclassified = reviewable.filter((t) => t.entry_context == null).length
  return { pending: reviewable.length - reviewed, reviewed, unclassified, total: reviewable.length }
}
