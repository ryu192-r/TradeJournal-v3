import { useState, useCallback } from 'react'
import { useRecommendationDashboardQuery } from '@/hooks/useRecommendationsQuery'
import { RecommendationCard } from './RecommendationCard'
import { EmptyState, ErrorState, CardSkeleton } from '@/components/ui/StateComponents'
import {
  TrendingUp, TrendingDown, Lightbulb, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function SummaryCard({ icon: Icon, label, items, color }: {
  icon: typeof TrendingUp
  label: string
  items: string[]
  color: string
}) {
  if (items.length === 0) return null
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className={cn('text-xs font-semibold', color)}>{label}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-text-heading">
            <span className={`w-1.5 h-1.5 rounded-full ${color} mt-1.5 shrink-0`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RecommendationDashboard() {
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')

  const { data, isLoading, error, refetch } = useRecommendationDashboardQuery(
    periodStart || undefined,
    periodEnd || undefined,
  )

  const handlePeriodApply = useCallback(() => {
    refetch()
  }, [refetch])

  if (isLoading || (!data && !error)) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <CardSkeleton key={i} height="h-28" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        title="Recommendations failed to load"
        message={(error as Error)?.message || 'Something went wrong.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        message="Trade consistently and add journal data to unlock personalized recommendations."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className={CARD}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted">From:</label>
            <input
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              className="bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-heading font-data"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted">To:</label>
            <input
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              className="bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-heading font-data"
            />
          </div>
          <button
            onClick={handlePeriodApply}
            className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors cursor-pointer"
          >
            Apply
          </button>
          <span className="text-[10px] text-text-muted font-data ml-auto">
            {data.total_trades} trades, {data.closed_trades} closed
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={TrendingUp} label="Strengths" items={data.summary.strengths} color="text-profit" />
        <SummaryCard icon={TrendingDown} label="Risks" items={data.summary.risks} color="text-loss" />
        <SummaryCard icon={Lightbulb} label="Focus This Week" items={data.summary.focus_this_week} color="text-accent" />
        <SummaryCard icon={Ban} label="Avoid This Week" items={data.summary.avoid_this_week} color="text-gold" />
      </div>

      {/* Recommendations list */}
      <div className="space-y-3">
        {data.recommendations.map((rec) => (
          <RecommendationCard key={rec.id} recommendation={rec} />
        ))}
      </div>
    </div>
  )
}
