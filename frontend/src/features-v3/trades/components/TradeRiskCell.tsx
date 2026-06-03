import { Badge, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { formatTradePrice, getCurrentStop, getOriginalStop, getProtectionStatusLabel } from '../utils/tradesV3Formatters'

export function TradeRiskCell({ trade }: { trade: ApiTrade }) {
  const originalStop = getOriginalStop(trade)
  const currentStop = getCurrentStop(trade)
  const hasSplit = originalStop != null && currentStop != null && originalStop !== currentStop

  return (
    <div className="tjv3-trades__risk-cell">
      <div className="tjv3-trades__risk-line">
        <span>Orig SL</span>
        <Value value={formatTradePrice(originalStop, 'Not set')} />
      </div>
      <div className="tjv3-trades__risk-line">
        <span>Current SL</span>
        <Value value={formatTradePrice(currentStop, currentStop ? '—' : 'No SL')} tone={currentStop ? 'neutral' : 'warning'} />
      </div>
      <Badge variant={hasSplit ? 'accent' : currentStop ? 'neutral' : 'warning'}>
        {getProtectionStatusLabel(trade)}
      </Badge>
    </div>
  )
}
