import { describe, expect, it } from 'vitest'
import {
  canAccessView,
  getSimpleFallbackView,
  isProDashboardWidget,
  normalizeNavMode,
  reviewTabsForMode,
} from '@/app/interfaceMode'
import { isViewVisibleInMode } from '@/app/navigation'

describe('interface mode', () => {
  it('defaults unknown persisted mode to simple', () => {
    expect(normalizeNavMode(undefined)).toBe('simple')
    expect(normalizeNavMode('advanced')).toBe('pro')
  })

  it('simple mode allows only core views', () => {
    expect(isViewVisibleInMode('dashboard', 'simple')).toBe(true)
    expect(isViewVisibleInMode('coach', 'simple')).toBe(false)
    expect(canAccessView('edge-center', 'simple')).toBe(false)
  })

  it('maps pro views to simple fallbacks', () => {
    expect(getSimpleFallbackView('coach')).toBe('review')
    expect(getSimpleFallbackView('capital')).toBe('settings')
  })

  it('limits review tabs in simple mode', () => {
    expect(reviewTabsForMode('simple')).toEqual(['overview', 'queue'])
    expect(reviewTabsForMode('pro').length).toBeGreaterThan(2)
  })

  it('marks intelligence widgets as pro', () => {
    expect(isProDashboardWidget('deep')).toBe(true)
    expect(isProDashboardWidget('kpis')).toBe(false)
  })
})
