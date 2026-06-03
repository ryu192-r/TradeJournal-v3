import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import App from '@/App'
import { V3PreviewPage } from '../preview/V3PreviewPage'
import { V3Shell } from '../shell/V3Shell'

const mocks = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  isAuthenticated: true,
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: mocks.isAuthenticated,
    fetchMe: mocks.fetchMe,
  }),
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: () => ({
    activeView: 'dashboard',
    tradeFormMode: 'list',
    selectedTradeId: null,
    navMode: 'simple',
    setActiveView: vi.fn(),
    closeTradeForm: vi.fn(),
    openCreateTrade: vi.fn(),
    openDetailTrade: vi.fn(),
  }),
}))

vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="legacy-shell">{children}</div>,
}))

vi.mock('@/store/toastStore', () => ({
  ToastContainer: () => null,
}))

vi.mock('@/components/actions/ActionsInbox', () => ({
  ActionsInbox: () => null,
}))

vi.mock('@/components/ui/InstallPrompt', () => ({
  InstallPrompt: () => null,
}))

vi.mock('../cockpit', () => ({
  CockpitV3Page: () => (
    <div>
      <h1>Cockpit</h1>
      <div>Cockpit v3 mock</div>
    </div>
  ),
}))

vi.mock('../trades', () => ({
  TradesV3Page: () => (
    <div>
      <h1>Trades</h1>
      <div>Trades v3 mock</div>
    </div>
  ),
}))

vi.mock('@/pages/DashboardPage', () => ({
  DashboardPage: () => <div>Legacy dashboard mock</div>,
}))

describe('V3 shell preview', () => {
  beforeEach(() => {
    mocks.fetchMe.mockClear()
    mocks.isAuthenticated = true
    localStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('renders V3PreviewPage', () => {
    render(<V3PreviewPage />)
    expect(screen.getByRole('heading', { name: 'Cockpit', level: 1 })).toBeInTheDocument()
  })

  it('renders V3Shell sidebar, topbar, and content', () => {
    render(
      <V3Shell activeSection="cockpit" onSectionChange={vi.fn()}>
        <div>Preview content slot</div>
      </V3Shell>,
    )

    expect(screen.getByLabelText('V3 preview navigation')).toBeInTheDocument()
    expect(screen.getByText('V3 shell preview')).toBeInTheDocument()
    expect(screen.getByText('Preview content slot')).toBeInTheDocument()
  })

  it('renders preview route content', () => {
    render(<V3PreviewPage />)
    expect(screen.getByText('Cockpit v3 mock')).toBeInTheDocument()
  })

  it('renders desktop nav labels', () => {
    render(<V3PreviewPage />)
    expect(screen.getByRole('button', { name: /Cockpit/ })).toBeInTheDocument()
    expect(screen.getAllByText('Trades').length).toBeGreaterThan(0)
    expect(screen.getByText('Playbooks')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('renders mobile nav labels', () => {
    render(<V3PreviewPage />)
    const mobileNav = screen.getByRole('navigation', { name: 'V3 preview mobile navigation' })
    expect(mobileNav).toBeInTheDocument()
    expect(within(mobileNav).getByRole('button', { name: /Today/ })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('button', { name: /Add/ })).toBeInTheDocument()
    expect(within(mobileNav).getByRole('button', { name: /More/ })).toBeInTheDocument()
  })

  it('does not present fake trading data as real user data', () => {
    render(<V3PreviewPage />)
    expect(screen.queryByText(/open p&l/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/win rate/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/live account/i)).not.toBeInTheDocument()
    expect(screen.getByText('Cockpit v3 mock')).toBeInTheDocument()
  })

  it('opens and closes drawer preview', async () => {
    const user = userEvent.setup()
    render(<V3PreviewPage />)

    await user.click(screen.getAllByRole('button', { name: /Review/ })[0])
    await user.click(screen.getByRole('button', { name: 'Open drawer preview' }))
    expect(screen.getByRole('dialog', { name: 'V3 drawer preview' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog', { name: 'V3 drawer preview' })).not.toBeInTheDocument()
  })

  it('renders V3 preview route without legacy shell', async () => {
    window.history.pushState({}, '', '/v3-preview')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Cockpit', level: 1 })).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-shell')).not.toBeInTheDocument()
  })

  it('allows unauthenticated V3 preview route in dev without legacy shell', async () => {
    mocks.isAuthenticated = false
    window.history.pushState({}, '', '/v3-preview')

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Cockpit', level: 1 })).toBeInTheDocument()
    expect(localStorage.getItem('auth_token')).toBeNull()
    expect(screen.queryByTestId('legacy-shell')).not.toBeInTheDocument()
  })

  it('waits for stored auth token before showing V3 demo gate', () => {
    mocks.isAuthenticated = false
    localStorage.setItem('auth_token', 'stored-token')
    window.history.pushState({}, '', '/v3-preview')

    render(<App />)

    expect(screen.queryByDisplayValue('demo@tradejournal.local')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Preview@123')).not.toBeInTheDocument()
    expect(screen.queryByTestId('legacy-shell')).not.toBeInTheDocument()
  })

  it('renders V3 live shell for authenticated app route', async () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByLabelText('Main navigation')).toBeInTheDocument()
    expect(await screen.findByText('Cockpit v3 mock')).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-shell')).not.toBeInTheDocument()
  })

  it('renders Trades v3 from preview local navigation', async () => {
    const user = userEvent.setup()
    render(<V3PreviewPage />)

    await user.click(screen.getAllByRole('button', { name: /Trades/ })[0])
    expect(screen.getByRole('heading', { name: 'Trades', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Trades v3 mock')).toBeInTheDocument()
  })
})
