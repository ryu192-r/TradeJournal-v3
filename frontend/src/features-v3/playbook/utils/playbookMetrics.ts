import type { ApiTrade } from '@/types'
import {
  getTradeGrossPnl,
  getTradeRMultiple,
  isClosedTradeV3,
  isDeletedTrade,
} from '../../trades/utils/tradesV3Metrics'
import { isReviewable, isReviewed } from '../../review/utils/reviewStatus'
import { getTradeSessionDate } from '@/utils/tradeDates'
import type { PlaybookSetupEntry } from './playbookGrouping'

// ──────────────────────────────────────────────────────────────
//  Per-setup performance metrics
// ──────────────────────────────────────────────────────────────

export interface SetupPerformance {
  totalTrades: number
  closedTrades: number
  openTrades: number
  /** Gross P&L (pnl + fees) summed across closed, non-deleted trades. */
  grossPnl: number
  /** Win % across closed trades with a numeric pnl. null when none. */
  winRate: number | null
  /** Mean R across closed trades with an r_multiple. null when none. */
  avgR: number | null
  bestTrade: number | null
  worstTrade: number | null
  reviewedCount: number
  pendingReview: number
  /** ISO date (YYYY-MM-DD) of most recent session date with a trade. null when none. */
  lastTradedDate: string | null
}

const EMPTY_PERFORMANCE: SetupPerformance = {
  totalTrades: 0,
  closedTrades: 0,
  openTrades: 0,
  grossPnl: 0,
  winRate: null,
  avgR: null,
  bestTrade: null,
  worstTrade: null,
  reviewedCount: 0,
  pendingReview: 0,
  lastTradedDate: null,
}

export function computeSetupPerformance(trades: ApiTrade[]): SetupPerformance {
  const live = trades.filter((t) => !isDeletedTrade(t))
  if (live.length === 0) return { ...EMPTY_PERFORMANCE }

  const closed = live.filter(isClosedTradeV3)
  const open = live.filter((t) => !isClosedTradeV3(t))

  const pnls = closed.map(getTradeGrossPnl).filter((v): v is number => v != null)
  const wins = pnls.filter((p) => p > 0).length
  const rs = closed.map(getTradeRMultiple).filter((v): v is number => v != null)

  const reviewable = closed.filter(isReviewable)
  const reviewedCount = reviewable.filter(isReviewed).length

  const dates = live
    .map((t) => getTradeSessionDate(t))
    .filter((d): d is string => Boolean(d))
    .sort()
  const lastTradedDate = dates.length > 0 ? dates[dates.length - 1] : null

  return {
    totalTrades: live.length,
    closedTrades: closed.length,
    openTrades: open.length,
    grossPnl: pnls.reduce((a, b) => a + b, 0),
    winRate: pnls.length > 0 ? (wins / pnls.length) * 100 : null,
    avgR: rs.length > 0 ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : null,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : null,
    reviewedCount,
    pendingReview: reviewable.length - reviewedCount,
    lastTradedDate,
  }
}

// ──────────────────────────────────────────────────────────────
//  Library-level summary (header metrics)
// ──────────────────────────────────────────────────────────────

export interface SetupLibrarySummary {
  totalSetups: number
  activeSetups: number
  archivedSetups: number
  untaggedTrades: number
  bestSetupName: string | null
  bestSetupGrossPnl: number | null
  worstSetupName: string | null
  worstSetupGrossPnl: number | null
}

export function summarizeLibrary(entries: PlaybookSetupEntry[]): SetupLibrarySummary {
  const playbookEntries = entries.filter((e) => e.origin === 'playbook')
  const totalSetups = entries.filter((e) => e.origin !== 'untagged').length
  const activeSetups = playbookEntries.filter((e) => e.playbook?.is_active === 'active').length
  const archivedSetups = playbookEntries.filter((e) => e.playbook?.is_active === 'archived').length
  const untagged = entries.find((e) => e.origin === 'untagged')

  // Build (name, grossPnl) for entries with at least one closed trade.
  const ranked: { name: string; grossPnl: number }[] = []
  for (const entry of entries) {
    const perf = computeSetupPerformance(entry.trades)
    if (perf.closedTrades === 0) continue
    ranked.push({ name: entry.name, grossPnl: perf.grossPnl })
  }
  ranked.sort((a, b) => b.grossPnl - a.grossPnl)

  const best = ranked.length > 0 ? ranked[0] : null
  const worst = ranked.length > 0 ? ranked[ranked.length - 1] : null
  // Avoid reporting the same setup as both best and worst when only one ranks.
  const showWorst = ranked.length >= 2 ? worst : null

  return {
    totalSetups,
    activeSetups,
    archivedSetups,
    untaggedTrades: untagged?.trades.length ?? 0,
    bestSetupName: best?.name ?? null,
    bestSetupGrossPnl: best?.grossPnl ?? null,
    worstSetupName: showWorst?.name ?? null,
    worstSetupGrossPnl: showWorst?.grossPnl ?? null,
  }
}

// ──────────────────────────────────────────────────────────────
//  Review insights for a setup
// ──────────────────────────────────────────────────────────────

export interface ReviewTagCount {
  tag: string
  count: number
}

export interface ReviewExcerpt {
  tradeId: number
  symbol: string
  sessionDate: string | null
  excerpt: string
}

export interface SetupReviewInsights {
  reviewedCount: number
  pendingCount: number
  topTags: ReviewTagCount[]
  recentNotes: ReviewExcerpt[]
}

const MAX_TOP_TAGS = 6
const MAX_RECENT_NOTES = 5
const EXCERPT_MAX_CHARS = 200

function buildExcerpt(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= EXCERPT_MAX_CHARS) return trimmed
  return trimmed.slice(0, EXCERPT_MAX_CHARS - 1).trimEnd() + '…'
}

export function computeReviewInsights(trades: ApiTrade[]): SetupReviewInsights {
  const live = trades.filter((t) => !isDeletedTrade(t))
  const reviewable = live.filter(isReviewable)
  const reviewedCount = reviewable.filter(isReviewed).length

  // Tag counts across all reviewed trades' review_tags
  const tagCounts = new Map<string, number>()
  for (const trade of reviewable) {
    if (!isReviewed(trade)) continue
    const tags = trade.review_tags ?? []
    for (const raw of tags) {
      const tag = raw?.trim()
      if (!tag) continue
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const topTags = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, MAX_TOP_TAGS)

  // Recent review notes excerpts (from reviewed trades, sorted by session date desc)
  const recent = reviewable
    .filter((t) => isReviewed(t) && t.review_notes && t.review_notes.trim().length > 0)
    .map((t) => ({
      tradeId: t.id,
      symbol: t.symbol,
      sessionDate: getTradeSessionDate(t),
      excerpt: buildExcerpt(t.review_notes ?? ''),
    }))
    .sort((a, b) => {
      const aKey = a.sessionDate ?? ''
      const bKey = b.sessionDate ?? ''
      if (aKey === bKey) return b.tradeId - a.tradeId
      return bKey.localeCompare(aKey)
    })
    .slice(0, MAX_RECENT_NOTES)

  return {
    reviewedCount,
    pendingCount: reviewable.length - reviewedCount,
    topTags,
    recentNotes: recent,
  }
}
