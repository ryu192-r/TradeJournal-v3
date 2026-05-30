import { RecommendationDashboard } from '@/components/recommendations/RecommendationDashboard'
import { PageHeader } from '@/components/ui/SharedUI'
import { useAppStore } from '@/store/appStore'
import { Sparkles } from 'lucide-react'

export function RecommendationsPage() {
  const setActiveView = useAppStore((s) => s.setActiveView)

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
      <PageHeader
        title="Trading Intelligence"
        subtitle="Actionable recommendations based on your trading data"
        right={
          <button
            type="button"
            onClick={() => setActiveView('coaching-intelligence')}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-accent/20 bg-accent-muted px-3 py-2 text-[10px] font-data text-accent hover:border-accent/30 hover:bg-accent-muted/70 transition-all cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            Coaching Intel
          </button>
        }
      />
      <RecommendationDashboard />
    </div>
  )
}
