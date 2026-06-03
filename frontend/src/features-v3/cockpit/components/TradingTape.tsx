import { Badge, EmptyState, MoneyValue, Panel, RMultipleValue, TableShell } from '@/new-ui'
import type { ApiTrade } from '@/types'
import type { CockpitMetrics } from '../types'
import { displayQuantity, displaySetup, displayTradeDate, tradeStatusLabel } from '../utils/cockpitFormatters'
import { safeNumber } from '../utils/cockpitMetrics'

interface TradingTapeProps {
  metrics: CockpitMetrics
  onSelectTrade: (trade: ApiTrade) => void
}

export function TradingTape({ metrics, onSelectTrade }: TradingTapeProps) {
  return (
    <Panel title="Trading Tape" description="Period trades. Deleted trades excluded from normal performance.">
      {metrics.periodTrades.length === 0 ? (
        <EmptyState title="No trades in this period" description="Trades will appear here once available." />
      ) : (
        <>
          <div className="tjv3-cockpit__table-desktop">
            <TableShell compact>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Status</th>
                    <th>Gross P&L</th>
                    <th>R</th>
                    <th>Setup</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.periodTrades.slice(0, 10).map((trade) => (
                    <tr key={trade.id}>
                      <td>
                        <button type="button" className="tjv3-cockpit__symbol" onClick={() => onSelectTrade(trade)}>
                          {trade.symbol}
                        </button>
                      </td>
                      <td><Badge variant={trade.status === 'open' ? 'info' : 'neutral'}>{tradeStatusLabel(trade)}</Badge></td>
                      <td><MoneyValue value={safeNumber(trade.pnl) == null ? null : (safeNumber(trade.pnl) ?? 0) + (safeNumber(trade.fees) ?? 0)} tone="auto" /></td>
                      <td><RMultipleValue value={safeNumber(trade.r_multiple)} /></td>
                      <td>{displaySetup(trade)}</td>
                      <td>{displayTradeDate(trade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </div>

          <div className="tjv3-cockpit__table-mobile">
            {metrics.periodTrades.slice(0, 10).map((trade) => (
              <button key={trade.id} type="button" className="tjv3-cockpit__trade-row" onClick={() => onSelectTrade(trade)}>
                <div className="tjv3-cockpit__row-top">
                  <div className="tjv3-cockpit__symbol">{trade.symbol}</div>
                  <MoneyValue value={safeNumber(trade.pnl)} tone="auto" />
                </div>
                <div className="tjv3-cockpit__micro">
                  {tradeStatusLabel(trade)} · Qty {displayQuantity(trade.quantity)} · {displaySetup(trade)} · {displayTradeDate(trade)}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
