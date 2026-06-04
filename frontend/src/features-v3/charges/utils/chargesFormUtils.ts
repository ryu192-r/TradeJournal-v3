import type { DailyCharges } from '@/types'
import type { DhanEstimateResult } from '../templates/dhan/dhanChargesTypes'

export type ChargesMode = 'breakdown' | 'total_only'

export interface ChargesFormData {
  trade_date: string
  broker: string
  contract_note_ref: string
  entry_mode: ChargesMode
  total_charges: string
  brokerage: string
  stt: string
  exchange_txn_charges: string
  sebi_charges: string
  stamp_duty: string
  gst: string
  clearing_charges: string
  other_charges: string
  notes: string
}

export interface ChargesFormErrors {
  total_charges?: string
  trade_date?: string
}

export const emptyChargesForm: ChargesFormData = {
  trade_date: '',
  broker: '',
  contract_note_ref: '',
  entry_mode: 'total_only',
  total_charges: '',
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

export function dailyChargesToFormData(dc?: DailyCharges | null, fallbackDate = ''): ChargesFormData {
  if (!dc) {
    return { ...emptyChargesForm, trade_date: fallbackDate }
  }
  return {
    trade_date: dc.trade_date ?? fallbackDate,
    broker: dc.broker ?? '',
    contract_note_ref: dc.contract_note_ref ?? '',
    entry_mode: (dc.entry_mode as ChargesMode) ?? 'breakdown',
    total_charges: dc.total_charges ?? '',
    brokerage: dc.brokerage ?? '',
    stt: dc.stt ?? '',
    exchange_txn_charges: dc.exchange_txn_charges ?? '',
    sebi_charges: dc.sebi_charges ?? '',
    stamp_duty: dc.stamp_duty ?? '',
    gst: dc.gst ?? '',
    clearing_charges: dc.clearing_charges ?? '',
    other_charges: dc.other_charges ?? '',
    notes: dc.notes ?? '',
  }
}

export function formDataToPayload(data: ChargesFormData): Record<string, unknown> {
  const base: Record<string, unknown> = {
    trade_date: data.trade_date,
    entry_mode: data.entry_mode,
    broker: data.broker || null,
    contract_note_ref: data.contract_note_ref || null,
    notes: data.notes || null,
  }
  if (data.entry_mode === 'total_only') {
    base.total_charges = data.total_charges || '0'
    base.brokerage = '0'
    base.stt = '0'
    base.exchange_txn_charges = '0'
    base.sebi_charges = '0'
    base.stamp_duty = '0'
    base.gst = '0'
    base.clearing_charges = '0'
    base.other_charges = '0'
  } else {
    base.brokerage = data.brokerage || '0'
    base.stt = data.stt || '0'
    base.exchange_txn_charges = data.exchange_txn_charges || '0'
    base.sebi_charges = data.sebi_charges || '0'
    base.stamp_duty = data.stamp_duty || '0'
    base.gst = data.gst || '0'
    base.clearing_charges = data.clearing_charges || '0'
    base.other_charges = data.other_charges || '0'
  }
  return base
}

export function parseMoney(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function computeBreakdownTotal(data: ChargesFormData): string {
  const sum = (
    parseMoney(data.brokerage) +
    parseMoney(data.stt) +
    parseMoney(data.exchange_txn_charges) +
    parseMoney(data.sebi_charges) +
    parseMoney(data.stamp_duty) +
    parseMoney(data.gst) +
    parseMoney(data.clearing_charges) +
    parseMoney(data.other_charges)
  )
  return sum.toFixed(2)
}

export function validateChargesForm(data: ChargesFormData): ChargesFormErrors {
  const errors: ChargesFormErrors = {}
  if (!data.trade_date) {
    errors.trade_date = 'Date is required'
  }
  if (data.entry_mode === 'total_only') {
    const total = Number(data.total_charges)
    if (data.total_charges === '' || Number.isNaN(total)) {
      errors.total_charges = 'Total charges is required'
    } else if (total < 0) {
      errors.total_charges = 'Total charges cannot be negative'
    }
  }
  return errors
}

export function formatCurrencyValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatChargesDateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })
}

// ────────────────────────── Apply estimate to form ──────────────────────────

export function applyEstimateToFormData(
  current: ChargesFormData,
  estimate: DhanEstimateResult,
): ChargesFormData {
  if (current.entry_mode === 'total_only') {
    return {
      ...current,
      total_charges: String(estimate.total_charges),
      broker: 'Dhan',
      notes: current.notes || 'Estimated using Dhan template. Verify contract note.',
    }
  }
  // Breakdown mode — fill component fields + IPFT rolled into other_charges
  return {
    ...current,
    brokerage: String(estimate.brokerage),
    stt: String(estimate.stt),
    exchange_txn_charges: String(estimate.exchange_txn_charges),
    sebi_charges: String(estimate.sebi_charges),
    stamp_duty: String(estimate.stamp_duty),
    gst: String(estimate.gst),
    clearing_charges: '0',
    other_charges: String(estimate.other_charges),
    broker: 'Dhan',
    notes: current.notes || 'Estimated using Dhan template. Verify contract note.',
  }
}
