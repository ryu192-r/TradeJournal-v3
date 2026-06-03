import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Stack } from '@/new-ui'
import { getDailyChargesByDate, upsertDailyCharges } from '@/lib/endpoints'
import type { DailyCharges } from '@/types'

interface DailyChargesDrawerProps {
  open: boolean
  date: string
  onClose: () => void
  onSaved: () => void
}

const empty = {
  trade_date: '',
  broker: '',
  contract_note_ref: '',
  brokerage: '',
  stt: '',
  exchange_txn_charges: '',
  sebi_charges: '',
  stamp_duty: '',
  gst: '',
  clearing_charges: '',
  other_charges: '',
  notes: '',
}

function parseMoney(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function DailyChargesDrawer({ open, date, onClose, onSaved }: DailyChargesDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>(empty)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !date) return
    setError(null)
    setLoading(true)
    getDailyChargesByDate(date)
      .then((data: DailyCharges) => {
        setForm({
          trade_date: data.trade_date ?? date,
          broker: data.broker ?? '',
          contract_note_ref: data.contract_note_ref ?? '',
          brokerage: data.brokerage ?? '0',
          stt: data.stt ?? '0',
          exchange_txn_charges: data.exchange_txn_charges ?? '0',
          sebi_charges: data.sebi_charges ?? '0',
          stamp_duty: data.stamp_duty ?? '0',
          gst: data.gst ?? '0',
          clearing_charges: data.clearing_charges ?? '0',
          other_charges: data.other_charges ?? '0',
          notes: data.notes ?? '',
        })
      })
      .catch(() => {
        setForm({ ...empty, trade_date: date })
      })
      .finally(() => setLoading(false))
  }, [open, date])

  const total = useMemo(() => {
    const sum = (
      parseMoney(form.brokerage) +
      parseMoney(form.stt) +
      parseMoney(form.exchange_txn_charges) +
      parseMoney(form.sebi_charges) +
      parseMoney(form.stamp_duty) +
      parseMoney(form.gst) +
      parseMoney(form.clearing_charges) +
      parseMoney(form.other_charges)
    )
    return sum.toFixed(2)
  }, [form])

  const handleChange = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSave = async () => {
    if (!date) return
    setSaving(true)
    setError(null)
    try {
      await upsertDailyCharges(date, {
        trade_date: date,
        entry_mode: 'breakdown',
        broker: form.broker || null,
        account_ref: null,
        contract_note_ref: form.contract_note_ref || null,
        brokerage: form.brokerage || '0',
        stt: form.stt || '0',
        exchange_txn_charges: form.exchange_txn_charges || '0',
        sebi_charges: form.sebi_charges || '0',
        stamp_duty: form.stamp_duty || '0',
        gst: form.gst || '0',
        clearing_charges: form.clearing_charges || '0',
        other_charges: form.other_charges || '0',
        notes: form.notes || null,
      })
      onSaved()
      onClose()
    } catch {
      setError('Failed to save charges. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Daily Charges" side="right">
      <Stack gap="md">
        {loading && <div className="tjv3-cockpit__micro">Loading...</div>}
        {!loading && (
          <>
            <div className="tjv3-cockpit__micro">Date: {date}</div>

            {['broker','contract_note_ref'].map((field) => (
              <label key={field} className="tjv3-field">
                <span className="tjv3-field__label">{field === 'broker' ? 'Broker' : 'Contract note ref'}</span>
                <input
                  className="tjv3-field__input"
                  value={form[field] ?? ''}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={field === 'broker' ? 'e.g. Zerodha' : 'Reference number'}
                />
              </label>
            ))}

            {[
              { key: 'brokerage', label: 'Brokerage' },
              { key: 'stt', label: 'STT' },
              { key: 'exchange_txn_charges', label: 'Exchange txn charges' },
              { key: 'sebi_charges', label: 'SEBI charges' },
              { key: 'stamp_duty', label: 'Stamp duty' },
              { key: 'gst', label: 'GST' },
              { key: 'clearing_charges', label: 'Clearing charges' },
              { key: 'other_charges', label: 'Other charges' },
            ].map(({ key, label }) => (
              <label key={key} className="tjv3-field">
                <span className="tjv3-field__label">{label}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="tjv3-field__input"
                  value={form[key] ?? '0'}
                  onChange={(e) => handleChange(key, e.target.value)}
                />
              </label>
            ))}

            <label className="tjv3-field">
              <span className="tjv3-field__label">Notes</span>
              <textarea
                className="tjv3-field__input"
                rows={3}
                value={form.notes ?? ''}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </label>

            <div className="tjv3-cockpit__micro">Total charges: ₹{total}</div>

            {error && <div className="tjv3-cockpit__micro" style={{ color: 'var(--color-loss)' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save charges'}
              </Button>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </>
        )}
      </Stack>
    </Drawer>
  )
}
