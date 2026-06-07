import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ActiveView } from '@/app/navigation'
import { V3LiveApp } from '../shell/V3LiveApp'
import { v3NavigationSections, v3MobileNavigationItems } from '../shell/v3Navigation'

const storeMocks = vi.hoisted((): {
  activeView: ActiveView
  tradeFormMode: 'list' | 'create' | 'edit' | 'detail'
  selectedTradeId: number | null
  navMode: 'simple' | 'pro'
  setActiveView: ReturnType<typeof vi.fn>
  closeTradeForm: ReturnType<typeof vi.fn>
  openCreateTrade: ReturnType<typeof vi.fn>
  openDetailTrade: ReturnType<typeof vi.fn>
} => ({
  activeView: 'dashboard',
  tradeFormMode: 'list',
  selectedTradeId: null,
  navMode: 'simple',
  setActiveView: vi.fn(),
  closeTradeForm: vi.fn(),
  openCreateTrade: vi.fn(),
  openDetailTrade: vi.fn(),
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: () => storeMocks,
}))

vi.mock('../cockpit', () => ({
  CockpitV3Page: () => (
    <div>
      <h1>Cockpit</h1>
      <div>Cockpit v3 live</div>
    </div>
  ),
}))

vi.mock('../trades', () => ({
  TradesV3Page: () => (
    <div>
      <h1>Trades</h1>
      <div>Trades v3 live</div>
    </div>
  ),
}))

vi.mock('../import', () => ({
  ImportV3Page: () => (
    <div>
      <h1>Import</h1>
      <div>Import v3 live</div>
    </div>
  ),
}))

vi.mock('../settings', () => ({
  SettingsV3Page: () => (
    <div>
      <h1>Settings</h1>
      <div>Settings v3 live</div>
    </div>
  ),
}))

vi.mock('../analytics', () => ({
  AnalyticsV3Page: () => (
    <div>
      <h1>Analytics</h1>
      <div>Analytics v3 live</div>
    </div>
  ),
}))

vi.mock('../reports', () => ({
  ReportsV3Page: () => (
    <div>
      <h1>Reports</h1>
      <div>Reports v3 live</div>
    </div>
  ),
}))

vi.mock('../review', () => ({
  ReviewV3Page: () => (
    <div>
      <h1>Review</h1>
      <div>Review v3 live</div>
    </div>
  ),
}))

vi.mock('@/components/layout/ProModeGate', () => ({
  ProModeGate: ({ view }: { view: string }) => <div>Pro mode gate for {view}</div>,
}))

describe('V3 live app promotion', () => {
  beforeEach(() => {
    storeMocks.activeView = 'dashboard'
    storeMocks.tradeFormMode = 'list'
    storeMocks.selectedTradeId = null
    storeMocks.navMode = 'simple'
    storeMocks.setActiveView.mockClear()
    storeMocks.closeTradeForm.mockClear()
    storeMocks.openCreateTrade.mockClear()
    storeMocks.openDetailTrade.mockClear()
  })

  it('renders V3 shell in live mode for dashboard', () => {
    render(<V3LiveApp />)
    expect(screen.getByLabelText('Main navigation')).toBeInTheDocument()
    expect(screen.getByText('Cockpit v3 live')).toBeInTheDocument()
  })

  it('maps Trades navigation to Trades v3', async () => {
    const user = userEvent.setup()
    render(<V3LiveApp />)

    await user.click(screen.getAllByRole('button', { name: /Trades/ })[0])
    expect(storeMocks.setActiveView).toHaveBeenCalledWith('trades')
  })

  it('renders Trades v3 when activeView is trades', () => {
    storeMocks.activeView = 'trades'
    render(<V3LiveApp />)
    expect(screen.getByText('Trades v3 live')).toBeInTheDocument()
  })

  it('renders Import v3 when import section is active', async () => {
    const user = userEvent.setup()
    render(<V3LiveApp />)

    // Import is a topbar action button (not a sidebar item) per Phase 8 spec.
    await user.click(screen.getByRole('button', { name: /Import/ }))
    expect(await screen.findByText('Import v3 live')).toBeInTheDocument()
  })

  it('routes Review navigation through live app store', async () => {
    const user = userEvent.setup()
    render(<V3LiveApp />)

    await user.click(screen.getAllByRole('button', { name: /Review/ })[0])
    expect(storeMocks.setActiveView).toHaveBeenCalledWith('review')
  })

  it('routes Settings navigation through live app store', async () => {
    const user = userEvent.setup()
    render(<V3LiveApp />)

    await user.click(screen.getByRole('button', { name: /Settings/ }))
    expect(storeMocks.setActiveView).toHaveBeenCalledWith('settings')
  })
})

