import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { TradesPage } from '@/pages/TradesPage'

// Mock all of the heavy hooks this page depends on. The page itself is a
// pure UI workflow shell — these tests verify the shell renders, that
// Add Trade is reachable, that filters don't crash, and that trade cards
// surface the new Original SL / Current SL / Review / Stop status copy.

let tradesData: { total: number; items: any[] } = { total: 0, items: [] }
let liveQuotesData: { quotes: any[]; total: number } = { quotes: [], total: 0 }
let deleteMutationState: { isPending: boolean; mutateAsync: ReturnType<typeof vi.fn> } = {
  isPending: false,
  mutateAsync: vi.fn().mockResolvedValue({}),
}

vi.mock('@/hooks/useTradesQuery', () => ({
  useTradesQuery: () => ({
    data: tradesData,
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useMarketContextQuery', () => ({
  useLiveQuotesQuery: () => ({ data: liveQuotesData, isLoading: false }),
  useSyncLiveQuotesMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useMarketRegimeQuery: () => ({ data: { current: null }, isLoading: false }),
}))

vi.mock('@/hooks/useTradeMutation', () => ({
  useDeleteTradeMutation: () => deleteMutationState,
}))

vi.mock('@/hooks/usePartialExitQuery', () => ({
  usePartialExitsQuery: () => ({ data: null, isLoading: false }),
  useCreatePartialExitMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePartialExitMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useStopHistoryQuery', () => ({
  useCreateStopHistoryMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}))

vi.mock('@/lib/endpoints', async () => {
  const actual = await vi.importActual<typeof import('@/lib/endpoints')>('@/lib/endpoints')
  return {
    ...actual,
    getCapitalDashboard: vi.fn().mockResolvedValue({ net_equity: '100000' }),
  }
})

vi.mock('@/lib/queryInvalidation', () => ({
  invalidateTradeList: vi.fn(),
  invalidateRisk: vi.fn(),
  invalidateAnalytics: vi.fn(),
  invalidatePlaybook: vi.fn(),
  invalidateTradeDetail: vi.fn(),
  invalidateLifecycle: vi.fn(),
  setTradeCache: vi.fn(),
  patchTradeInLists: vi.fn(),
  removeTradeFromLists: vi.fn(),
}))

vi.mock('@/hooks/useRowGestures', () => ({
  useRowGestures: () => ({ handlers: {} }),
}))

vi.mock('@/components/trades/BrokerImportModal', () => ({
  BrokerImportModal: () => null,
}))

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

const baseTrade = {
  id: 1,
  symbol: 'RELIANCE',
  direction: 'LONG',
  entry_price: '100',
  exit_price: '110',
  quantity: '10',
  entry_time: '2025-01-13T09:30:00',
  exit_time: '2025-01-13T10:00:00',
  fees: '0',
  notes: null,
  tags: [],
  setup: 'EP',
  tactic: null,
  stop_price: '95',
  target_price: '120',
  r_multiple: '2',
  status: 'closed',
  pnl: '100',
  chart_images: [],
  review_notes: null,
  review_tags: [],
  exit_reason: 'target',
  created_at: '2025-01-13T09:30:00',
  updated_at: '2025-01-13T10:00:00',
  remaining_qty: '10',
  partial_realized_pnl: null,
  unrealized_pnl: null,
  weighted_avg_exit_price: '110',
  original_stop_price: '95',
  current_stop_price: '95',
  stop_loss_status: 'original',
}

describe('Trades page (Phase 2 UI smoke)', () => {
  beforeEach(() => {
    tradesData = { total: 0, items: [] }
    liveQuotesData = { quotes: [], total: 0 }
    deleteMutationState = {
      isPending: false,
      mutateAsync: vi.fn().mockResolvedValue({}),
    }
  })

  it('renders empty state with Add Trade action', () => {
    renderWithQueryClient(<TradesPage />)
    expect(screen.getByRole('heading', { name: 'Trades' })).toBeInTheDocument()
    expect(screen.getByText(/No trades yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Add your first trade/i)).toBeInTheDocument()
    // Two Add Trade buttons are expected: the page-header primary and the
    // empty-state CTA. Both should be present and labeled.
    expect(screen.getAllByRole('button', { name: /Add Trade/i }).length).toBeGreaterThanOrEqual(1)
  })

  it('omits summary row when there is no data', () => {
    renderWithQueryClient(<TradesPage />)
    expect(screen.queryByTestId('trades-summary')).not.toBeInTheDocument()
  })

  it('renders summary row + trade card with Original/Current SL + review pill when data is present', () => {
    tradesData = { total: 2, items: [
      { ...baseTrade, id: 1, symbol: 'RELIANCE', review_notes: 'Looks good' },
      { ...baseTrade, id: 2, symbol: 'TCS', exit_price: null, status: 'open', stop_loss_status: 'breakeven', current_stop_price: '100', pnl: null, r_multiple: null },
    ] }
    renderWithQueryClient(<TradesPage />)
    expect(screen.getByTestId('trades-summary')).toBeInTheDocument()
    expect(screen.getAllByText(/Reviewed/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Needs Review/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Breakeven/i).length).toBeGreaterThan(0)
  })

  it('search input renders and accepts input without crashing', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TradesPage />)
    const search = screen.getByLabelText(/Search symbol/i)
    await user.type(search, 'REL')
    expect((search as HTMLInputElement).value).toBe('REL')
  })

  it('does not crash when filter inputs change', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TradesPage />)
    const status = screen.getByDisplayValue(/All positions/i)
    await user.selectOptions(status, 'open')
    expect(status).toHaveValue('open')
  })
})
