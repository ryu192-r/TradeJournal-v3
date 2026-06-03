interface ChargesTotalOnlyFieldsProps {
  total: string
  onChange: (v: string) => void
  error?: string
}

export function ChargesTotalOnlyFields({ total, onChange, error }: ChargesTotalOnlyFieldsProps) {
  return (
    <div className="tjv3-field">
      <label htmlFor="total_charges" className="tjv3-field__label">
        Total charges
      </label>
      <input
        id="total_charges"
        type="number"
        min={0}
        step="0.01"
        className="tjv3-field__input"
        value={total}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. 250.50"
      />
      {error && <span className="tjv3-field__error">{error}</span>}
    </div>
  )
}
