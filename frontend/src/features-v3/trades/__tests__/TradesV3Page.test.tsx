import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTrade } from '@/types'
import { TradesV3Page } from '../TradesV3Page'
import { TradesMobileCard } from '../components/TradesMobileCard'
import type { TradesV3Data } from '../types'

const mocks = vi.hoisted(() => ({
  useTradesV3Data: vi.fn(),
}))

vi.mock('../hooks/useTradesV3Data', () => ({
  useTradesV3Data: mocks.useTradesV3Data,
}))

function trade(overrides: Partial<ApiTrade>): ApiTrade {
  return {
    id: overrides.id ?? 1,
    symbol: overrides.symbol ?? 'RELIANCE',
    direction: overrides.direction ?? 'LONG',
    entry_price: overrides.entry_price ?? '2500',
    exit_price: overrides.exit_price ?? '2600',
    quantity: overrides.quantity ?? '10',
    entry_time: overrides.entry_time ?? '2026-06-03T09:25:00',
    exit_time: overrides.exit_time ?? '2026-06-03T15:10:00',
    fees: overrides.fees ?? '10',
    notes: overrides.notes ?? 'Reviewed',
    tags: overrides.tags ?? ['orb'],
    setup: overrides.setup ?? 'ORB',
    tactic: overrides.tactic ?? null,
    original_stop_price: overrides.original_stop_price ?? '2450',
    current_stop_price: overrides.current_stop_price ?? '2520',
    stop_loss_status: overrides.stop_loss_status ?? 'trailing',
    stop_price: overrides.stop_price ?? '2520',
    target_price: overrides.target_price ?? null,
    r_multiple: overrides.r_multiple ?? '1.5',
    status: overrides.status ?? 'closed',
    pnl: overrides.pnl ?? '990',
    remaining_qty: overrides.remaining_qty ?? '10',
    partial_realized_pnl: overrides.partial_realized_pnl ?? null,
    ...overrides,
  } as ApiTrade
}

function data(overrides: Partial<TradesV3Data> = {}): TradesV3Data {
  return {
    trades: [],
    total: 0,
    isLoading: false,
    isFetching: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  }
}

describe('TradesV3Page', () => {
  beforeEach(() => {
    mocks.useTradesV3Data.mockReturnValue(data())
  })

  it('renders loading state safely', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ isLoading: true }))
    render(<TradesV3Page />)

    expect(screen.getByLabelText('Loading Trades v3')).toBeInTheDocument()
  })

  it('renders empty safe state', () => {
    render(<TradesV3Page />)

    expect(screen.getByRole('heading', { name: 'Trades', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('No trades found')).toBeInTheDocument()
    expect(screen.queryByText(/net p&l/i)).not.toBeInTheDocument()
  })

  it('renders demo preview mode without protected API calls', () => {
    render(<TradesV3Page dataEnabled={false} />)

    expect(mocks.useTradesV3Data).toHaveBeenCalledWith(false)
    expect(screen.getByText('Demo preview mode')).toBeInTheDocument()
    expect(screen.getByText('No API calls')).toBeInTheDocument()
  })

  it('renders trade rows and opens/closes drawer preview', async () => {
    const user = userEvent.setup()
    mocks.useTradesV3Data.mockReturnValue(data({
      trades: [trade({ symbol: 'RELIANCE' })],
      total: 1,
    }))

    render(<TradesV3Page />)

    expect(screen.getAllByText('Gross P&L').length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: /RELIANCE/ })[0])
    expect(screen.getByRole('dialog', { name: 'RELIANCE preview' })).toBeInTheDocument()
    expect(screen.getByText('Original SL')).toBeInTheDocument()
    expect(screen.getByText('Current protection SL')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog', { name: 'RELIANCE preview' })).not.toBeInTheDocument()
  })

  it('mobile card renders safe fallbacks', () => {
    render(<TradesMobileCard trade={trade({ setup: null, exit_price: null, current_stop_price: null, stop_price: null, pnl: null, r_multiple: null })} onSelectTrade={vi.fn()} />)

    expect(screen.getByText('RELIANCE')).toBeInTheDocument()
    expect(screen.getByText(/No setup/)).toBeInTheDocument()
    expect(screen.getByText(/Current SL No SL/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null|\[object Object\]/)
  })
})
