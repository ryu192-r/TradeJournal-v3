import { DHAN_ESTIMATE_COPY } from '../templates/dhan/dhanChargesCopy'
import type { EstimateVsActual } from '../templates/dhan/dhanChargesCalculator'
import { formatCurrencyValue } from '../utils/chargesFormUtils'

interface EstimateVsActualCardProps {
  comparison: EstimateVsActual
}

export function EstimateVsActualCard({ comparison }: EstimateVsActualCardProps) {
  const { estimated, actual, difference, differencePct, status } = comparison

  const statusStyles: Record<string, { bg: string; color: string; label: string }> = {
    close: { bg: 'rgba(34,197,94,0.1)', color: 'var(--color-profit)', label: DHAN_ESTIMATE_COPY.comparison.close },
    review: { bg: 'rgba(234,179,8,0.1)', color: 'var(--color-warning)', label: DHAN_ESTIMATE_COPY.comparison.review },
    large: { bg: 'rgba(239,68,68,0.1)', color: 'var(--color-loss)', label: DHAN_ESTIMATE_COPY.comparison.large },
  }

  const s = statusStyles[status]

  return (
    <div
      style={{
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border)',
        padding: '0.75rem',
        background: s?.bg || 'var(--color-bg-card)',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
          marginBottom: '0.5rem',
        }}
      >
        {DHAN_ESTIMATE_COPY.comparison.title}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
            {DHAN_ESTIMATE_COPY.comparison.estimatedLabel}
          </div>
          <div>₹{formatCurrencyValue(estimated)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
            {DHAN_ESTIMATE_COPY.comparison.actualLabel}
          </div>
          <div>₹{formatCurrencyValue(actual)}</div>
        </div>
      </div>

      <div style={{ marginTop: '0.5rem', fontSize: '0.8125rem' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{DHAN_ESTIMATE_COPY.comparison.differenceLabel}: </span>
        <span style={{ fontVariantNumeric: 'tabular-nums', color: difference >= 0 ? 'var(--color-text)' : 'var(--color-profit)' }}>
          {difference >= 0 ? '+' : ''}₹{formatCurrencyValue(difference)}
        </span>
        {differencePct != null && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
            ({differencePct.toFixed(1)}%)
          </span>
        )}
      </div>

      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 500, color: s?.color }}>
        {s?.label}
      </div>

      <p className="tjv3-cockpit__micro" style={{ marginTop: '0.5rem' }}>
        {DHAN_ESTIMATE_COPY.comparison.normalNote}
      </p>
    </div>
  )
}
