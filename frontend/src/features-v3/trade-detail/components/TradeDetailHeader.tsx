import { Badge, Button, Cluster, MoneyValue, RMultipleValue, Stack } from '@/new-ui'
import { ArrowLeft } from 'lucide-react'
import type { ApiTrade } from '@/types'
import { TradeQualityBadges } from '../../trades/components/TradeQualityBadges'
import {
  formatTradeQuantity,
  getTradeDirection,
  getTradeGrossPnl,
  getTradeRMultiple,
  getTradeSessionDateSafe,
  getTradeSetup,
  safeText,
} from '../utils/tradeDetailV3Formatters'
import { getTradeDisplayStatus } from '../../trades/utils/tradesV3Metrics'

interface TradeDetailHeaderProps {
  trade: ApiTrade
  onBack: () => void
}

function statusVariant(status: ReturnType<typeof getTradeDisplayStatus>) {
  if (status === 'deleted') return 'neutral'
  if (status === 'closed') return 'success'
  if (status === 'partial') return 'accent'
  return 'info'
}

export function TradeDetailHeader({ trade, onBack }: TradeDetailHeaderProps) {
  const status = getTradeDisplayStatus(trade)
  const grossPnl = getTradeGrossPnl(trade)
  const rMultiple = getTradeRMultiple(trade)

  return (
    <section className="tjv3-trade-detail__header">
      <div className="tjv3-trade-detail__header-top">
        <div>
          <h1 className="tjv3-trade-detail__title">{trade.symbol}</h1>
          <p className="tjv3-trade-detail__subtitle">
            {getTradeDirection(trade)} · {getTradeSessionDateSafe(trade)} · {getTradeSetup(trade)}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>
          <ArrowLeft aria-hidden="true" size={14} />
          Back to Trades
        </Button>
      </div>

      <Stack gap="md">
        <Cluster gap="sm">
          <Badge variant={statusVariant(status)}>{status.toUpperCase()}</Badge>
          <TradeQualityBadges trade={trade} />
          <Badge variant="neutral">{safeText(trade.tactic, 'No tactic')}</Badge>
        </Cluster>

        <div className="tjv3-trade-detail__header-metrics">
          <div>
            <div className="tjv3-trade-detail__metric-label">Gross P&L</div>
            <div className="tjv3-trade-detail__metric-value">
              <MoneyValue value={grossPnl} tone="auto" />
            </div>
            <div className="tjv3-trade-detail__metric-note">Pre daily charges</div>
          </div>
          <div>
            <div className="tjv3-trade-detail__metric-label">R multiple</div>
            <div className="tjv3-trade-detail__metric-value">
              <RMultipleValue value={rMultiple} tone="auto" />
            </div>
          </div>
          <div>
            <div className="tjv3-trade-detail__metric-label">Quantity</div>
            <div className="tjv3-trade-detail__metric-value">{formatTradeQuantity(trade.quantity)}</div>
            <div className="tjv3-trade-detail__metric-note">
              {formatTradeQuantity(trade.remaining_qty ?? trade.quantity)} remaining
            </div>
          </div>
        </div>
      </Stack>
    </section>
  )
}
