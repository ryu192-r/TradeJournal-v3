import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { PageHeader } from '@/components/ui/SharedUI'
import { LifecycleInsights } from '@/components/lifecycle/LifecycleInsights'
import { BehavioralIntelligence } from '@/components/lifecycle/BehavioralIntelligence'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export function LifecyclePage() {
  const queryClient = useQueryClient()

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['lifecycle'] })
  }, [queryClient])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
        <PageHeader
          title="Lifecycle"
          subtitle="Study emotions, discipline, overtrading, and execution quality as one feedback loop."
        />
        <LifecycleInsights />
        <BehavioralIntelligence />
      </div>
    </PullToRefresh>
  )
}
