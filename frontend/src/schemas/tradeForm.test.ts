import { describe, expect, it } from 'vitest'
import { formDataToApiPayload, tradeFormSchema, type TradeFormData } from './tradeForm'

const baseForm: TradeFormData = {
  symbol: 'TCS',
  entry_price: '100',
  exit_price: undefined,
  quantity: '10',
  entry_time: '2026-05-22T09:30',
  exit_time: undefined,
  fees: '0',
  setup: undefined,
  tactic: undefined,
  stop_price: '90',
  target_price: '130',
  tags: undefined,
  notes: undefined,
}

describe('formDataToApiPayload stop loss semantics', () => {
  it('create treats single SL field as both original and current stop', () => {
    const payload = formDataToApiPayload(baseForm, { mode: 'create' })
    expect(payload.stop_price).toBe('90')
    expect(payload.original_stop_price).toBe('90')
    expect(payload.stop_loss_status).toBe('original')
  })

  it('edit treats single SL field as current stop and preserves original risk plan', () => {
    const payload = formDataToApiPayload({ ...baseForm, stop_price: '100' }, { mode: 'edit' })
    expect(payload.stop_price).toBe('100')
    expect(payload).not.toHaveProperty('original_stop_price')
    expect(payload).not.toHaveProperty('stop_loss_status')
  })
})

describe('tradeFormSchema numeric validation', () => {
  it.each([
    ['entry_price', '0'],
    ['entry_price', '-1'],
    ['quantity', '0'],
    ['quantity', '-1'],
    ['exit_price', '0'],
    ['stop_price', '0'],
    ['target_price', '-1'],
    ['fees', '-1'],
    ['executed_order_count', '0'],
    ['executed_order_count', '1.5'],
    ['entry_price', 'abc'],
  ])('rejects invalid %s=%s', (field, value) => {
    const result = tradeFormSchema.safeParse({ ...baseForm, [field]: value })
    expect(result.success).toBe(false)
  })

  it('allows blank optional numeric fields', () => {
    const result = tradeFormSchema.safeParse({
      ...baseForm,
      exit_price: '',
      stop_price: '',
      target_price: '',
      executed_order_count: '',
    })
    expect(result.success).toBe(true)
  })
})
