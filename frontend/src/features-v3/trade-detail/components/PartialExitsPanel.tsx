import { Button, DataList, DataRow, EmptyState, MoneyValue, Panel, Value } from '@/new-ui'
import { Layers, Trash2 } from 'lucide-react'
import type { PartialExit } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity, safeNumber } from '../utils/tradeDetailV3Formatters'

interface PartialExitsPanelProps {
  partialExits: PartialExit[]
  onDelete?: (exitId: number) => void
  isDeleting?: boolean
}

export function PartialExitsPanel({ partialExits, onDelete, isDeleting }: PartialExitsPanelProps) {
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
                  {onDelete && (
                    <Button variant="ghost" size="sm" onClick={() => onDelete(exit.id)} disabled={isDeleting}>
                      <Trash2 aria-hidden="true" size={13} />
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </DataList>
      )}
    </Panel>
  )
}