describe('V3 view mapping', () => {
  it('maps dashboard to cockpit section', async () => {
    const { activeViewToV3Section } = await import('../shell/v3ViewMapping')
    expect(activeViewToV3Section('dashboard', 'list', null)).toBe('cockpit')
    expect(activeViewToV3Section('trades', 'list', null)).toBe('trades')
    expect(activeViewToV3Section('trades', 'detail', null)).toBe('trades')
  })

  it('maps analytics, reports, review to their own sections', async () => {
    const { activeViewToV3Section, v3SectionToActiveView } = await import('../shell/v3ViewMapping')
    expect(activeViewToV3Section('analytics', 'list', null)).toBe('analytics')
    expect(activeViewToV3Section('reports', 'list', null)).toBe('reports')
    expect(activeViewToV3Section('review', 'list', null)).toBe('review')
    expect(v3SectionToActiveView('analytics')).toBe('analytics')
    expect(v3SectionToActiveView('reports')).toBe('reports')
    expect(v3SectionToActiveView('review')).toBe('review')
  })
})

describe('V3 analytics/reports/review routing fix', () => {
  beforeEach(() => {
    storeMocks.activeView = 'dashboard'
    storeMocks.tradeFormMode = 'list'
    storeMocks.selectedTradeId = null
    storeMocks.navMode = 'pro'
    storeMocks.setActiveView.mockClear()
  })

  it('renders Review page when activeView is review', async () => {
    storeMocks.activeView = 'review'
    render(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(await screen.findByText('Review v3 live')).toBeInTheDocument()
    expect(screen.queryByText('Analytics v3 live')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports v3 live')).not.toBeInTheDocument()
  })

  it('renders Analytics page when activeView is analytics', async () => {
    storeMocks.activeView = 'analytics'
    render(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect(await screen.findByText('Analytics v3 live')).toBeInTheDocument()
    expect(screen.queryByText('Review v3 live')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports v3 live')).not.toBeInTheDocument()
  })

  it('renders Reports page when activeView is reports', async () => {
    storeMocks.activeView = 'reports'
    render(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(await screen.findByText('Reports v3 live')).toBeInTheDocument()
    expect(screen.queryByText('Review v3 live')).not.toBeInTheDocument()
    expect(screen.queryByText('Analytics v3 live')).not.toBeInTheDocument()
  })

  it('navigates correctly through Analytics → Reports → Review', async () => {
    storeMocks.activeView = 'analytics'
    const { rerender } = render(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect(screen.queryByText('Review v3 live')).not.toBeInTheDocument()

    storeMocks.activeView = 'reports'
    rerender(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.queryByText('Analytics v3 live')).not.toBeInTheDocument()

    storeMocks.activeView = 'review'
    rerender(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(screen.queryByText('Reports v3 live')).not.toBeInTheDocument()
  })

  it('renders own page when reviewTargetId exists and view is analytics', async () => {
    storeMocks.activeView = 'analytics'
    storeMocks.selectedTradeId = null
    render(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Analytics' })).toBeInTheDocument()
    expect(screen.queryByText('Review v3 live')).not.toBeInTheDocument()
  })

  it('renders own page when reviewTargetId exists and view is reports', async () => {
    storeMocks.activeView = 'reports'
    storeMocks.selectedTradeId = null
    render(<V3LiveApp />)
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.queryByText('Review v3 live')).not.toBeInTheDocument()
  })

  it('routes Review navigation through setActiveView', async () => {
    const user = userEvent.setup()
    render(<V3LiveApp />)

    await user.click(screen.getAllByRole('button', { name: /Review/ })[0])
    expect(storeMocks.setActiveView).toHaveBeenCalledWith('review')
  })

})

describe('V3 navigation items have unique IDs', () => {
  it('sidebar navigation items have no duplicate IDs', () => {
    const sidebarIds = v3NavigationSections.flatMap((s) => s.items.map((i) => i.id))
    expect(new Set(sidebarIds).size).toBe(sidebarIds.length)
  })

  it('mobile navigation items have no duplicate IDs', () => {
    const mobileIds = v3MobileNavigationItems.map((i) => i.id)
    expect(new Set(mobileIds).size).toBe(mobileIds.length)
  })

  it('analytics, reports, and review each appear exactly once in sidebar', () => {
    const sidebarIds = v3NavigationSections.flatMap((s) => s.items.map((i) => i.id))
    expect(sidebarIds.filter((id) => id === 'analytics').length).toBe(1)
    expect(sidebarIds.filter((id) => id === 'reports').length).toBe(1)
    expect(sidebarIds.filter((id) => id === 'review').length).toBe(1)
  })
})
