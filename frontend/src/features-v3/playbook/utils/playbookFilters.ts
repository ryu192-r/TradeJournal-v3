import { computeSetupPerformance } from './playbookMetrics'
import type { PlaybookSetupEntry } from './playbookGrouping'

export type PlaybookFilter =
  | 'all'
  | 'active'
  | 'archived'
  | 'untagged'
  | 'profitable'
  | 'losing'
  | 'no-trades'
  | 'needs-review'
  | 'not-enough-data'

export const PLAYBOOK_FILTER_OPTIONS: { value: PlaybookFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
  { value: 'profitable', label: 'Profitable' },
  { value: 'losing', label: 'Losing' },
  { value: 'no-trades', label: 'No trades' },
  { value: 'not-enough-data', label: 'Not enough data' },
  { value: 'needs-review', label: 'Needs review' },
  { value: 'untagged', label: 'Untagged' },
]

const MIN_CLOSED_FOR_DATA = 3

function matchesSearch(entry: PlaybookSetupEntry, query: string): boolean {
  if (!query) return true
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (entry.name.toLowerCase().includes(needle)) return true
  const desc = entry.playbook?.description ?? ''
  return desc.toLowerCase().includes(needle)
}

function matchesFilter(entry: PlaybookSetupEntry, filter: PlaybookFilter): boolean {
  // Untagged-only is its own filter; otherwise hide the untagged bucket from
  // status filters that don't make sense for it.
  if (filter === 'untagged') return entry.origin === 'untagged'
  if (filter === 'all') return true

  if (entry.origin === 'untagged') return false

  if (filter === 'active') {
    return entry.playbook?.is_active === 'active' || entry.origin === 'trade-derived'
  }
  if (filter === 'archived') {
    return entry.playbook?.is_active === 'archived'
  }

  const perf = computeSetupPerformance(entry.trades)

  if (filter === 'no-trades') return perf.totalTrades === 0
  if (filter === 'not-enough-data') return perf.totalTrades > 0 && perf.closedTrades < MIN_CLOSED_FOR_DATA
  if (filter === 'profitable') return perf.closedTrades > 0 && perf.grossPnl > 0
  if (filter === 'losing') return perf.closedTrades > 0 && perf.grossPnl < 0
  if (filter === 'needs-review') return perf.pendingReview > 0

  return true
}

export interface PlaybookFilterState {
  search: string
  filter: PlaybookFilter
}

export function applyPlaybookFilters(
  entries: PlaybookSetupEntry[],
  state: PlaybookFilterState,
): PlaybookSetupEntry[] {
  return entries.filter(
    (entry) => matchesFilter(entry, state.filter) && matchesSearch(entry, state.search),
  )
}
