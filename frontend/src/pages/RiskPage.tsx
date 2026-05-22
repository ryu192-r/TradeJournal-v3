import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { PageHeader } from '@/components/ui/SharedUI'
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/StateComponents'
import { RiskCommandCenter } from '@/components/risk/RiskCommandCenter'
import { useRiskDashboardQuery } from '@/hooks/useRiskDashboardQuery'
import { Shield } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export function RiskPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useRiskDashboardQuery()

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['risk-dashboard'] })
  }, [queryClient])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <PageHeader
          title="Risk"
          subtitle="Review portfolio heat, stop coverage, and concentration before you add new exposure."
        />

        {isLoading ? <CardSkeleton height="h-[28rem]" /> : null}
        {!isLoading && error ? (
          <ErrorState
            title="Risk dashboard failed to load"
            message={(error as Error).message || 'Something went wrong loading risk data.'}
            onRetry={handleRefresh}
          />
        ) : null}
        {!isLoading && !error && data == null ? (
          <EmptyState
            icon={Shield}
            title="No risk data yet"
            message="Create an account and open trades to see live risk coverage and exposure warnings."
          />
        ) : null}
        {!isLoading && !error && data ? <RiskCommandCenter data={data} /> : null}
      </div>
    </PullToRefresh>
  )
}
