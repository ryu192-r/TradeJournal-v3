import { useState } from 'react'
import {
  Badge, EmptyState, ErrorState, Grid, LoadingState, MetricCard,
  MoneyValue, Page, Panel, PercentValue, Stack, Value,
} from '@/new-ui'
import { useEmotionSummaryQuery, useGradeSummaryQuery, useBehavioralAnalyticsQuery, useRevengeTradesQuery } from '@/hooks/useLifecycleAnalyticsQuery'
import { useOvertradingQuery, useEarlyExitQuery, useDisciplineScoreQuery } from '@/hooks/useBehavioralIntelligenceQuery'
import type {
  EmotionSummaryResponse, GradeSummaryResponse, BehavioralAnalyticsResponse,
  OvertradingResponse, EarlyExitResponse, DisciplineScoreResponse,
} from '@/types'
import './lifecycle.css'

type Tab = 'emotions' | 'grades' | 'behavioral' | 'discipline'

const TABS: { id: Tab; label: string }[] = [
  { id: 'emotions', label: 'Emotions' },
  { id: 'grades', label: 'Grades' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'discipline', label: 'Discipline' },
]

export function LifecycleV3Page() {
  const [tab, setTab] = useState<Tab>('emotions')

  return (
    <Page
      title="Lifecycle"
      subtitle="Emotions, execution grades, behavioral patterns, and discipline scoring."
    >
      <Stack gap="lg">
        <div className="tjv3-lc__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tjv3-lc__tab${tab === t.id ? ' tjv3-lc__tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'emotions' && <EmotionsTab />}
        {tab === 'grades' && <GradesTab />}
        {tab === 'behavioral' && <BehavioralTab />}
        {tab === 'discipline' && <DisciplineTab />}
      </Stack>
    </Page>
  )
}

