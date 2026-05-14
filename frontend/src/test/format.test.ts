import { describe, it, expect } from 'vitest'
import { formatCurrency } from '@/utils/format'

describe('formatCurrency', () => {
  it('formats INR (default) with k abbreviation for thousands', () => {
    expect(formatCurrency(2500)).toBe('₹2.5k')
  })

  it('formats USD with comma separators', () => {
    expect(formatCurrency(2500, 'USD')).toBe('$2,500')
  })

  it('formats EUR without decimal places', () => {
    expect(formatCurrency(99.99, 'EUR')).toBe('€100')
  })

  it('formats 0 as ₹0', () => {
    expect(formatCurrency(0)).toBe('₹0')
  })

  it('handles string input', () => {
    expect(formatCurrency('1500')).toBe('₹1.5k')
  })
})
