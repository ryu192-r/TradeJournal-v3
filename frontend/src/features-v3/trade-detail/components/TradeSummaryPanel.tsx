import { DataList, DataRow, MoneyValue, Panel, RMultipleValue, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { computeMaxRisk } from '@/utils/calculations'
import {
  formatTradePrice,
  formatTradeQuantity,
  getTradeGrossPnl,
  getTradeRMultiple,
  getTradeSetup,
  safeNumber,
} from '../utils/tradeDetailV3Formatters'
import { getOriginalPlannedRisk } from '../utils/tradeDetailV3Risk'

interface TradeSummaryPanelProps {
  trade: ApiTrade
}

export function TradeSummaryPanel({ trade }: TradeSummaryPanelProps) {
  const entry = safeNumber(trade.entry_price)
  const exit = safeNumber(trade.weighted_avg_exit_price ?? trade.exit_price)
  const qty = safeNumber(trade.quantity)
  const remaining = safeNumber(trade.remaining_qty ?? trade.quantity)
  const grossPnl = getTradeGrossPnl(trade)
  const partialPnl = safeNumber(trade.partial_realized_pnl)
  const maxRisk = getOriginalPlannedRisk(trade)
  const riskPerShare =
    entry != null && safeNumber(trade.original_stop_price ?? trade.stop_price) != null
      ? computeMaxRisk(entry, safeNumber(trade.original_stop_price ?? trade.stop_price)!, 1, trade.direction)
      : null

  return (
    <Panel title="Trade summary" description="Key trade metrics from existing API fields.">
      <DataList>
        <DataRow title="Entry price" trailing={<Value value={formatTradePrice(trade.entry_price)} />} />
        <DataRow
          title="Exit price"
          trailing={<Value value={exit == null ? 'Open / pending exit' : formatTradePrice(exit)} />}
        />
        <DataRow title="Quantity" trailing={<Value value={formatTradeQuantity(qty)} />} />
        <DataRow title="Remaining quantity" trailing={<Value value={formatTradeQuantity(remaining)} />} />
        <DataRow
          title="Gross realized P&L"
          subtitle="Pre daily charges"
          trailing={<MoneyValue value={grossPnl} tone="auto" />}
        />
        <DataRow
          title="Partial realized P&L"
          trailing={<MoneyValue value={partialPnl} tone="auto" />}
        />
        <DataRow title="R multiple" trailing={<RMultipleValue value={getTradeRMultiple(trade)} tone="auto" />} />
        <DataRow title="Max risk (original SL)" trailing={<MoneyValue value={maxRisk} tone="neutral" />} />
        <DataRow
          title="Risk per share"
          trailing={<MoneyValue value={riskPerShare} tone="neutral" />}
        />
        <DataRow title="Setup" trailing={<Value value={getTradeSetup(trade)} />} />
        <DataRow title="Fees" trailing={<MoneyValue value={safeNumber(trade.fees)} tone="neutral" />} />
        <DataRow title="Charges status" trailing={<Value value="Pending / unavailable" />} />
      </DataList>
    </Panel>
  )
}
