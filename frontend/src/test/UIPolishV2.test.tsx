import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TradeLightweightChart } from '@/components/charts/TradeLightweightChart'
import { EmptyState } from '@/components/ui'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'

vi.mock('lightweight-charts', () => ({
  createChart: () => ({
    addSeries: () => ({ setData: vi.fn(), createPriceLine: vi.fn() }),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn() }),
    priceScale: () => ({ applyOptions: vi.fn() }),
  }),
  CandlestickSeries: {},
  HistogramSeries: {},
  createSeriesMarkers: vi.fn(),
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
}))

const mockChartResponse = {
  candles: [],
  markers: [],
  price_lines: [],
  source: 'auto',
  meta: { has_real_data: false, is_mock: false, message: 'No provider' },
}

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  return {
    ...actual,
    useQuery: () => ({
      data: mockChartResponse,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
  }
})

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('UI polish v2', () => {
  beforeEach(() => {
    useAppStore.setState({ sidebarOpen: true, activeView: 'dashboard' })
    useAuthStore.setState({
      user: { id: 1, email: 'x@y.com', full_name: 'Trader One', is_active: true },
      isAuthenticated: true,
      isLoading: false,
      token: 't',
      error: null,
    } as any)
  })

  it('shows chart empty state and allows switch to 1D from intraday', async () => {
    const user = userEvent.setup()
    renderWithClient(<TradeLightweightChart trade={{ id: 12, symbol: 'RELIANCE' } as any} />)
    await user.click(screen.getByRole('button', { name: '1m' }))
    expect(screen.getByText(/Intraday candles are not configured yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Switch to 1D' }))
    expect(screen.getByText(/No provider/i)).toBeInTheDocument()
  })

  it('renders EmptyState action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<EmptyState title="No trades yet" message="Add one." action={{ label: 'Add Trade', onClick }} />)
    await user.click(screen.getByRole('button', { name: 'Add Trade' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders mobile nav core links', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trades' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })
})
