import { DataList, DataRow, EmptyState, MoneyValue, Panel, Value } from '@/new-ui'
import { Layers } from 'lucide-react'
import type { PartialExit } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity, safeNumber } from '../utils/tradeDetailV3Formatters'

interface PartialExitsPanelProps {
  partialExits: PartialExit[]
}

export function PartialExitsPanel({ partialExits }: PartialExitsPanelProps) {
  return (
    <Panel title="Partial exits" description="Recorded partial exits from existing API data.">
      {partialExits.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden="true" />}
          title="No partial exits recorded"
          description="Partial exits will appear here when they exist on this trade."
        />
      ) : (
        <DataList>
          {partialExits.map((exit) => (
            <DataRow
              key={exit.id}
              title={formatTradeDateTime(exit.exit_time)}
              subtitle={exit.note ?? exit.exit_reason ?? undefined}
              trailing={
                <div className="tjv3-trade-detail__partial-trailing">
                  <Value value={`${formatTradeQuantity(exit.qty)} @ ${formatTradePrice(exit.exit_price)}`} />
                  <MoneyValue value={safeNumber(exit.realized_pnl)} tone="auto" />
                </div>
              }
            />
          ))}
        </DataList>
      )}
    </Panel>
  )
}
