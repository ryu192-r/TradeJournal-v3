import { useRecommendationSummaryQuery } from '@/hooks/useRecommendationsQuery'
import { CardSkeleton } from '@/components/ui/StateComponents'
import { Lightbulb, Ban, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

interface SummaryStripItemProps {
  icon: typeof TrendingUp
  label: string
  items: string[]
  color: string
  emptyText?: string
}

function SummaryStripItem({ icon: Icon, label, items, color, emptyText }: SummaryStripItemProps) {
  return (
    <div className={cn(CARD, 'flex-1 min-w-0')}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${color}`} />
        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', color)}>{label}</span>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.slice(0, 2).map((item, i) => (
            <li key={i} className="flex items-start gap-1 text-xs text-text-heading">
              <span className={`w-1 h-1 rounded-full ${color} mt-1.5 shrink-0`} />
              <span className="truncate">{item}</span>
            </li>
          ))}
        </ul>
      ) : emptyText ? (
        <div className="text-xs text-text-muted">{emptyText}</div>
      ) : null}
    </div>
  )
}

export function RecommendationSummaryStrip() {
  const { data, isLoading, error } = useRecommendationSummaryQuery()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <CardSkeleton key={i} height="h-16" />)}
      </div>
    )
  }

  if (error || !data) return null

  const hasAny = data.strengths.length > 0 || data.risks.length > 0 ||
    data.focus_this_week.length > 0 || data.avoid_this_week.length > 0

  if (!hasAny) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <SummaryStripItem
        icon={TrendingUp}
        label="Strengths"
        items={data.strengths}
        color="text-profit"
        emptyText="Building data"
      />
      <SummaryStripItem
        icon={TrendingDown}
        label="Risks"
        items={data.risks}
        color="text-loss"
        emptyText="No major risks"
      />
      <SummaryStripItem
        icon={Lightbulb}
        label="Focus"
        items={data.focus_this_week}
        color="text-accent"
        emptyText="Keep trading"
      />
      <SummaryStripItem
        icon={Ban}
        label="Avoid"
        items={data.avoid_this_week}
        color="text-gold"
        emptyText="Clear"
      />
    </div>
  )
}
