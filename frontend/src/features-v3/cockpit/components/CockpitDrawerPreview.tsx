import { Button, DataList, DataRow, Drawer, MoneyValue, RMultipleValue, Stack, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import type { CockpitActionItem } from '../types'
import { displayQuantity, displaySetup, displayStop, displayTradeDate, tradeStatusLabel } from '../utils/cockpitFormatters'
import { safeNumber } from '../utils/cockpitMetrics'

interface CockpitDrawerPreviewProps {
  trade: ApiTrade | null
  actionItem: CockpitActionItem | null
  onClose: () => void
}

export function CockpitDrawerPreview({ trade, actionItem, onClose }: CockpitDrawerPreviewProps) {
  const open = Boolean(trade || actionItem)
  const selectedTrade = trade ?? actionItem?.trade ?? null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={selectedTrade ? `${selectedTrade.symbol} preview` : actionItem?.title ?? 'Cockpit preview'}
      description="Preview-only context. No edit, close, delete, or migration action is available in N3."
      footer={<Button variant="secondary" onClick={onClose}>Close preview</Button>}
    >
      <Stack>
        {actionItem && (
          <DataList>
            <DataRow title="Action" trailing={<Value value={actionItem.title} />} />
            <DataRow title="Reason" trailing={<Value value={actionItem.reason} />} />
          </DataList>
        )}

        {selectedTrade && (
          <DataList>
            <DataRow title="Status" trailing={<Value value={tradeStatusLabel(selectedTrade)} />} />
            <DataRow title="Entry" trailing={<Value value={selectedTrade.entry_price} />} />
            <DataRow title="Quantity" trailing={<Value value={displayQuantity(selectedTrade.remaining_qty ?? selectedTrade.quantity)} />} />
            <DataRow title="Stop" trailing={<Value value={displayStop(selectedTrade)} />} />
            <DataRow title="Recorded P&L field" trailing={<MoneyValue value={safeNumber(selectedTrade.pnl)} tone="auto" />} />
            <DataRow title="R multiple" trailing={<RMultipleValue value={safeNumber(selectedTrade.r_multiple)} />} />
            <DataRow title="Setup" trailing={<Value value={displaySetup(selectedTrade)} />} />
            <DataRow title="Entry time" trailing={<Value value={displayTradeDate(selectedTrade)} />} />
          </DataList>
        )}

        {!selectedTrade && !actionItem && <Value value="No preview selected" />}
      </Stack>
    </Drawer>
  )
}
