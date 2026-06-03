import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ActiveView } from '@/app/navigation'
import { V3LiveApp } from '../shell/V3LiveApp'

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
})
