import type { ApiTrade } from '@/types'
import { isClosedTradeV3, isDeletedTrade } from '../../trades/utils/tradesV3Metrics'

export type ReviewStatus = 'reviewed' | 'pending' | 'not_applicable'

/** A trade is reviewed when it has review notes. */
export function isReviewed(trade: ApiTrade): boolean {
  return Boolean(trade.review_notes?.trim())
}

/** Review applies to closed (non-deleted) trades. Open trades are not yet reviewable. */
export function isReviewable(trade: ApiTrade): boolean {
  return isClosedTradeV3(trade) && !isDeletedTrade(trade)
}

export function getReviewStatus(trade: ApiTrade): ReviewStatus {
  if (!isReviewable(trade)) return 'not_applicable'
  return isReviewed(trade) ? 'reviewed' : 'pending'
}

export function getReviewStatusLabel(status: ReviewStatus): string {
  switch (status) {
    case 'reviewed': return 'Reviewed'
    case 'pending': return 'Pending'
    default: return 'Not applicable'
  }
}
