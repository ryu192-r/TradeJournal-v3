import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { PageHeader } from '@/components/ui/SharedUI'
import { MarketContext } from '@/components/market/MarketContext'
import { MarketRegimeCard } from '@/components/market/MarketRegimePanel'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export function MarketContextPage() {
  const queryClient = useQueryClient()

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['market'] }),
      queryClient.invalidateQueries({ queryKey: ['market-regime'] }),
    ])
  }, [queryClient])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <PageHeader
          title="Market Context"
          subtitle="Compare your trading outcomes with regime, breadth, sector rotation, and live quote quality."
        />
        <MarketRegimeCard />
        <MarketContext />
      </div>
    </PullToRefresh>
  )
}
