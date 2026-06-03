import { Badge } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { buildTradeQualityBadges } from '../utils/tradesV3Metrics'

function variantFromTone(tone: ReturnType<typeof buildTradeQualityBadges>[number]['tone']) {
  if (tone === 'loss') return 'danger'
  if (tone === 'profit') return 'success'
  return tone
}

export function TradeQualityBadges({ trade }: { trade: ApiTrade }) {
  const badges = buildTradeQualityBadges(trade)
  if (badges.length === 0) return <Badge variant="success">Ready</Badge>

  return (
    <div className="tjv3-trades__badge-row">
      {badges.map((badge) => (
        <Badge key={badge.id} variant={variantFromTone(badge.tone)}>
          {badge.label}
        </Badge>
      ))}
    </div>
  )
}
