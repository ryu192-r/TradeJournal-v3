import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiTrade, DailyChargesSummary } from '@/types'
import { ReportsV3Page } from '../ReportsV3Page'
import type { TradesV3Data } from '../../trades/types'

const mocks = vi.hoisted(() => ({
  useTradesV3Data: vi.fn(),
  getDailyChargesSummary: vi.fn(),
}))

vi.mock('../../trades/hooks/useTradesV3Data', () => ({ useTradesV3Data: mocks.useTradesV3Data }))
vi.mock('@/lib/endpoints', () => ({ getDailyChargesSummary: mocks.getDailyChargesSummary }))

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'ORB', tactic: null, stop_price: '2450', target_price: null,
    r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, exchange: 'NSE', segment: 'EQUITY', product_type: 'INTRADAY', ...o,
  }
}

function summary(o: Partial<DailyChargesSummary> = {}): DailyChargesSummary {
  return {
    start_date: '2025-06-01', end_date: '2025-06-30',
    gross_realized_pnl: '1000', total_charges: '50', net_realized_pnl: '950',
    charges_recorded_days: 2, trading_days: 2, missing_charge_days: 0, days: [], ...o,
  }
}

function data(o: Partial<TradesV3Data> = {}): TradesV3Data {
  return { trades: [], total: 0, isLoading: false, isFetching: false, error: null, refresh: vi.fn(), ...o }
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('ReportsV3Page', () => {
  beforeEach(() => {
    mocks.useTradesV3Data.mockReset()
    mocks.getDailyChargesSummary.mockReset()
    mocks.getDailyChargesSummary.mockResolvedValue(summary())
  })

  it('renders loading state', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ isLoading: true }))
    render(wrap(<ReportsV3Page />))
    expect(screen.getByLabelText(/Loading report/i)).toBeInTheDocument()
  })

  it('renders not-a-tax-statement disclaimer', () => {
    mocks.useTradesV3Data.mockReturnValue(data())
    render(wrap(<ReportsV3Page />))
    expect(screen.getAllByText(/Not a tax statement/i).length).toBeGreaterThan(0)
  })

  it('renders period statement metrics', async () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade()] }))
    render(wrap(<ReportsV3Page />))
    expect(screen.getByText('Period statement')).toBeInTheDocument()
    expect(screen.getByText('Daily breakdown')).toBeInTheDocument()
    expect(screen.getByText('Charges statement')).toBeInTheDocument()
  })

  it('charges statement shows pending when missing days > 0', async () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade()] }))
    mocks.getDailyChargesSummary.mockResolvedValue(summary({ missing_charge_days: 3, trading_days: 5, charges_recorded_days: 2 }))
    render(wrap(<ReportsV3Page />))
    await waitFor(() => expect(screen.getByText(/Pending — 3 days missing/i)).toBeInTheDocument())
  })

  it('daily row shows Pending for missing charges (not ₹0)', async () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade()] }))
    mocks.getDailyChargesSummary.mockResolvedValue(summary({
      days: [{ trade_date: '2025-06-03', gross_realized_pnl: '500', charges_recorded: false, total_charges: null, net_realized_pnl: null, trade_count: 1, entry_mode: null, broker: null }],
      missing_charge_days: 1, trading_days: 1, charges_recorded_days: 0,
    }))
    render(wrap(<ReportsV3Page />))
    await waitFor(() => expect(screen.getByText('2025-06-03')).toBeInTheDocument())
    // Both charges + net columns show "Pending"
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(1)
  })

  it('print button exists', () => {
    mocks.useTradesV3Data.mockReturnValue(data())
    render(wrap(<ReportsV3Page />))
    expect(screen.getByText('Print')).toBeInTheDocument()
  })

  it('no NaN/undefined visible', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ pnl: null, r_multiple: null })] }))
    render(wrap(<ReportsV3Page />))
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it('shows charge complete net P&L when no missing days', async () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade()] }))
    mocks.getDailyChargesSummary.mockResolvedValue(summary({ missing_charge_days: 0, trading_days: 2, charges_recorded_days: 2, net_realized_pnl: '950' }))
    render(wrap(<ReportsV3Page />))
    // Net P&L card should not show "Pending"
    await waitFor(() => expect(screen.queryByText(/Pending — /)).toBeNull())
  })
})