function EmotionsTab() {
  const { data, isLoading, error } = useEmotionSummaryQuery()
  const revenge = useRevengeTradesQuery()

  if (isLoading) return <LoadingState label="Loading emotions…" />
  if (error) return <ErrorState title="Emotion data unavailable" description={(error as Error).message} />
  if (!data || data.total_logs === 0) return <EmptyState title="No emotion logs" description="Log emotions on trades to see patterns." />

  const d = data as EmotionSummaryResponse

  return (
    <Stack gap="md">
      <Grid minColumnWidth="9rem">
        <MetricCard label="Total logs" value={<Value value={String(d.total_logs)} />} />
        <MetricCard label="Most frequent" value={<Value value={d.most_frequent ?? '—'} />} />
        <MetricCard label="Worst performing" value={<Value value={d.worst_performing ?? '—'} tone={d.worst_performing ? 'loss' : 'neutral'} />} />
      </Grid>

      <Panel title="Emotion breakdown">
        {d.emotions.length === 0 ? (
          <EmptyState title="No data" description="" />
        ) : (
          <table className="tjv3-lc__table">
            <thead><tr><th>Emotion</th><th>Count</th><th>Total P&L</th><th>Win %</th></tr></thead>
            <tbody>
              {d.emotions.map((e) => (
                <tr key={e.emotion}>
                  <td>{e.emotion}</td>
                  <td>{e.count}</td>
                  <td><MoneyValue value={e.total_pnl} tone="auto" compact /></td>
                  <td><PercentValue value={e.win_rate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {revenge.data && revenge.data.total_flagged > 0 && (
        <Panel title="Revenge trades" description={`${revenge.data.total_flagged} trades flagged`}>
          <Grid minColumnWidth="9rem">
            <MetricCard label="Flagged" value={<Value value={String(revenge.data.total_flagged)} tone="warning" />} />
            <MetricCard label="Avg P&L (revenge)" value={<MoneyValue value={revenge.data.avg_pnl_flagged} tone="auto" />} />
            <MetricCard label="Avg P&L (normal)" value={<MoneyValue value={revenge.data.avg_pnl_unflagged} tone="auto" />} />
          </Grid>
        </Panel>
      )}
    </Stack>
  )
}

function GradesTab() {
  const { data, isLoading, error } = useGradeSummaryQuery()

  if (isLoading) return <LoadingState label="Loading grades…" />
  if (error) return <ErrorState title="Grade data unavailable" description={(error as Error).message} />
  if (!data) return <EmptyState title="No grade data" description="Grade executions on trades to unlock this." />

  const d = data as GradeSummaryResponse

  return (
    <Stack gap="md">
      <Grid minColumnWidth="9rem">
        <MetricCard label="Avg overall" value={<Value value={d.avg_overall != null ? d.avg_overall.toFixed(1) : '—'} />} />
        {Object.entries(d.dimension_averages).map(([dim, avg]) => (
          <MetricCard key={dim} label={dim.replace(/_/g, ' ')} value={<Value value={avg != null ? avg.toFixed(1) : '—'} />} compact />
        ))}
      </Grid>

      {d.grade_pnl.length > 0 && (
        <Panel title="Grade → P&L performance">
          <table className="tjv3-lc__table">
            <thead><tr><th>Grade</th><th>Count</th><th>Avg P&L</th><th>Total P&L</th><th>Win %</th></tr></thead>
            <tbody>
              {d.grade_pnl.map((g) => (
                <tr key={g.grade}>
                  <td><Badge variant={g.grade <= 'B' ? 'profit' : g.grade >= 'E' ? 'loss' : 'neutral'}>{g.grade}</Badge></td>
                  <td>{g.count}</td>
                  <td><MoneyValue value={g.avg_pnl} tone="auto" compact /></td>
                  <td><MoneyValue value={g.total_pnl} tone="auto" compact /></td>
                  <td><PercentValue value={g.win_rate} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </Stack>
  )
}

function BehavioralTab() {
  const behavioral = useBehavioralAnalyticsQuery()
  const overtrading = useOvertradingQuery()
  const earlyExits = useEarlyExitQuery()

  const bData = behavioral.data as BehavioralAnalyticsResponse | undefined
  const oData = overtrading.data as OvertradingResponse | undefined
  const eData = earlyExits.data as EarlyExitResponse | undefined

  if (behavioral.isLoading) return <LoadingState label="Loading behavioral…" />
  if (behavioral.error) return <ErrorState title="Behavioral data unavailable" description={(behavioral.error as Error).message} />

  return (
    <Stack gap="md">
      {bData && (
        <>
          <Grid minColumnWidth="9rem">
            <MetricCard label="Discipline score" value={<Value value={bData.discipline_score != null ? `${bData.discipline_score}/100` : '—'} />} />
          </Grid>

          {bData.insights.length > 0 && (
            <Panel title="Insights">
              <Stack gap="sm">
                {bData.insights.map((ins, i) => (
                  <div key={i} className="tjv3-lc__insight">
                    <Badge variant={ins.type === 'warning' ? 'warning' : 'info'}>{ins.type}</Badge>
                    <span>{ins.message}</span>
                  </div>
                ))}
              </Stack>
            </Panel>
          )}
        </>
      )}

      {oData && oData.summary.overtrading_days > 0 && (
        <Panel title="Overtrading" description={`${oData.summary.overtrading_days} overtrading days detected`}>
          <Grid minColumnWidth="9rem">
            <MetricCard label="Overtrading days" value={<Value value={String(oData.summary.overtrading_days)} tone="warning" />} />
            <MetricCard label="Avg P&L (overtrading)" value={<MoneyValue value={oData.avg_pnl_overtrading} tone="auto" />} />
            <MetricCard label="Avg P&L (normal)" value={<MoneyValue value={oData.avg_pnl_normal} tone="auto" />} />
          </Grid>
        </Panel>
      )}

      {eData && eData.early_exit_rate != null && (
        <Panel title="Early exits" description={`${eData.early_exits.length} early exit trades`}>
          <Grid minColumnWidth="9rem">
            <MetricCard label="Early exit rate" value={<PercentValue value={eData.early_exit_rate} />} />
            <MetricCard label="Avg capture ratio" value={<Value value={eData.capture_stats?.avg_capture_ratio != null ? `${(eData.capture_stats.avg_capture_ratio * 100).toFixed(0)}%` : '—'} />} />
            <MetricCard label="Avg P&L (early)" value={<MoneyValue value={eData.avg_pnl_early_exit} tone="auto" />} />
            <MetricCard label="Avg P&L (full)" value={<MoneyValue value={eData.avg_pnl_full_exit} tone="auto" />} />
          </Grid>
        </Panel>
      )}
    </Stack>
  )
}

function DisciplineTab() {
  const { data, isLoading, error } = useDisciplineScoreQuery()

  if (isLoading) return <LoadingState label="Loading discipline…" />
  if (error) return <ErrorState title="Discipline data unavailable" description={(error as Error).message} />
  if (!data) return <EmptyState title="No discipline data" description="Log journals, emotions, and grade trades to compute discipline." />

  const d = data as DisciplineScoreResponse

  return (
    <Stack gap="md">
      <Grid minColumnWidth="9rem">
        <MetricCard
          label="Overall score"
          value={<Value value={d.overall_score != null ? `${d.overall_score}/100` : '—'} />}
          description={d.grade ? `Grade: ${d.grade}` : undefined}
        />
        {Object.entries(d.components).map(([key, val]) => (
          <MetricCard key={key} label={key.replace(/_/g, ' ')} value={<Value value={`${val}/100`} />} compact />
        ))}
      </Grid>

      {d.insights.length > 0 && (
        <Panel title="Discipline insights">
          <Stack gap="sm">
            {d.insights.map((ins, i) => (
              <div key={i} className="tjv3-lc__insight">
                <Badge variant={ins.type === 'warning' ? 'warning' : 'info'}>{ins.area}</Badge>
                <span>{ins.message}</span>
              </div>
            ))}
          </Stack>
        </Panel>
      )}
    </Stack>
  )
}
