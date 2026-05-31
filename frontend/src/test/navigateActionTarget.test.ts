import { describe, expect, it, vi, beforeEach } from 'vitest'
import { navigateActionTarget } from '@/components/actions/navigateActionTarget'

const setActiveView = vi.fn()
const openDetailTrade = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

describe('navigateActionTarget', () => {
  it('opens trade detail when trade_id is set', () => {
    navigateActionTarget(
      { view: 'review', tab: 'queue', trade_id: 7 },
      { setActiveView, openDetailTrade },
      'simple'
    )
    expect(openDetailTrade).toHaveBeenCalledWith(7)
    expect(setActiveView).not.toHaveBeenCalled()
  })

  it('routes review queue tab in simple mode', () => {
    navigateActionTarget(
      { view: 'review', tab: 'queue' },
      { setActiveView, openDetailTrade },
      'simple'
    )
    expect(setActiveView).toHaveBeenCalledWith('review')
    expect(sessionStorage.getItem('tjv3-review-analytics-tab-v1')).toBe('queue')
  })

  it('falls back pro-only risk view to dashboard in simple mode', () => {
    navigateActionTarget(
      { view: 'risk' },
      { setActiveView, openDetailTrade },
      'simple'
    )
    expect(setActiveView).toHaveBeenCalledWith('dashboard')
  })

  it('allows risk view in pro mode', () => {
    navigateActionTarget(
      { view: 'risk' },
      { setActiveView, openDetailTrade },
      'pro'
    )
    expect(setActiveView).toHaveBeenCalledWith('risk')
  })

  it('falls back edge-center to dashboard in simple mode', () => {
    navigateActionTarget(
      { view: 'edge-center' },
      { setActiveView, openDetailTrade },
      'simple'
    )
    expect(setActiveView).toHaveBeenCalledWith('dashboard')
  })

  it('clamps pro-only analytics tab to queue in simple mode', () => {
    navigateActionTarget(
      { view: 'review', tab: 'equity' },
      { setActiveView, openDetailTrade },
      'simple'
    )
    expect(setActiveView).toHaveBeenCalledWith('review')
    expect(sessionStorage.getItem('tjv3-review-analytics-tab-v1')).toBe('queue')
  })
})
