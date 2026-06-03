import { Grid, MetricCard, MoneyValue, Value } from '@/new-ui'
import type { SetupLibrarySummary } from '../utils/playbookMetrics'

interface PlaybookHeaderProps {
  summary: SetupLibrarySummary
}

export function PlaybookHeader({ summary }: PlaybookHeaderProps) {
  return (
    <Grid minColumnWidth="9rem">
      <MetricCard label="Total setups" value={<Value value={String(summary.totalSetups)} />} />
      <MetricCard label="Active" value={<Value value={String(summary.activeSetups)} />} />
      <MetricCard label="Archived" value={<Value value={String(summary.archivedSetups)} />} />
      <MetricCard label="Untagged trades" value={<Value value={String(summary.untaggedTrades)} />} />
      <MetricCard
        label="Best setup"
        description="By gross P&L"
        value={
          summary.bestSetupName ? (
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <span style={{ fontWeight: 600 }}>{summary.bestSetupName}</span>
              <MoneyValue value={summary.bestSetupGrossPnl} tone="profit" />
            </span>
          ) : (
            <Value value="—" />
          )
        }
      />
      <MetricCard
        label="Worst setup"
        description="By gross P&L"
        value={
          summary.worstSetupName ? (
            <span style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
              <span style={{ fontWeight: 600 }}>{summary.worstSetupName}</span>
              <MoneyValue value={summary.worstSetupGrossPnl} tone="loss" />
            </span>
          ) : (
            <Value value="—" />
          )
        }
      />
    </Grid>
  )
}
