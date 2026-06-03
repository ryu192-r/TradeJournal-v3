import { Badge, EmptyState, MoneyValue, Panel, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import type { CockpitMetrics } from '../types'
import { displayQuantity, displaySetup, displayStop, tradeStatusLabel } from '../utils/cockpitFormatters'
import { safeNumber } from '../utils/cockpitMetrics'

interface OpenRiskBoardProps {
  metrics: CockpitMetrics
  onSelectTrade: (trade: ApiTrade) => void
}

export function OpenRiskBoard({ metrics, onSelectTrade }: OpenRiskBoardProps) {
  return (
    <Panel title="Open Risk Board" description="Open and partial positions from backend status and remaining quantity.">
      {metrics.activeTrades.length === 0 ? (
        <EmptyState title="No live exposure" description="You have no open trades right now." />
      ) : (
        <div className="tjv3-cockpit__row-list">
          {metrics.activeTrades.slice(0, 6).map((trade) => (
            <button key={trade.id} type="button" className="tjv3-cockpit__trade-row" onClick={() => onSelectTrade(trade)}>
              <div className="tjv3-cockpit__row-top">
                <div className="tjv3-cockpit__symbol">{trade.symbol}</div>
                <Badge variant={displayStop(trade) === 'No SL' ? 'danger' : 'info'}>{displayStop(trade)}</Badge>
              </div>
              <div className="tjv3-cockpit__row-bottom">
                <div className="tjv3-cockpit__muted">
                  {tradeStatusLabel(trade)} · Qty {displayQuantity(trade.remaining_qty ?? trade.quantity)} · {displaySetup(trade)}
                </div>
                <MoneyValue value={safeNumber(trade.partial_realized_pnl)} fallback="—" tone="auto" />
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="tjv3-cockpit__metric-detail">
        Open risk: {metrics.openRisk == null ? <Value value="Unavailable" /> : <MoneyValue value={metrics.openRisk} tone="neutral" />}
      </div>
    </Panel>
  )
}
