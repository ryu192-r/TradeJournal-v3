import { SegmentedControl } from '@/new-ui'
import type { ChargesMode } from '../utils/chargesFormUtils'

interface ChargesModeToggleProps {
  value: ChargesMode
  onChange: (mode: ChargesMode) => void
}

export function ChargesModeToggle({ value, onChange }: ChargesModeToggleProps) {
  return (
    <div>
      <div className="tjv3-field__label" style={{ marginBottom: '0.5rem' }}>Entry mode</div>
      <SegmentedControl
        options={[
          { value: 'total_only', label: 'Total charges only' },
          { value: 'breakdown', label: 'Detailed breakdown' },
        ]}
        value={value}
        onChange={(v) => onChange(v as ChargesMode)}
      />
      <p className="tjv3-cockpit__micro" style={{ marginTop: '0.5rem' }}>
        {value === 'total_only'
          ? 'Use total-only if you just want to enter the final charges from your contract note.'
          : 'Use breakdown if you want to track brokerage, STT, GST, stamp duty, and other components separately.'}
      </p>
    </div>
  )
}
