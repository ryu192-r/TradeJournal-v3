import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTrade } from '@/types'
import { TradeDetailV3Page } from '../TradeDetailV3Page'

const mocks = vi.hoisted(() => ({
  useTradeDetailV3Data: vi.fn(),
  closeTradeForm: vi.fn(),
  openEditTrade: vi.fn(),
}))

vi.mock('../hooks/useTradeDetailV3Data', () => ({
  useTradeDetailV3Data: mocks.useTradeDetailV3Data,
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) =>
    selector({
      closeTradeForm: mocks.closeTradeForm,
      openEditTrade: mocks.openEditTrade,
    }),
}))

const storeState = {
  closeTradeForm: mocks.closeTradeForm,
  openEditTrade: mocks.openEditTrade,
}

vi.mock('@/components/charts/TradeLightweightChart', () => ({
  TradeLightweightChart: () => <div>Chart workspace mock</div>,
}))

// Avoid Suspense act warnings from lazy chart import in tests.
vi.mock('../components/TradeChartWorkspace', () => ({
  TradeChartWorkspace: () => (
    <section>
      <h2>Chart workspace</h2>
      <div>Chart workspace mock</div>
    </section>
  ),
}))

function trade(overrides: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 42,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: '2600',
    quantity: '10',
    entry_time: '2026-06-03T09:25:00',
    exit_time: '2026-06-03T15:10:00',
    fees: '10',
    notes: 'Good entry',
    tags: ['orb'],
    setup: 'ORB',
    tactic: null,
    original_stop_price: '2450',
    current_stop_price: '2520',
    stop_loss_status: 'trailing',
    stop_price: '2520',
    target_price: '2700',
    r_multiple: '1.5',
    status: 'closed',
    pnl: '990',
    remaining_qty: '0',
    partial_realized_pnl: '200',
    review_notes: null,
    ...overrides,
  }
}

describe('TradeDetailV3Page', () => {
  beforeEach(() => {
    mocks.closeTradeForm.mockClear()
    mocks.openEditTrade.mockClear()
    mocks.useTradeDetailV3Data.mockReturnValue({
      trade: trade(),
      partialExits: [],
      stopHistory: [],
      timelineEvents: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('renders loading state', () => {
    mocks.useTradeDetailV3Data.mockReturnValue({
      trade: undefined,
      partialExits: [],
      stopHistory: [],
      timelineEvents: [],
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    })

    render(<TradeDetailV3Page tradeId={42} />)
    expect(screen.getByLabelText('Loading trade detail')).toBeInTheDocument()
  })

  it('renders not-found state', () => {
    mocks.useTradeDetailV3Data.mockReturnValue({
      trade: undefined,
      partialExits: [],
      stopHistory: [],
      timelineEvents: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TradeDetailV3Page tradeId={42} />)
    expect(screen.getByText('Trade not found')).toBeInTheDocument()
  })

  it('renders trade summary and separate SL fields', () => {
    render(<TradeDetailV3Page tradeId={42} />)

    expect(screen.getByRole('heading', { name: 'RELIANCE', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText('Original planned SL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Current protection SL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Pre daily charges').length).toBeGreaterThan(0)
    expect(screen.queryByText(/net p&l/i)).not.toBeInTheDocument()
  })

  it('renders partial exits empty state', () => {
    render(<TradeDetailV3Page tradeId={42} />)
    expect(screen.getByText('No partial exits recorded')).toBeInTheDocument()
  })

  it('renders partial exit rows when provided', () => {
    mocks.useTradeDetailV3Data.mockReturnValue({
      trade: trade({ status: 'open', exit_price: null, exit_time: null }),
      partialExits: [
        {
          id: 1,
          trade_id: 42,
          qty: '5',
          exit_price: '2580',
          exit_time: '2026-06-03T12:00:00',
          realized_pnl: '400',
          r_captured: '0.8',
          exit_reason: 'manual',
          note: 'Trim',
        },
      ],
      stopHistory: [],
      timelineEvents: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TradeDetailV3Page tradeId={42} />)
    expect(screen.queryByText('No partial exits recorded')).not.toBeInTheDocument()
    expect(screen.getByText('Trim')).toBeInTheDocument()
  })

  it('renders chart workspace or honest placeholder path', () => {
    render(<TradeDetailV3Page tradeId={42} />)
    expect(screen.getByText('Chart workspace mock')).toBeInTheDocument()
  })

  it('supports back to trades action', async () => {
    const user = userEvent.setup()
    render(<TradeDetailV3Page tradeId={42} />)

    await user.click(screen.getAllByRole('button', { name: /Back to Trades/ })[0])
    expect(mocks.closeTradeForm).toHaveBeenCalled()
  })

  it('shows deleted status via header badges', () => {
    mocks.useTradeDetailV3Data.mockReturnValue({
      trade: trade({ status: 'deleted' }),
      partialExits: [],
      stopHistory: [],
      timelineEvents: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })

    render(<TradeDetailV3Page tradeId={42} />)
    expect(screen.getByText('DELETED')).toBeInTheDocument()
  })
})
