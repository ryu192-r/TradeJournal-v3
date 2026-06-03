import { Button, DataList, DataRow, Drawer, MoneyValue, RMultipleValue, Stack, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity, getCurrentStop, getOriginalStop, getProtectionStatusLabel, getTradeDirection, getTradeNotes, getTradeSessionDateSafe, getTradeSetup, safeNumber } from '../utils/tradesV3Formatters'
import { getTradeDisplayStatus, getTradeGrossPnl, getTradeRMultiple } from '../utils/tradesV3Metrics'
import { TradeQualityBadges } from './TradeQualityBadges'

interface TradePreviewDrawerProps {
  trade: ApiTrade | null
  onClose: () => void
  onOpenTradeDetail?: (tradeId: number) => void
  /** @deprecated Use onOpenTradeDetail */
  onOpenLegacyDetail?: (tradeId: number) => void
}

export function TradePreviewDrawer({
  trade,
  onClose,
  onOpenTradeDetail,
  onOpenLegacyDetail,
}: TradePreviewDrawerProps) {
  const openDetail = onOpenTradeDetail ?? onOpenLegacyDetail
  return (
    <Drawer
      open={Boolean(trade)}
      onClose={onClose}
      title={trade ? `${trade.symbol} preview` : 'Trade preview'}
      description="Preview only. No edit, delete, close, or partial-exit action is available in N4."
      footer={
        <div className="tjv3-trades__drawer-footer">
          {trade && openDetail && (
            <Button
              variant="primary"
              onClick={() => {
                openDetail(trade.id)
                onClose()
              }}
            >
              Open full trade
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close preview</Button>
        </div>
      }
    >
      {trade && (
        <Stack>
          <TradeQualityBadges trade={trade} />
          <DataList>
            <DataRow title="Status" trailing={<Value value={getTradeDisplayStatus(trade)} />} />
            <DataRow title="Direction" trailing={<Value value={getTradeDirection(trade)} />} />
            <DataRow title="Session date" trailing={<Value value={getTradeSessionDateSafe(trade)} />} />
            <DataRow title="Entry" subtitle={formatTradeDateTime(trade.entry_time)} trailing={<Value value={formatTradePrice(trade.entry_price)} />} />
            <DataRow title="Exit" subtitle={trade.exit_time ? formatTradeDateTime(trade.exit_time) : 'Open / pending exit'} trailing={<Value value={formatTradePrice(trade.weighted_avg_exit_price ?? trade.exit_price)} />} />
            <DataRow title="Quantity" trailing={<Value value={`${formatTradeQuantity(trade.quantity)} / ${formatTradeQuantity(trade.remaining_qty ?? trade.quantity)} remaining`} />} />
            <DataRow title="Original SL" trailing={<Value value={formatTradePrice(getOriginalStop(trade), 'Not set')} />} />
            <DataRow title="Current protection SL" trailing={<Value value={formatTradePrice(getCurrentStop(trade), 'No SL')} />} />
            <DataRow title="Risk status" trailing={<Value value={getProtectionStatusLabel(trade)} />} />
            <DataRow title="Gross P&L" subtitle="Pre daily charges" trailing={<MoneyValue value={getTradeGrossPnl(trade)} tone="auto" />} />
            <DataRow title="Partial realized P&L" trailing={<MoneyValue value={safeNumber(trade.partial_realized_pnl)} tone="auto" />} />
            <DataRow title="R multiple" trailing={<RMultipleValue value={getTradeRMultiple(trade)} tone="auto" />} />
            <DataRow title="Setup" trailing={<Value value={getTradeSetup(trade)} />} />
            <DataRow title="Notes" trailing={<Value value={getTradeNotes(trade)} />} />
          </DataList>
          <div className="tjv3-trades__micro">Full trade detail, edit, close, delete, and partial exit stay in legacy routes during N4.</div>
        </Stack>
      )}
    </Drawer>
  )
}
