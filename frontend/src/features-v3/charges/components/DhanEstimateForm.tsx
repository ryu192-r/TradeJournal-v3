import { DHAN_PRODUCT_OPTIONS, type DhanProductType, type DhanExchange } from '../templates/dhan/dhanChargesConfig'
import { DHAN_ESTIMATE_COPY } from '../templates/dhan/dhanChargesCopy'

interface DhanEstimateFormProps {
  productType: DhanProductType
  exchange: DhanExchange
  buyTurnover: string
  sellTurnover: string
  orderCount: string
  includeIpft: boolean
  errors: Record<string, string>
  onProductChange: (v: DhanProductType) => void
  onExchangeChange: (v: DhanExchange) => void
  onBuyTurnoverChange: (v: string) => void
  onSellTurnoverChange: (v: string) => void
  onOrderCountChange: (v: string) => void
  onIncludeIpftChange: (v: boolean) => void
}

export function DhanEstimateForm({
  productType,
  exchange,
  buyTurnover,
  sellTurnover,
  orderCount,
  includeIpft,
  errors,
  onProductChange,
  onExchangeChange,
  onBuyTurnoverChange,
  onSellTurnoverChange,
  onOrderCountChange,
  onIncludeIpftChange,
}: DhanEstimateFormProps) {
  return (
    <div className="tjv3-stack" style={{ gap: '0.75rem' }}>
      <label className="tjv3-field">
        <span className="tjv3-field__label">{DHAN_ESTIMATE_COPY.productLabel}</span>
        <select
          className="tjv3-field__input"
          value={productType}
          onChange={(e) => onProductChange(e.target.value as DhanProductType)}
        >
          {DHAN_PRODUCT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="tjv3-field">
        <span className="tjv3-field__label">{DHAN_ESTIMATE_COPY.exchangeLabel}</span>
        <select
          className="tjv3-field__input"
          value={exchange}
          onChange={(e) => onExchangeChange(e.target.value as DhanExchange)}
        >
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
        </select>
      </label>

      <label className="tjv3-field">
        <span className="tjv3-field__label">{DHAN_ESTIMATE_COPY.buyTurnoverLabel}</span>
        <input
          type="number"
          min={0}
          step="0.01"
          className="tjv3-field__input"
          value={buyTurnover}
          onChange={(e) => onBuyTurnoverChange(e.target.value)}
          placeholder="e.g. 100000"
        />
        {errors.buy_turnover && <span className="tjv3-field__error">{errors.buy_turnover}</span>}
      </label>

      <label className="tjv3-field">
        <span className="tjv3-field__label">{DHAN_ESTIMATE_COPY.sellTurnoverLabel}</span>
        <input
          type="number"
          min={0}
          step="0.01"
          className="tjv3-field__input"
          value={sellTurnover}
          onChange={(e) => onSellTurnoverChange(e.target.value)}
          placeholder="e.g. 100000"
        />
        {errors.sell_turnover && <span className="tjv3-field__error">{errors.sell_turnover}</span>}
      </label>

      <label className="tjv3-field">
        <span className="tjv3-field__label">{DHAN_ESTIMATE_COPY.orderCountLabel}</span>
        <input
          type="number"
          min={0}
          step={1}
          className="tjv3-field__input"
          value={orderCount}
          onChange={(e) => onOrderCountChange(e.target.value)}
          placeholder="e.g. 4"
        />
        {errors.executed_order_count && (
          <span className="tjv3-field__error">{errors.executed_order_count}</span>
        )}
      </label>

      <label className="tjv3-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="checkbox"
          checked={includeIpft}
          onChange={(e) => onIncludeIpftChange(e.target.checked)}
        />
        <span className="tjv3-field__label" style={{ marginBottom: 0 }}>
          {DHAN_ESTIMATE_COPY.includeIpftLabel}
        </span>
      </label>
    </div>
  )
}
