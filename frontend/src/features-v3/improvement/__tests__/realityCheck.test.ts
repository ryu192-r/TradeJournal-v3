import { describe, expect, it } from 'vitest'
import { realityCheck } from '../utils/realityCheck'

describe('realityCheck', () => {
  it('flags empty lesson as no evidence', () => {
    expect(realityCheck('').hasEvidence).toBe(false)
    expect(realityCheck(null).hasEvidence).toBe(false)
    expect(realityCheck(undefined).hasEvidence).toBe(false)
    expect(realityCheck('   ').hasEvidence).toBe(false)
  })

  it('flags free text without keywords as no evidence', () => {
    const r = realityCheck('I was bad today and I should be better.')
    expect(r.hasEvidence).toBe(false)
    expect(r.matched).toEqual([])
  })

  it('detects trade ID with hash prefix', () => {
    const r = realityCheck('Mistake on #42, jumped in too early.')
    expect(r.hasEvidence).toBe(true)
    expect(r.matched).toContain('trade_id')
  })

  it('detects trade ID with "trade N" form', () => {
    const r = realityCheck('Trade 87 was the worst.')
    expect(r.hasEvidence).toBe(true)
    expect(r.matched).toContain('trade_id')
  })

  it('detects ISO date references', () => {
    const r = realityCheck('Refer to journal entry 2026-06-10.')
    expect(r.hasEvidence).toBe(true)
    expect(r.matched).toContain('date')
  })

  it('detects domain keywords (stop, entry, mood)', () => {
    expect(realityCheck('I moved my stop too early').matched).toContain('keyword')
    expect(realityCheck('Bad entry on the breakout').matched).toContain('keyword')
    expect(realityCheck('Mood was off all session').matched).toContain('keyword')
  })

  it('detects multiple kinds simultaneously', () => {
    const r = realityCheck('Trade #5 — moved stop on 2026-06-10')
    expect(r.matched).toContain('trade_id')
    expect(r.matched).toContain('date')
    expect(r.matched).toContain('keyword')
  })

  it('keyword detection is case-insensitive', () => {
    expect(realityCheck('STOP was wrong').hasEvidence).toBe(true)
    expect(realityCheck('Setup failed').hasEvidence).toBe(true)
  })
})
