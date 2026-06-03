import type { DhanEstimateResult } from '../templates/dhan/dhanChargesTypes'
import { formatCurrencyValue } from '../utils/chargesFormUtils'

interface DhanEstimateBreakdownProps {
  estimate: DhanEstimateResult
}

export function DhanEstimateBreakdown({ estimate }: DhanEstimateBreakdownProps) {
  return (
    <div
      style={{
        borderRadius: '0.75rem',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '0.5rem 0.75rem',
          background: 'var(--color-bg-muted)',
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
        }}
      >
        Estimated breakdown
      </div>
      <table style={{ width: '100%', fontSize: '0.8125rem' }}>
        <tbody>
          {estimate.breakdown.map((item) => (
            <tr key={item.label}>
              <td style={{ padding: '0.4rem 0.75rem', color: 'var(--color-text-muted)' }}>
                {item.label}
              </td>
              <td
                style={{
                  padding: '0.4rem 0.75rem',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ₹{formatCurrencyValue(item.value)}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--color-border)', fontWeight: 600 }}>
            <td style={{ padding: '0.5rem 0.75rem' }}>Total</td>
            <td
              style={{
                padding: '0.5rem 0.75rem',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ₹{formatCurrencyValue(estimate.total_charges)}
            </td>
          </tr>
        </tbody>
      </table>

      {estimate.warnings.length > 0 && (
        <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {estimate.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
