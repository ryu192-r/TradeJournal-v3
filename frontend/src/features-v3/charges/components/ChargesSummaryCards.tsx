import { Badge, MetricCard, Stack } from '@/new-ui'
import type { DailyChargesSummary } from '@/types'
import { formatCurrencyValue } from '../utils/chargesFormUtils'

interface ChargesSummaryCardsProps {
  summary?: DailyChargesSummary | null
  isLoading: boolean
}

function SummaryValue({ value, prefix = '₹' }: { value: string | number | null | undefined; prefix?: string }) {
  const formatted = formatCurrencyValue(value)
  if (formatted === '-') return <span className="tjv3-text-muted">—</span>
  return <span>{prefix}{formatted}</span>
}

export function ChargesSummaryCards({ summary, isLoading }: ChargesSummaryCardsProps) {
  if (isLoading) {
    return (
      <Stack gap="md" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ flex: '1 1 160px' }}>
            <MetricCard label="Loading" value="—" compact />
          </div>
        ))}
      </Stack>
    )
  }

  if (!summary) {
    return (
      <Stack gap="md" style={{ display: 'flex', flexWrap: 'wrap' }}>
        <MetricCard label="Trading days" value="—" compact />
        <MetricCard label="Charges recorded" value="—" compact />
        <MetricCard label="Missing charges" value="—" compact />
        <MetricCard label="Gross P&L" value="—" compact />
        <MetricCard label="Net P&L" value="—" compact />
      </Stack>
    )
  }

  const hasMissing = summary.missing_charge_days > 0
  const netTone: import('@/new-ui').ValueTone = hasMissing ? 'neutral' : summary.net_realized_pnl != null && Number(summary.net_realized_pnl) >= 0 ? 'profit' : 'loss'

  return (
    <Stack gap="md" style={{ display: 'flex', flexWrap: 'wrap' }}>
      <MetricCard
        label="Trading days"
        value={summary.trading_days}
        compact
      />
      <MetricCard
        label="Charges recorded"
        value={summary.charges_recorded_days}
        description="Days with charges entry"
        compact
      />
      <MetricCard
        label="Missing charges"
        value={
          hasMissing ? (
            <Badge variant="warning">{summary.missing_charge_days} day(s)</Badge>
          ) : (
            summary.trading_days > 0 ? 'All recorded' : '—'
          )
        }
        compact
      />
      <MetricCard
        label="Gross P&L"
        value={<SummaryValue value={summary.gross_realized_pnl} />}
        compact
      />
      <MetricCard
        label="Net P&L"
        value={
          hasMissing ? (
            <span className="tjv3-text-muted">Pending charges</span>
          ) : (
            <SummaryValue value={summary.net_realized_pnl} />
          )
        }
        tone={netTone}
        compact
      />
    </Stack>
  )
}
