import { Badge, DataList, DataRow, Panel, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { getTradeDirection, getTradeSetup, safeText } from '../utils/tradeDetailV3Formatters'
import { hasMissingSetup } from '../../trades/utils/tradesV3Metrics'

interface SetupTagsPanelProps {
  trade: ApiTrade
}

export function SetupTagsPanel({ trade }: SetupTagsPanelProps) {
  const missingSetup = hasMissingSetup(trade)

  return (
    <Panel
      title="Setup, tags, playbook"
      description="Classification fields from the existing trade record."
      action={missingSetup ? <Badge variant="warning">Missing setup</Badge> : undefined}
    >
      <DataList>
        <DataRow title="Setup" trailing={<Value value={getTradeSetup(trade)} />} />
        <DataRow title="Tags" trailing={<Value value={formatTags(trade.tags)} />} />
        <DataRow title="Playbook / strategy" trailing={<Value value={getTradeSetup(trade)} />} />
        <DataRow title="Direction" trailing={<Value value={getTradeDirection(trade)} />} />
        <DataRow title="Tactic" trailing={<Value value={safeText(trade.tactic, 'Unavailable')} />} />
        <DataRow title="Instrument / product" trailing={<Value value="Unavailable" />} />
      </DataList>
    </Panel>
  )
}

function formatTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return 'No tags'
  return tags.join(', ')
}
