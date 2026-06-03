interface ChargesBreakdownFieldsProps {
  brokerage: string
  stt: string
  exchange_txn_charges: string
  sebi_charges: string
  stamp_duty: string
  gst: string
  clearing_charges: string
  other_charges: string
  onChange: (field: string, value: string) => void
  computedTotal: string
}

const fields = [
  { key: 'brokerage', label: 'Brokerage' },
  { key: 'stt', label: 'STT' },
  { key: 'exchange_txn_charges', label: 'Exchange txn charges' },
  { key: 'sebi_charges', label: 'SEBI charges' },
  { key: 'stamp_duty', label: 'Stamp duty' },
  { key: 'gst', label: 'GST' },
  { key: 'clearing_charges', label: 'Clearing charges' },
  { key: 'other_charges', label: 'Other charges' },
]

export function ChargesBreakdownFields({
  brokerage,
  stt,
  exchange_txn_charges,
  sebi_charges,
  stamp_duty,
  gst,
  clearing_charges,
  other_charges,
  onChange,
  computedTotal,
}: ChargesBreakdownFieldsProps) {
  const values: Record<string, string> = {
    brokerage,
    stt,
    exchange_txn_charges,
    sebi_charges,
    stamp_duty,
    gst,
    clearing_charges,
    other_charges,
  }

  return (
    <div className="tjv3-stack" style={{ gap: '0.75rem' }}>
      {fields.map(({ key, label }) => (
        <label key={key} className="tjv3-field">
          <span className="tjv3-field__label">{label}</span>
          <input
            type="number"
            min={0}
            step="0.01"
            className="tjv3-field__input"
            value={values[key] ?? ''}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </label>
      ))}
      <div className="tjv3-cockpit__micro">Computed total: ₹{computedTotal}</div>
    </div>
  )
}
