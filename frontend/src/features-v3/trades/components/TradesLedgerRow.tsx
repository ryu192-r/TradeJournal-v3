import type { ApiTrade } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity, getTradeDirection, getTradeSetup } from '../utils/tradesV3Formatters'
import { TradePnlCell } from './TradePnlCell'
import { TradeQualityBadges } from './TradeQualityBadges'
import { TradeRiskCell } from './TradeRiskCell'
import { TradeStatusPill } from './TradeStatusPill'

interface TradesLedgerRowProps {
  trade: ApiTrade
  onSelectTrade: (trade: ApiTrade) => void
}

export function TradesLedgerRow({ trade, onSelectTrade }: TradesLedgerRowProps) {
  const chips = [trade.exchange, trade.product_type].filter(v => v && v !== 'UNKNOWN')
  return (
    <tr>
      <td>
        <button type="button" className="tjv3-trades__symbol-button" onClick={() => onSelectTrade(trade)}>
          <span>{trade.symbol}</span>
          <small>{getTradeSetup(trade)}</small>
        </button>
      </td>
      <td>
        <div className="tjv3-trades__status-stack">
          <span>{getTradeDirection(trade)}</span>
          <TradeStatusPill trade={trade} />
          {chips.length > 0 && (
            <small className="tjv3-trades__meta-chips">{chips.join(' · ')}</small>
          )}
        </div>
      </td>
      <td>
        <div className="tjv3-trades__price-stack">
          <span>Entry {formatTradePrice(trade.entry_price)}</span>
          <small>Exit {formatTradePrice(trade.weighted_avg_exit_price ?? trade.exit_price)}</small>
        </div>
      </td>
      <td>
        <div className="tjv3-trades__price-stack">
          <span>Qty {formatTradeQuantity(trade.quantity)}</span>
          <small>Rem {formatTradeQuantity(trade.remaining_qty ?? trade.quantity)}</small>
        </div>
      </td>
      <td>
        <TradeRiskCell trade={trade} />
      </td>
      <td>
        <TradePnlCell trade={trade} />
      </td>
      <td>
        <TradeQualityBadges trade={trade} />
      </td>
      <td>
        <div className="tjv3-trades__date-stack">
          <span>{formatTradeDateTime(trade.entry_time)}</span>
          <small>{trade.exit_time ? formatTradeDateTime(trade.exit_time) : 'Open / pending exit'}</small>
        </div>
      </td>
      <td>
        <button type="button" className="tjv3-trades__preview-link" onClick={() => onSelectTrade(trade)}>
          Preview
        </button>
      </td>
    </tr>
  )
}
