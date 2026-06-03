import { Badge } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { getTradeDisplayStatus } from '../utils/tradesV3Metrics'

export function TradeStatusPill({ trade }: { trade: ApiTrade }) {
  const status = getTradeDisplayStatus(trade)
  const variant = status === 'closed' ? 'neutral' : status === 'open' ? 'info' : status === 'partial' ? 'accent' : 'danger'
  const label = status === 'partial' ? 'Partial' : status[0].toUpperCase() + status.slice(1)

  return <Badge variant={variant}>{label}</Badge>
}
