import { SegmentedControl } from '@/new-ui'
import type { ChargesPeriod } from '../hooks/useChargesLedgerData'

interface ChargesPeriodFilterProps {
  value: ChargesPeriod
  onChange: (p: ChargesPeriod) => void
}

const options: { value: ChargesPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export function ChargesPeriodFilter({ value, onChange }: ChargesPeriodFilterProps) {
  return (
    <SegmentedControl
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      onChange={(v) => onChange(v as ChargesPeriod)}
    />
  )
}
