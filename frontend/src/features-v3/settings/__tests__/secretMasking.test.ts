import { describe, expect, it } from 'vitest'
import { describeStoredSecret, maskApiKeyForDisplay } from '../utils/secretMasking'

describe('describeStoredSecret', () => {
  it('shows bullets when a key is stored', () => {
    const r = describeStoredSecret(true)
    expect(r.hasSecret).toBe(true)
    expect(r.displayText).not.toMatch(/[a-zA-Z0-9]/) // no real characters
    expect(r.displayText.length).toBeGreaterThan(0)
  })

  it('shows "Not configured" when no key is stored', () => {
    const r = describeStoredSecret(false)
    expect(r.hasSecret).toBe(false)
    expect(r.displayText).toBe('Not configured')
  })
})

describe('maskApiKeyForDisplay', () => {
  it('returns "Not configured" for empty values', () => {
    expect(maskApiKeyForDisplay(null)).toBe('Not configured')
    expect(maskApiKeyForDisplay(undefined)).toBe('Not configured')
    expect(maskApiKeyForDisplay('')).toBe('Not configured')
    expect(maskApiKeyForDisplay('   ')).toBe('Not configured')
  })

  it('returns bullets for very short values (no preview)', () => {
    const r = maskApiKeyForDisplay('abc12')
    expect(r).not.toContain('abc12')
  })

  it('keeps only short prefix and suffix for long keys', () => {
    const key = 'sk-abc1234567890def'
    const r = maskApiKeyForDisplay(key)
    expect(r.startsWith('sk-a')).toBe(true)
    expect(r.endsWith('ef')).toBe(true)
    // Middle portion is not exposed.
    expect(r).not.toContain('1234567890')
  })

  it('never returns the full key', () => {
    const key = 'sk-1234567890abcdef-xyz-extra-very-long'
    const r = maskApiKeyForDisplay(key)
    expect(r).not.toBe(key)
  })
})
