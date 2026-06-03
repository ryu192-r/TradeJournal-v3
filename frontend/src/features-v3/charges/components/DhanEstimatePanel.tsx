import { useState, useCallback, useMemo } from 'react'
import { Button, Stack } from '@/new-ui'
import { Calculator } from 'lucide-react'
import { DHAN_ESTIMATE_COPY } from '../templates/dhan/dhanChargesCopy'
import { type DhanProductType, type DhanExchange } from '../templates/dhan/dhanChargesConfig'
import {
  computeDhanEstimate,
  validateDhanEstimateInput,
  compareEstimateToActual,
  type EstimateVsActual,
} from '../templates/dhan/dhanChargesCalculator'
import type { DhanEstimateResult } from '../templates/dhan/dhanChargesTypes'
import { DhanEstimateForm } from './DhanEstimateForm'
import { DhanEstimateBreakdown } from './DhanEstimateBreakdown'
import { EstimateVsActualCard } from './EstimateVsActualCard'

interface DhanEstimatePanelProps {
  /** Actual saved charges for the day (if editing) */
  actualTotal?: string | null
  /** When user clicks "Use estimate as draft" */
  onUseAsDraft: (estimate: DhanEstimateResult) => void
  /** Current entry mode from the form */
  currentEntryMode: 'total_only' | 'breakdown'
}

export function DhanEstimatePanel({ actualTotal, onUseAsDraft, currentEntryMode }: DhanEstimatePanelProps) {
  const [open, setOpen] = useState(false)
  const [productType, setProductType] = useState<DhanProductType>('equity_intraday')
  const [exchange, setExchange] = useState<DhanExchange>('NSE')
  const [buyTurnover, setBuyTurnover] = useState('')
  const [sellTurnover, setSellTurnover] = useState('')
  const [orderCount, setOrderCount] = useState('')
  const [includeIpft, setIncludeIpft] = useState(true)
  const [estimate, setEstimate] = useState<DhanEstimateResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleCalculate = useCallback(() => {
    const input = {
      product_type: productType,
      exchange,
      buy_turnover: Number(buyTurnover),
      sell_turnover: Number(sellTurnover),
      executed_order_count: Number(orderCount),
      include_ipft: includeIpft,
    }
    const validation = validateDhanEstimateInput(input)
    setErrors(validation.errors)
    if (!validation.valid) {
      setEstimate(null)
      return
    }
    const result = computeDhanEstimate(input)
    setEstimate(result)
  }, [productType, exchange, buyTurnover, sellTurnover, orderCount, includeIpft])

  const comparison = useMemo<EstimateVsActual | null>(() => {
    if (!estimate) return null
    const actual = actualTotal ? Number(actualTotal) : null
    return compareEstimateToActual(estimate.total_charges, actual)
  }, [estimate, actualTotal])

  const handleUseAsDraft = useCallback(() => {
    if (!estimate) return
    onUseAsDraft(estimate)
  }, [estimate, onUseAsDraft])

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        <Calculator size={16} />
        {DHAN_ESTIMATE_COPY.panelTitle}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {!open && (
        <p className="tjv3-cockpit__micro" style={{ marginTop: '0.25rem' }}>
          {DHAN_ESTIMATE_COPY.panelDescription}
        </p>
      )}

      {open && (
        <Stack gap="md" style={{ marginTop: '0.75rem' }}>
          <p className="tjv3-cockpit__micro">{DHAN_ESTIMATE_COPY.panelDescription}</p>

          <DhanEstimateForm
            productType={productType}
            exchange={exchange}
            buyTurnover={buyTurnover}
            sellTurnover={sellTurnover}
            orderCount={orderCount}
            includeIpft={includeIpft}
            errors={errors}
            onProductChange={setProductType}
            onExchangeChange={setExchange}
            onBuyTurnoverChange={setBuyTurnover}
            onSellTurnoverChange={setSellTurnover}
            onOrderCountChange={setOrderCount}
            onIncludeIpftChange={setIncludeIpft}
          />

          <Button variant="secondary" size="sm" onClick={handleCalculate}>
            {DHAN_ESTIMATE_COPY.calculateButton}
          </Button>

          {estimate && (
            <>
              <DhanEstimateBreakdown estimate={estimate} />

              {comparison && comparison.status !== 'no_actual' && (
                <EstimateVsActualCard comparison={comparison} />
              )}

              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'var(--color-bg-muted)',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                {DHAN_ESTIMATE_COPY.disclaimer}
              </div>

              <Button variant="primary" size="sm" onClick={handleUseAsDraft}>
                {DHAN_ESTIMATE_COPY.useAsDraftButton}
                {currentEntryMode === 'total_only' ? ' (fills total)' : ' (fills breakdown)'}
              </Button>
            </>
          )}
        </Stack>
      )}
    </div>
  )
}
