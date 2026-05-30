import { useMemo } from 'react'
import { ArrowRight, Brain, CheckCircle2, ListChecks, Sparkles } from 'lucide-react'
import { useCoachingIntelligenceDashboardQuery } from '@/hooks/useCoachingIntelligenceQuery'
import { PageShell } from '@/components/layout/PageShell'
import { Card } from '@/components/ui/Card'
import { PageHeader, SectionTitle } from '@/components/ui/SharedUI'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { BehavioralDriftCard } from '@/components/coaching/BehavioralDriftCard'
import { SetupConfidenceCard } from '@/components/coaching/SetupConfidenceCard'
import { TradeReviewPromptCard } from '@/components/coaching/TradeReviewPromptCard'
import { WeeklyCoachingPlanCard } from '@/components/coaching/WeeklyCoachingPlanCard'

export function CoachingIntelligencePage() {
  const { data, isLoading, error, refetch } = useCoachingIntelligenceDashboardQuery()

  const nextBestActions = useMemo(() => data?.next_best_actions ?? [], [data?.next_best_actions])

  if (isLoading && !data) {
    return (
      <PageShell>
        <PageHeader title="Coaching Intelligence" subtitle="Weekly coaching built from recommendations, trade history, and journal behavior" />
        <LoadingState variant="page" />
      </PageShell>
    )
  }

  if (error && !data) {
    return (
      <PageShell>
        <PageHeader title="Coaching Intelligence" subtitle="Weekly coaching built from recommendations, trade history, and journal behavior" />
        <ErrorState
          title="Coaching intelligence failed to load"
          message={(error as Error)?.message || 'Could not load adaptive coaching data.'}
          onRetry={() => refetch()}
        />
      </PageShell>
    )
  }

  if (!data || !data.weekly_plan) {
    return (
      <PageShell>
        <PageHeader title="Coaching Intelligence" subtitle="Weekly coaching built from recommendations, trade history, and journal behavior" />
        <EmptyState
          title="No coaching data yet"
          message="Close more trades, add journal entries, and grade executions to unlock coaching guidance."
        />
      </PageShell>
    )
  }

  const plan = data.weekly_plan

  return (
    <PageShell className="space-y-[var(--page-gap)]">
      <PageHeader
        title="Coaching Intelligence"
        subtitle="Deterministic weekly coaching from recommendations, setups, drift, and reviews"
        right={
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-[10px] font-data text-text-muted">
            <Brain className="h-3 w-3 text-accent" />
            Generated {plan.generated_at.slice(0, 19).replace('T', ' ')}
          </div>
        }
      />

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Headline</div>
            <div className="text-base font-medium text-text-heading">{plan.headline}</div>
            <div className="mt-1 text-sm text-text-muted">{plan.primary_focus}</div>
          </div>
          <div className="shrink-0 rounded-xl border border-accent/20 bg-accent-muted/10 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-wider text-text-faint">Week</div>
            <div className="text-sm font-data text-accent">{plan.week_start} → {plan.week_end}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-2">
        <div className="space-y-[var(--page-gap)]">
          <SectionTitle icon={Sparkles} title="Weekly Coaching Plan" />
          <WeeklyCoachingPlanCard plan={plan} />
        </div>
        <div className="space-y-[var(--page-gap)]">
          <SectionTitle icon={ListChecks} title="Next Best Actions" />
          <Card>
            {nextBestActions.length > 0 ? (
              <div className="space-y-2">
                {nextBestActions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-xl border border-border bg-bg-elevated/40 p-3">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                    <div className="text-sm text-text">{action}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-text-muted">No actions yet. Close more trades to unlock a plan.</div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-[var(--page-gap)] xl:grid-cols-2">
        <div className="space-y-[var(--page-gap)]">
          <SectionTitle icon={CheckCircle2} title="Setup Confidence Scores" />
          {data.setup_scores.length > 0 ? (
            <SetupConfidenceCard scores={data.setup_scores} />
          ) : (
            <EmptyState
              compact
              title="No setup scores yet"
              message="Close more trades with a consistent setup label to unlock confidence scoring."
            />
          )}
        </div>
        <div className="space-y-[var(--page-gap)]">
          <SectionTitle icon={Brain} title="Behavioral Drift" />
          {data.behavioral_drift.length > 0 ? (
            <BehavioralDriftCard signals={data.behavioral_drift} />
          ) : (
            <EmptyState
              compact
              title="No drift signals"
              message="Rolling windows from server UTC now (last 30d vs prior 90d). Not tied to setup date filters."
            />
          )}
        </div>
      </div>

      <div className="space-y-[var(--page-gap)]">
        <SectionTitle icon={Sparkles} title="Trade Review Prompts" />
        {data.top_trade_review_prompts.length > 0 ? (
          <TradeReviewPromptCard prompts={data.top_trade_review_prompts} />
        ) : (
          <EmptyState
            compact
            title="No review prompts yet"
            message="More closed trades and execution grades will surface the trades worth reviewing."
          />
        )}
      </div>
    </PageShell>
  )
}
