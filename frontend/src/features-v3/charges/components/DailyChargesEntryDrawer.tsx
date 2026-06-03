import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Stack } from '@/new-ui'
import { getDailyChargesByDate, upsertDailyCharges } from '@/lib/endpoints'
import type { DailyCharges } from '@/types'
import {
  ChargesFormData,
  ChargesFormErrors,
  dailyChargesToFormData,
  emptyChargesForm,
  formDataToPayload,
  validateChargesForm,
  computeBreakdownTotal,
} from '../utils/chargesFormUtils'
import { ChargesModeToggle } from './ChargesModeToggle'
import { ChargesBreakdownFields } from './ChargesBreakdownFields'
import { ChargesTotalOnlyFields } from './ChargesTotalOnlyFields'
import { formatChargesDateLabel } from '../utils/chargesFormUtils'

interface DailyChargesEntryDrawerProps {
  open: boolean
  date: string
  mode: 'add' | 'edit'
  onClose: () => void
  onSaved: () => void
}

export function DailyChargesEntryDrawer({ open, date, mode, onClose, onSaved }: DailyChargesEntryDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ChargesFormData>(emptyChargesForm)
  const [errors, setErrors] = useState<ChargesFormErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !date) return
    setServerError(null)
    setErrors({})
    if (mode === 'add') {
      setLoading(false)
      setForm({ ...emptyChargesForm, trade_date: date })
      return
    }
    setLoading(true)
    getDailyChargesByDate(date)
      .then((data: DailyCharges) => {
        setForm(dailyChargesToFormData(data, date))
      })
      .catch(() => {
        setForm({ ...emptyChargesForm, trade_date: date })
      })
      .finally(() => setLoading(false))
  }, [open, date, mode])

  const handleChange = useCallback((field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const computedTotal = useMemo(() => computeBreakdownTotal(form), [form])

  const handleSave = async () => {
    if (!date) return
    const validation = validateChargesForm(form)
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    setSaving(true)
    setServerError(null)
    try {
      await upsertDailyCharges(date, formDataToPayload(form) as any)
      onSaved()
      onClose()
    } catch (e: any) {
      setServerError(e?.message || 'Failed to save charges. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={mode === 'edit' ? 'Edit charges' : 'Add charges'}
      description={formatChargesDateLabel(date)}
      side="right"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Update charges' : 'Save charges'}
          </Button>
        </div>
      }
    >
      <Stack gap="md">
        {loading && <div className="tjv3-cockpit__micro">Loading…</div>}
        {!loading && (
          <>
            <ChargesModeToggle
              value={form.entry_mode}
              onChange={(m) => handleChange('entry_mode', m)}
            />

            {form.entry_mode === 'total_only' ? (
              <ChargesTotalOnlyFields
                total={form.total_charges}
                onChange={(v) => handleChange('total_charges', v)}
                error={errors.total_charges}
              />
            ) : (
              <ChargesBreakdownFields
                brokerage={form.brokerage}
                stt={form.stt}
                exchange_txn_charges={form.exchange_txn_charges}
                sebi_charges={form.sebi_charges}
                stamp_duty={form.stamp_duty}
                gst={form.gst}
                clearing_charges={form.clearing_charges}
                other_charges={form.other_charges}
                onChange={handleChange}
                computedTotal={computedTotal}
              />
            )}

            <div className="tjv3-field">
              <span className="tjv3-field__label">Broker</span>
              <input
                className="tjv3-field__input"
                value={form.broker}
                onChange={(e) => handleChange('broker', e.target.value)}
                placeholder="e.g. Zerodha"
              />
            </div>

            <div className="tjv3-field">
              <span className="tjv3-field__label">Contract note ref</span>
              <input
                className="tjv3-field__input"
                value={form.contract_note_ref}
                onChange={(e) => handleChange('contract_note_ref', e.target.value)}
                placeholder="Reference number"
              />
            </div>

            <div className="tjv3-field">
              <span className="tjv3-field__label">Notes</span>
              <textarea
                className="tjv3-field__input"
                rows={3}
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>

            {serverError && (
              <div className="tjv3-cockpit__micro" style={{ color: 'var(--color-loss)' }}>{serverError}</div>
            )}
          </>
        )}
      </Stack>
    </Drawer>
  )
}
