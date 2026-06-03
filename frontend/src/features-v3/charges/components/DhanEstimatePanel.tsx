import { useState, useCallback, useMemo, useEffect } from 'react'
import { Badge, Button, Stack } from '@/new-ui'
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
import { deriveDhanEstimateInputsFromTrades, type DeriveResult } from '../utils/deriveDhanInputsFromTrades'
import { listTrades } from '@/lib/endpoints'
import type { ApiTrade } from '@/types'
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
  /** The selected charges date (YYYY-MM-DD) for derivation */
  date?: string
}

export function DhanEstimatePanel({ actualTotal, onUseAsDraft, currentEntryMode, date }: DhanEstimatePanelProps) {
  const [open, setOpen] = useState(false)
  const [productType, setProductType] = useState<DhanProductType>('equity_intraday')
  const [exchange, setExchange] = useState<DhanExchange>('NSE')
  const [buyTurnover, setBuyTurnover] = useState('')
  const [sellTurnover, setSellTurnover] = useState('')
  const [orderCount, setOrderCount] = useState('')
  const [includeIpft, setIncludeIpft] = useState(true)
  const [estimate, setEstimate] = useState<DhanEstimateResult | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Derive-from-trades state
  const [deriveResult, setDeriveResult] = useState<DeriveResult | null>(null)
  const [deriveLoading, setDeriveLoading] = useState(false)
  const [deriveError, setDeriveError] = useState<string | null>(null)

  // Fetch trades for the date when panel opens
  useEffect(() => {
    if (!open || !date) {
      setDeriveResult(null)
      setDeriveError(null)
      return
    }
    setDeriveLoading(true)
    setDeriveError(null)
    listTrades({ from_date: date, to_date: date, limit: 200 })
      .then((res) => {
        const trades: ApiTrade[] = res.items ?? (res as unknown as ApiTrade[])
        setDeriveResult(deriveDhanEstimateInputsFromTrades(trades))
      })
      .catch(() => {
        setDeriveError('Could not load trades for this date.')
        setDeriveResult(null)
      })
      .finally(() => setDeriveLoading(false))
  }, [open, date])

  const handleUseDerived = useCallback(() => {
    if (!deriveResult || deriveResult.confidence === 'unavailable') return
    setBuyTurnover(String(deriveResult.inputs.buyTurnover))
    setSellTurnover(String(deriveResult.inputs.sellTurnover))
    setOrderCount(String(deriveResult.inputs.executedOrderCount))
  }, [deriveResult])

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

          {/* Derive from trades section */}
          {date && (
            <DeriveFromTradesSection
              deriveResult={deriveResult}
              loading={deriveLoading}
              error={deriveError}
              onUseDerived={handleUseDerived}
            />
          )}

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

// ────────────────────────── Derive From Trades Section ──────────────────────────

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
  unavailable: 'neutral',
}

interface DeriveFromTradesSectionProps {
  deriveResult: DeriveResult | null
  loading: boolean
  error: string | null
  onUseDerived: () => void
}

function DeriveFromTradesSection({ deriveResult, loading, error, onUseDerived }: DeriveFromTradesSectionProps) {
  const boxStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-muted)',
    fontSize: '0.8125rem',
  }

  if (loading) {
    return (
      <div style={boxStyle}>
        <span className="tjv3-cockpit__micro">Loading trades for derivation…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={boxStyle}>
        <span className="tjv3-cockpit__micro" style={{ color: 'var(--color-loss)' }}>{error}</span>
      </div>
    )
  }

  if (!deriveResult) return null

  if (deriveResult.confidence === 'unavailable') {
    return (
      <div style={boxStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontWeight: 600 }}>Derive from trades</span>
          <Badge variant="neutral">Unavailable</Badge>
        </div>
        <p className="tjv3-cockpit__micro" style={{ margin: 0 }}>
          {deriveResult.warnings[0] || 'No eligible trades found for this date.'}
        </p>
      </div>
    )
  }

  const { inputs, confidence, warnings, assumptions, sourceStats } = deriveResult
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={boxStyle} data-testid="derive-from-trades">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 600 }}>Derive from trades</span>
        <Badge variant={CONFIDENCE_VARIANT[confidence]}>{confidence}</Badge>
        <span className="tjv3-cockpit__micro" style={{ marginLeft: 'auto' }}>
          {sourceStats.tradeCount} trade{sourceStats.tradeCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div>
          <div className="tjv3-cockpit__micro">Buy turnover</div>
          <div style={{ fontWeight: 500 }}>₹{fmt(inputs.buyTurnover)}</div>
        </div>
        <div>
          <div className="tjv3-cockpit__micro">Sell turnover</div>
          <div style={{ fontWeight: 500 }}>₹{fmt(inputs.sellTurnover)}</div>
        </div>
        <div>
          <div className="tjv3-cockpit__micro">Orders (est.)</div>
          <div style={{ fontWeight: 500 }}>{inputs.executedOrderCount}</div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      {assumptions.length > 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          {assumptions.map((a, i) => <div key={i}>ℹ {a}</div>)}
        </div>
      )}

      <p className="tjv3-cockpit__micro" style={{ margin: '0 0 0.5rem' }}>
        Derived from your trade records. Your Dhan contract note remains final.
      </p>

      <Button variant="secondary" size="sm" onClick={onUseDerived}>
        Use derived values
      </Button>
    </div>
  )
}
