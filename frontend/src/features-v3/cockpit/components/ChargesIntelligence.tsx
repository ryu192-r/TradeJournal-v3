import { Badge, DataList, DataRow, MoneyValue, Panel, Value } from '@/new-ui'
import type { CockpitMetrics } from '../types'

export function ChargesIntelligence({ metrics }: { metrics: CockpitMetrics }) {
  const pending = metrics.chargesState === 'pending'
  const noTrades = metrics.chargesState === 'no_trades'
  return (
    <Panel
      title="Charges Intelligence"
      description="India-first P&L model: gross trade P&L first, net only after charges are recorded."
      action={<Badge variant={pending ? 'warning' : metrics.chargesState === 'recorded' ? 'success' : 'neutral'}>{pending ? 'Pending' : metrics.chargesState === 'recorded' ? 'Recorded' : 'No trades'}</Badge>}
    >
      <DataList>
        <DataRow title="Gross P&L" subtitle="Closed trades before recorded fees" trailing={<MoneyValue value={metrics.grossPnl} tone="auto" />} />
        <DataRow
          title="Charges & fees"
          subtitle={pending ? 'Daily charges ledger not available in N3' : noTrades ? 'No period trades to reconcile' : 'Recorded trade-level fees only'}
          trailing={metrics.chargesState === 'recorded' ? <MoneyValue value={metrics.recordedFees} tone="neutral" /> : <Value value={noTrades ? 'No trades' : 'Not added'} />}
        />
        <DataRow
          title="Net P&L"
          subtitle={metrics.netPnlState === 'available' ? 'Based on recorded trade-level fees' : noTrades ? 'No period trades yet' : 'Net is withheld until charges are recorded'}
          trailing={metrics.netPnlState === 'available' ? <MoneyValue value={metrics.netPnl} tone="auto" /> : <Value value={noTrades ? 'No trades' : 'Pending charges'} />}
        />
      </DataList>
      <div className="tjv3-cockpit__micro">N3 does not estimate charges or allocate daily charges across trades.</div>
    </Panel>
  )
}
