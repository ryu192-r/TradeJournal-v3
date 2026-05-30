import { RecommendationDashboard } from '@/components/recommendations/RecommendationDashboard'
import { PageHeader } from '@/components/ui/SharedUI'

export function RecommendationsPage() {
  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
      <PageHeader
        title="Trading Intelligence"
        subtitle="Actionable recommendations based on your trading data"
      />
      <RecommendationDashboard />
    </div>
  )
}
