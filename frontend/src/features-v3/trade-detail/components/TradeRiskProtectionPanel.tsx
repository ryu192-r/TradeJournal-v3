import { Badge, DataList, DataRow, Panel, Value } from '@/new-ui'
import { AlertTriangle } from 'lucide-react'
import type { ApiTrade } from '@/types'
import {
  formatTradePrice,
  getProtectionStatusLabel,
} from '../utils/tradeDetailV3Formatters'
import {
  getCurrentProtectionRisk,
  getCurrentStopModeLabel,
  getDisplayCurrentStop,
  getDisplayOriginalStop,
  getOriginalPlannedRisk,
  getOriginalStopModeLabel,
  getRiskProtectionState,
} from '../utils/tradeDetailV3Risk'

interface TradeRiskProtectionPanelProps {
  trade: ApiTrade
}

function protectionBadge(state: ReturnType<typeof getRiskProtectionState>) {
  if (state === 'no_sl') return <Badge variant="danger">No SL warning</Badge>
  if (state === 'risk_free') return <Badge variant="success">Risk-free</Badge>
  if (state === 'profit_locked') return <Badge variant="success">Profit locked</Badge>
  if (state === 'risk_reduced') return <Badge variant="accent">Risk reduced</Badge>
  if (state === 'planned_risk') return <Badge variant="info">Planned risk active</Badge>
  return <Badge variant="neutral">Unavailable</Badge>
}

export function TradeRiskProtectionPanel({ trade }: TradeRiskProtectionPanelProps) {
  const originalStop = getDisplayOriginalStop(trade)
  const currentStop = getDisplayCurrentStop(trade)
  const state = getRiskProtectionState(trade)

  return (
    <Panel
      title="Original SL vs current protection"
      description="Original planned stop drives risk truth. Current protection reflects moved SL state."
      action={protectionBadge(state)}
    >
      <DataList>
        <DataRow
          title="Original planned SL"
          subtitle={getOriginalStopModeLabel(trade)}
          trailing={<Value value={formatTradePrice(originalStop, 'Not set')} />}
        />
        <DataRow
          title="Current protection SL"
          subtitle={getCurrentStopModeLabel(trade)}
          trailing={<Value value={formatTradePrice(currentStop, 'No SL')} />}
        />
        <DataRow title="Protection status" trailing={<Value value={getProtectionStatusLabel(trade)} />} />
        <DataRow title="Original planned risk" trailing={<Value value={formatRisk(getOriginalPlannedRisk(trade))} />} />
        <DataRow title="Current protection risk" trailing={<Value value={formatRisk(getCurrentProtectionRisk(trade))} />} />
      </DataList>

      {!originalStop && (
        <div className="tjv3-trade-detail__warning">
          <AlertTriangle aria-hidden="true" size={16} />
          Original planned SL is missing. Risk/R truth may be incomplete for this trade.
        </div>
      )}

      {!currentStop && originalStop && (
        <div className="tjv3-trade-detail__warning">
          <AlertTriangle aria-hidden="true" size={16} />
          Current protection SL is unavailable. Showing original planned stop only.
        </div>
      )}
    </Panel>
  )
}

function formatRisk(value: number | null): string {
  if (value == null) return 'Unavailable'
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
