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
    )
    expect(openDetailTrade).toHaveBeenCalledWith(7)
    expect(setActiveView).not.toHaveBeenCalled()
  })

  it('routes review queue tab', () => {
    navigateActionTarget(
      { view: 'review', tab: 'queue' },
      { setActiveView, openDetailTrade },
    )
    expect(setActiveView).toHaveBeenCalledWith('review')
    expect(sessionStorage.getItem('tjv3-review-analytics-tab-v1')).toBe('queue')
  })

  it('routes edge-center view directly', () => {
    navigateActionTarget(
      { view: 'edge-center' },
      { setActiveView, openDetailTrade },
    )
    expect(setActiveView).toHaveBeenCalledWith('edge-center')
  })

  it('redirects analytics view to review', () => {
    navigateActionTarget(
      { view: 'analytics' },
      { setActiveView, openDetailTrade },
    )
    expect(setActiveView).toHaveBeenCalledWith('review')
  })

  it('stores review tab from analytics redirect', () => {
    navigateActionTarget(
      { view: 'review', tab: 'equity' },
      { setActiveView, openDetailTrade },
    )
    expect(setActiveView).toHaveBeenCalledWith('review')
    expect(sessionStorage.getItem('tjv3-review-analytics-tab-v1')).toBe('equity')
  })
})
