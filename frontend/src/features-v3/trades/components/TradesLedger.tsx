import { EmptyState, Panel, TableShell } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { TradesLedgerRow } from './TradesLedgerRow'

interface TradesLedgerProps {
  trades: ApiTrade[]
  onSelectTrade: (trade: ApiTrade) => void
}

export function TradesLedger({ trades, onSelectTrade }: TradesLedgerProps) {
  return (
    <Panel title="Trade Ledger" description="Desktop ledger. Table scroll stays inside this shell when needed.">
      {trades.length === 0 ? (
        <EmptyState title="No trades found" description="Try changing filters or add trades from the existing trade flow." />
      ) : (
        <div className="tjv3-trades__ledger-desktop">
          <TableShell stickyHeader compact>
            <table>
              <thead>
                <tr>
                  <th>Symbol / setup</th>
                  <th>Direction / status</th>
                  <th>Entry / exit</th>
                  <th>Qty / remaining</th>
                  <th>Original / current SL</th>
                  <th>Gross P&L</th>
                  <th>Quality</th>
                  <th>Session</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <TradesLedgerRow key={trade.id} trade={trade} onSelectTrade={onSelectTrade} />
                ))}
              </tbody>
            </table>
          </TableShell>
        </div>
      )}
    </Panel>
  )
}
