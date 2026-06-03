import { Grid, MetricCard, MoneyValue, PercentValue, RMultipleValue, Value } from '@/new-ui'
import { ClipboardCheck, ListChecks, NotebookPen, ShieldAlert, Sigma, Target, TrendingUp } from 'lucide-react'
import type { TradesV3Summary } from '../types'

export function TradesSummaryStrip({ summary }: { summary: TradesV3Summary }) {
  return (
    <Grid minColumnWidth="11.5rem">
      <MetricCard label="Total trades" value={<Value value={summary.total} />} description="Current filtered ledger." icon={<ListChecks aria-hidden="true" />} />
      <MetricCard label="Open" value={<Value value={summary.open} />} description={`${summary.partial} partial open.`} tone={summary.open > 0 ? 'info' : 'neutral'} icon={<TrendingUp aria-hidden="true" />} />
      <MetricCard label="Closed" value={<Value value={summary.closed} />} description="Realized outcomes only." icon={<ClipboardCheck aria-hidden="true" />} />
      <MetricCard label="Gross P&L" value={<MoneyValue value={summary.grossPnl} tone="auto" />} description="Pre daily charges. No fake net." tone={summary.grossPnl == null ? 'neutral' : summary.grossPnl >= 0 ? 'profit' : 'loss'} icon={<Target aria-hidden="true" />} />
      <MetricCard label="Avg R" value={<RMultipleValue value={summary.avgR} tone="auto" />} description="Closed trades with R value." icon={<Sigma aria-hidden="true" />} />
      <MetricCard label="Win rate" value={<PercentValue value={summary.winRate} />} description="Closed trades only." icon={<Target aria-hidden="true" />} />
      <MetricCard label="Missing setup/notes" value={<Value value={`${summary.missingSetup}/${summary.missingNotes}`} />} description="Setup and journal readiness." tone={summary.missingSetup + summary.missingNotes > 0 ? 'warning' : 'profit'} icon={<NotebookPen aria-hidden="true" />} />
      <MetricCard label="Missing SL" value={<Value value={summary.missingStop} />} description="Open trades without protection SL." tone={summary.missingStop > 0 ? 'warning' : 'profit'} icon={<ShieldAlert aria-hidden="true" />} />
    </Grid>
  )
}
