import { describe, expect, it } from 'vitest'
import {
  emptyChargesForm,
  dailyChargesToFormData,
  formDataToPayload,
  parseMoney,
  computeBreakdownTotal,
  validateChargesForm,
  formatCurrencyValue,
} from '../utils/chargesFormUtils'

const sampleDailyCharges = {
  id: 1,
  trade_date: '2025-09-01',
  broker: 'Zerodha',
  account_ref: null,
  contract_note_ref: 'CN123',
  entry_mode: 'breakdown',
  brokerage: '100',
  stt: '50',
  exchange_txn_charges: '10',
  sebi_charges: '5',
  stamp_duty: '2',
  gst: '18',
  clearing_charges: '1',
  other_charges: '0',
  total_charges: '186',
  notes: 'notes',
  created_at: '',
  updated_at: '',
} as const

describe('chargesFormUtils', () => {
  it('dailyChargesToFormData fills fields from record', () => {
    const form = dailyChargesToFormData(sampleDailyCharges)
    expect(form.trade_date).toBe('2025-09-01')
    expect(form.broker).toBe('Zerodha')
    expect(form.entry_mode).toBe('breakdown')
    expect(form.brokerage).toBe('100')
    expect(form.total_charges).toBe('186')
  })

  it('dailyChargesToFormData falls back to provided date when null', () => {
    const form = dailyChargesToFormData(null, '2025-09-02')
    expect(form.trade_date).toBe('2025-09-02')
    expect(form.entry_mode).toBe('total_only')
  })

  it('formDataToPayload for total_only sets components to zero and includes total', () => {
    const payload = formDataToPayload({
      ...emptyChargesForm,
      entry_mode: 'total_only',
      total_charges: '250',
    })
    expect(payload.entry_mode).toBe('total_only')
    expect(payload.total_charges).toBe('250')
    expect(payload.brokerage).toBe('0')
  })

  it('formDataToPayload for breakdown sends components and omits total override', () => {
    const payload = formDataToPayload({
      ...emptyChargesForm,
      entry_mode: 'breakdown',
      brokerage: '100',
      stt: '50',
    })
    expect(payload.entry_mode).toBe('breakdown')
    expect(payload.brokerage).toBe('100')
    expect(payload.stt).toBe('50')
    expect(payload.total_charges).toBeUndefined()
  })

  it('parseMoney returns 0 for empty string', () => {
    expect(parseMoney('')).toBe(0)
    expect(parseMoney('abc')).toBe(0)
    expect(parseMoney('-10')).toBe(0)
    expect(parseMoney('25.5')).toBe(25.5)
  })

  it('computeBreakdownTotal sums correctly', () => {
    const total = computeBreakdownTotal({
      ...emptyChargesForm,
      brokerage: '100',
      stt: '50.5',
      exchange_txn_charges: '',
      sebi_charges: '0',
      stamp_duty: '2',
      gst: '18',
      clearing_charges: '1',
      other_charges: '0.5',
    })
    expect(total).toBe('172.00')
  })

  it('validateChargesForm requires date', () => {
    const errors = validateChargesForm({ ...emptyChargesForm, trade_date: '' })
    expect(errors.trade_date).toBeDefined()
  })

  it('validateChargesForm requires total in total_only mode', () => {
    const errors = validateChargesForm({ ...emptyChargesForm, entry_mode: 'total_only', total_charges: '' })
    expect(errors.total_charges).toBeDefined()
  })

  it('validateChargesForm allows breakdown with empty components', () => {
    const errors = validateChargesForm({ ...emptyChargesForm, entry_mode: 'breakdown', trade_date: '2025-09-01' })
    expect(Object.keys(errors).length).toBe(0)
  })

  it('formatCurrencyValue handles null and zero', () => {
    expect(formatCurrencyValue(null)).toBe('-')
    expect(formatCurrencyValue('')).toBe('-')
    expect(formatCurrencyValue('0')).toBe('0.00')
    expect(formatCurrencyValue('1234.5')).toBe('1,234.50')
  })
})
