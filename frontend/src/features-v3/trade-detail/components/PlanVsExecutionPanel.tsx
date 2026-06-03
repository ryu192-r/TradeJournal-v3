import { DataList, DataRow, Panel, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { formatTradePrice, getTradeSetup, safeText } from '../utils/tradeDetailV3Formatters'
import { getDisplayCurrentStop, getDisplayOriginalStop } from '../utils/tradeDetailV3Risk'

interface PlanVsExecutionPanelProps {
  trade: ApiTrade
}

export function PlanVsExecutionPanel({ trade }: PlanVsExecutionPanelProps) {
  return (
    <Panel title="Plan vs execution" description="Planned levels vs actual execution from existing trade fields.">
      <DataList>
        <DataRow title="Trade idea / setup" trailing={<Value value={getTradeSetup(trade)} />} />
        <DataRow title="Planned entry" trailing={<Value value={formatTradePrice(trade.entry_price)} />} />
        <DataRow title="Planned SL (original)" trailing={<Value value={formatTradePrice(getDisplayOriginalStop(trade), 'Not set')} />} />
        <DataRow title="Planned target" trailing={<Value value={formatTradePrice(trade.target_price, 'Not set')} />} />
        <DataRow title="Actual entry" trailing={<Value value={formatTradePrice(trade.entry_price)} />} />
        <DataRow
          title="Actual exit"
          trailing={<Value value={formatTradePrice(trade.weighted_avg_exit_price ?? trade.exit_price, 'Open / pending exit')} />}
        />
        <DataRow title="Current protection SL" trailing={<Value value={formatTradePrice(getDisplayCurrentStop(trade), 'No SL')} />} />
        <DataRow title="Exit reason" trailing={<Value value={safeText(trade.exit_reason, 'Unavailable')} />} />
        <DataRow title="Execution notes" trailing={<Value value={safeText(trade.notes, 'No execution notes')} />} />
        <DataRow title="Review tags" trailing={<Value value={formatTags(trade.review_tags)} />} />
      </DataList>
    </Panel>
  )
}

function formatTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return 'No mistake tags'
  return tags.join(', ')
}
