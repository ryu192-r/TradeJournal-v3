import { useCallback, useState } from 'react'
import type { TradesV3Filters } from '../types'

export const DEFAULT_TRADES_V3_FILTERS: TradesV3Filters = {
  search: '',
  status: 'active',
  direction: 'all',
  period: 'all',
  setup: 'all',
  attention: 'all',
  sort: 'newest',
}

export function useTradesV3Filters() {
  const [filters, setFilters] = useState<TradesV3Filters>(DEFAULT_TRADES_V3_FILTERS)

  const updateFilter = useCallback(<K extends keyof TradesV3Filters>(key: K, value: TradesV3Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_TRADES_V3_FILTERS)
  }, [])

  return {
    filters,
    updateFilter,
    resetFilters,
  }
}
