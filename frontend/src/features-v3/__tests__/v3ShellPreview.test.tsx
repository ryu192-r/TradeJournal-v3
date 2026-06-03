import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import App from '@/App'
import { V3PreviewPage } from '../preview/V3PreviewPage'
import { V3Shell } from '../shell/V3Shell'

const mocks = vi.hoisted(() => ({
  fetchMe: vi.fn(),
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    fetchMe: mocks.fetchMe,
  }),
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: () => ({
    activeView: 'dashboard',
    tradeFormMode: 'list',
    selectedTradeId: null,
    navMode: 'simple',
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

vi.mock('@/pages/DashboardPage', () => ({
  DashboardPage: () => <div>Legacy dashboard mock</div>,
}))

describe('V3 shell preview', () => {
  beforeEach(() => {
    mocks.fetchMe.mockClear()
    window.history.pushState({}, '', '/')
  })

  it('renders V3PreviewPage', () => {
    render(<V3PreviewPage />)
    expect(screen.getByRole('heading', { name: 'V3 Shell Preview', level: 1 })).toBeInTheDocument()
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
    expect(screen.getByText('Isolated rebuild shell for the next TradeJournal interface.')).toBeInTheDocument()
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
    expect(screen.getAllByText('No production data connected').length).toBeGreaterThan(0)
    expect(screen.getByText('Static formatting demo, not account data.')).toBeInTheDocument()
  })

  it('opens and closes drawer preview', async () => {
    const user = userEvent.setup()
    render(<V3PreviewPage />)

    await user.click(screen.getByRole('button', { name: 'Open drawer preview' }))
    expect(screen.getByRole('dialog', { name: 'V3 drawer preview' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog', { name: 'V3 drawer preview' })).not.toBeInTheDocument()
  })

  it('renders V3 preview route without legacy shell', async () => {
    window.history.pushState({}, '', '/v3-preview')
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'V3 Shell Preview', level: 1 })).toBeInTheDocument()
    expect(screen.queryByTestId('legacy-shell')).not.toBeInTheDocument()
  })

  it('keeps legacy route on existing AppShell', () => {
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(screen.getByTestId('legacy-shell')).toBeInTheDocument()
  })
})
