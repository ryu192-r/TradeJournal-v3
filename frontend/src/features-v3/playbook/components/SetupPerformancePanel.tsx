import { Grid, MetricCard, MoneyValue, PercentValue, RMultipleValue, Value } from '@/new-ui'
import type { SetupPerformance } from '../utils/playbookMetrics'

interface SetupPerformancePanelProps {
  performance: SetupPerformance
}

export function SetupPerformancePanel({ performance }: SetupPerformancePanelProps) {
  const grossTone = performance.closedTrades === 0 ? 'neutral' : 'auto'

  return (
    <Grid minColumnWidth="9rem">
      <MetricCard label="Trades" value={<Value value={String(performance.totalTrades)} />} />
      <MetricCard label="Closed" value={<Value value={String(performance.closedTrades)} />} />
      <MetricCard label="Open" value={<Value value={String(performance.openTrades)} />} />
      <MetricCard
        label="Gross P&L"
        description="Pre daily charges"
        value={
          performance.closedTrades > 0 ? (
            <MoneyValue value={performance.grossPnl} tone={grossTone} />
          ) : (
            <Value value="—" />
          )
        }
      />
      <MetricCard label="Win rate" value={<PercentValue value={performance.winRate} />} />
      <MetricCard label="Avg R" value={<RMultipleValue value={performance.avgR} tone="auto" />} />
      <MetricCard
        label="Best trade"
        value={performance.bestTrade != null ? <MoneyValue value={performance.bestTrade} tone="profit" /> : <Value value="—" />}
      />
      <MetricCard
        label="Worst trade"
        value={performance.worstTrade != null ? <MoneyValue value={performance.worstTrade} tone="loss" /> : <Value value="—" />}
      />
      <MetricCard
        label="Reviewed"
        value={<Value value={`${performance.reviewedCount} / ${Math.max(performance.closedTrades, 0)}`} />}
      />
      <MetricCard label="Pending review" value={<Value value={String(performance.pendingReview)} />} />
    </Grid>
  )
}
