import type { ApiTrade } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity, getCurrentStop, getOriginalStop, getProtectionStatusLabel, getTradeDirection, getTradeSetup } from '../utils/tradesV3Formatters'
import { TradePnlCell } from './TradePnlCell'
import { TradeQualityBadges } from './TradeQualityBadges'
import { TradeStatusPill } from './TradeStatusPill'

interface TradesMobileCardProps {
  trade: ApiTrade
  onSelectTrade: (trade: ApiTrade) => void
}

export function TradesMobileCard({ trade, onSelectTrade }: TradesMobileCardProps) {
  return (
    <button type="button" className="tjv3-trades__mobile-card" onClick={() => onSelectTrade(trade)}>
      <div className="tjv3-trades__mobile-top">
        <div className="min-w-0">
          <div className="tjv3-trades__mobile-symbol">{trade.symbol}</div>
          <div className="tjv3-trades__micro">{getTradeDirection(trade)} · {getTradeSetup(trade)}</div>
        </div>
        <TradePnlCell trade={trade} />
      </div>

      <div className="tjv3-trades__mobile-grid">
        <span>Entry {formatTradePrice(trade.entry_price)}</span>
        <span>Exit {formatTradePrice(trade.weighted_avg_exit_price ?? trade.exit_price)}</span>
        <span>Qty {formatTradeQuantity(trade.quantity)}</span>
        <span>Rem {formatTradeQuantity(trade.remaining_qty ?? trade.quantity)}</span>
        <span>Orig SL {formatTradePrice(getOriginalStop(trade), 'Not set')}</span>
        <span>Current SL {formatTradePrice(getCurrentStop(trade), 'No SL')}</span>
      </div>

      <div className="tjv3-trades__mobile-bottom">
        <TradeStatusPill trade={trade} />
        <span className="tjv3-trades__micro">{getProtectionStatusLabel(trade)} · {formatTradeDateTime(trade.entry_time)}</span>
      </div>

      <TradeQualityBadges trade={trade} />
    </button>
  )
}
