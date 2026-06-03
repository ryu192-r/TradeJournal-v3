import { MoneyValue, RMultipleValue } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { getTradeGrossPnl, getTradeRMultiple } from '../utils/tradesV3Metrics'

export function TradePnlCell({ trade }: { trade: ApiTrade }) {
  const grossPnl = getTradeGrossPnl(trade)
  const rMultiple = getTradeRMultiple(trade)

  return (
    <div className="tjv3-trades__pnl-cell">
      <MoneyValue value={grossPnl} tone="auto" />
      <RMultipleValue value={rMultiple} tone="auto" />
    </div>
  )
}
