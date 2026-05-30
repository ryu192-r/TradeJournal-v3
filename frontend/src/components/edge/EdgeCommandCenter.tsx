import { useEdgeCommandCenterQuery } from '@/hooks/useEdgeCommandCenterQuery'
import { Card } from '@/components/ui/Card'
import { PageHeader, SectionTitle } from '@/components/ui/SharedUI'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { EdgePriorityCard } from './EdgePriorityCard'
import { EdgeSetupFocusCard } from './EdgeSetupFocusCard'
import { EdgeReviewQueue } from './EdgeReviewQueue'
import { EdgeWorkflowCard } from './EdgeWorkflowCard'
import { EdgeDataQualityCard } from './EdgeDataQualityCard'

function SummaryStrip({ title, items, tone }: { title: string; items: string[]; tone?: 'loss' | 'profit' | 'default' }) {
  if (items.length === 0) return null
  const toneClass =
    tone === 'loss' ? 'border-loss/20 bg-loss-muted/5' :
    tone === 'profit' ? 'border-profit/20 bg-profit-muted/5' :
    'border-border bg-bg-elevated/20'
  return (
    <div className={`rounded-xl border p-3 min-w-0 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">{title}</p>
      <ul className="text-[length:var(--text-xs)] text-text space-y-1">
        {items.map((item, i) => (
          <li key={i} className="break-words">• {item}</li>
        ))}
      </ul>
    </div>
  )
}

export function EdgeCommandCenter() {
  const { data, isLoading, error, refetch } = useEdgeCommandCenterQuery()

  if (isLoading && !data) {
    return <LoadingState variant="page" />
  }

  if (error && !data) {
    return (
      <ErrorState
        title="Edge Command Center unavailable"
        message={(error as Error).message || 'Could not load unified intelligence.'}
        onRetry={() => refetch()}
      />
    )
  }

  if (!data) {
    return <EmptyState title="No command center data" message="Try again in a moment." />
  }

  return (
    <div className="space-y-[var(--page-gap)] min-w-0 overflow-x-hidden">
      <PageHeader
        title="Edge Command Center"
        subtitle="What to focus on, avoid, and review — composed from your trading data"
      />

      <Card className="border-accent/20 bg-accent/5">
        <p className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Today</p>
        <h2 className="text-lg font-display font-medium text-text-heading break-words">{data.headline}</h2>
        <p className="text-[length:var(--text-sm)] text-text-muted mt-2 break-words">{data.primary_focus}</p>
        <p className="text-[length:var(--text-sm)] font-medium text-accent mt-3 break-words">
          Next: {data.next_best_action}
        </p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <SummaryStrip title="Focus today" items={data.summary.focus_today} tone="profit" />
        <SummaryStrip title="Avoid today" items={data.summary.avoid_today} tone="loss" />
        <SummaryStrip title="Review today" items={data.summary.review_today} />
        <SummaryStrip title="Risk warnings" items={data.summary.risk_warnings} tone="loss" />
      </div>

      {data.priorities.length > 0 && (
        <section className="min-w-0">
          <SectionTitle title="Priorities" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {data.priorities.map((p) => (
              <EdgePriorityCard key={p.id} priority={p} />
            ))}
          </div>
        </section>
      )}

      {data.setup_focus.length > 0 && (
        <section className="min-w-0">
          <SectionTitle title="Setup focus" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {data.setup_focus.map((s) => (
              <EdgeSetupFocusCard key={s.setup} item={s} />
            ))}
          </div>
        </section>
      )}

      <section className="min-w-0">
        <SectionTitle title="Review queue" />
        <div className="mt-2">
          <EdgeReviewQueue items={data.review_queue} />
        </div>
      </section>

      {data.workflow && (
        <section className="min-w-0">
          <SectionTitle title="Workflow" />
          <div className="mt-2">
            <EdgeWorkflowCard workflow={data.workflow} />
          </div>
        </section>
      )}

      <EdgeDataQualityCard quality={data.data_quality} />
    </div>
  )
}
