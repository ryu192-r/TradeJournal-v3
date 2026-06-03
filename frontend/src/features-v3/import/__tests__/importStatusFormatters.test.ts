import { describe, expect, it } from 'vitest'
import {
  brokerMapsMetadata,
  describeBroker,
  summarizeImportResult,
} from '../utils/importStatusFormatters'

describe('summarizeImportResult', () => {
  it('returns null for null input', () => {
    expect(summarizeImportResult(null)).toBeNull()
  })

  it('returns counts directly from backend response', () => {
    const r = summarizeImportResult({
      status: 'success',
      added: 5,
      updated: 2,
      skipped: 1,
      total: 8,
      errors: [],
      preview: [],
    })
    expect(r).toEqual({
      added: 5,
      updated: 2,
      skipped: 1,
      total: 8,
      errorCount: 0,
      effectivelyImported: 7,
    })
  })

  it('counts errors from errors array', () => {
    const r = summarizeImportResult({
      status: 'error',
      added: 0,
      updated: 0,
      skipped: 0,
      total: 3,
      errors: ['row 1 bad', 'row 2 missing symbol'],
      preview: [],
    })
    expect(r?.errorCount).toBe(2)
  })

  it('clamps non-finite numbers to zero (no NaN)', () => {
    const r = summarizeImportResult({
      status: 'error',
      added: NaN as unknown as number,
      updated: Infinity as unknown as number,
      skipped: -Infinity as unknown as number,
      total: NaN as unknown as number,
      errors: [],
      preview: [],
    })
    expect(r?.added).toBe(0)
    expect(r?.updated).toBe(0)
    expect(r?.skipped).toBe(0)
    expect(r?.total).toBe(0)
  })
})

describe('describeBroker', () => {
  it('returns specific copy for known brokers', () => {
    expect(describeBroker('zerodha')).toMatch(/Kite/i)
    expect(describeBroker('dhan')).toMatch(/Dhan/i)
    expect(describeBroker('generic')).toMatch(/Generic/i)
  })

  it('falls back to a safe label for unknown brokers (no fake claims)', () => {
    expect(describeBroker('xxx')).toMatch(/Broker CSV/i)
  })
})

describe('brokerMapsMetadata', () => {
  it('reports metadata mapping only for parsers that actually do it', () => {
    expect(brokerMapsMetadata('zerodha')).toBe(true)
    expect(brokerMapsMetadata('dhan')).toBe(true)
    expect(brokerMapsMetadata('generic')).toBe(false)
    expect(brokerMapsMetadata('unknown')).toBe(false)
  })
})
