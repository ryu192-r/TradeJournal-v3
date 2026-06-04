import { Grid, MetricCard, MoneyValue, PercentValue, RMultipleValue, Value } from '@/new-ui'
import { AlertTriangle, CircleDollarSign, ClipboardCheck, ReceiptText, Shield, Sigma, Target } from 'lucide-react'
import type { CockpitMetrics } from '../types'

export function CockpitPerformanceDeck({ metrics }: { metrics: CockpitMetrics }) {
  const hasCharges = metrics.recordedFees != null
  const chargesValue = hasCharges
    ? <MoneyValue value={metrics.recordedFees} tone="neutral" />
    : <Value value={metrics.chargesState === 'no_trades' ? 'No trades' : 'Not added'} />
  const chargesDescription = metrics.chargesState === 'recorded'
    ? 'From daily charges ledger.'
    : metrics.chargesState === 'no_trades'
      ? 'No period trades to reconcile.'
      : hasCharges
        ? 'Partial — some trading days still need charges.'
        : 'Pending daily charges. Missing charges are not treated as zero.'
  const netValue = metrics.netPnlState === 'available'
    ? <MoneyValue value={metrics.netPnl} tone="auto" />
    : <Value value={metrics.netPnlState === 'no_trades' ? 'No trades' : 'Pending'} />
  const netDescription = metrics.netPnlState === 'available'
    ? 'Gross minus recorded daily charges.'
    : metrics.netPnlState === 'no_trades'
      ? 'No period trades yet.'
      : 'Net unlocks after all trading days have charges.'

  return (
    <Grid minColumnWidth="12.5rem">
      <MetricCard
        label="Gross P&L"
        value={<MoneyValue value={metrics.grossPnl} tone="auto" />}
        description="Realized P&L on closed trades, before daily charges."
        tone={metrics.grossPnl == null ? 'neutral' : metrics.grossPnl >= 0 ? 'profit' : 'loss'}
        icon={<CircleDollarSign aria-hidden="true" />}
      />
      <MetricCard
        label="Charges & Fees"
        value={chargesValue}
        description={chargesDescription}
        tone={metrics.chargesState === 'recorded' ? 'neutral' : 'warning'}
        icon={<ReceiptText aria-hidden="true" />}
      />
      <MetricCard
        label="Net P&L Status"
        value={netValue}
        description={netDescription}
        tone={metrics.netPnlState === 'available' ? 'accent' : 'warning'}
        icon={<AlertTriangle aria-hidden="true" />}
      />
      <MetricCard
        label="Open Risk"
        value={metrics.openRisk == null ? <Value value="Unavailable" /> : <MoneyValue value={metrics.openRisk} tone="neutral" />}
        description="Current live risk from existing dashboard/open trade data."
        tone={metrics.openRisk == null ? 'neutral' : metrics.openRisk > 0 ? 'warning' : 'profit'}
        icon={<Shield aria-hidden="true" />}
      />
      <MetricCard
        label="Win Rate"
        value={<PercentValue value={metrics.winRate} tone="neutral" />}
        description="Closed trades only. Open/deleted trades excluded."
        tone="neutral"
        icon={<Target aria-hidden="true" />}
      />
      <MetricCard
        label="Avg R"
        value={<RMultipleValue value={metrics.avgR} tone="auto" />}
        description="Existing R-multiple values on closed trades."
        tone={metrics.avgR == null ? 'neutral' : metrics.avgR >= 0 ? 'profit' : 'loss'}
        icon={<Sigma aria-hidden="true" />}
      />
      <MetricCard
        label="Review Pending"
        value={<Value value={metrics.reviewItems.length} />}
        description="Data-backed action items from trades and charges state."
        tone={metrics.reviewItems.length > 0 ? 'warning' : 'profit'}
        icon={<ClipboardCheck aria-hidden="true" />}
      />
    </Grid>
  )
}
