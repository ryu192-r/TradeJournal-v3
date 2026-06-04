import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsV3Page } from '../AnalyticsV3Page'
import type { DailyChargesSummary } from '@/types'

const mocks = vi.hoisted(() => ({
  useTradesV3Data: vi.fn(),
  getDailyChargesSummary: vi.fn(),
}))

vi.mock('../../trades/hooks/useTradesV3Data', () => ({ useTradesV3Data: mocks.useTradesV3Data }))
vi.mock('@/lib/endpoints', () => ({ getDailyChargesSummary: mocks.getDailyChargesSummary }))

function summary(o: Partial<DailyChargesSummary> = {}): DailyChargesSummary {
  return {
    start_date: '2025-03-17',
    end_date: '2025-06-15',
    gross_realized_pnl: '1000',
    total_charges: '100',
    net_realized_pnl: '900',
    charges_recorded_days: 1,
    trading_days: 1,
    missing_charge_days: 0,
    days: [],
    ...o,
  }
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('AnalyticsV3Page', () => {
  beforeEach(() => {
    mocks.useTradesV3Data.mockReset()
    mocks.getDailyChargesSummary.mockReset()
    mocks.useTradesV3Data.mockReturnValue({ trades: [], total: 0, isLoading: false, isFetching: false, error: null, refresh: vi.fn() })
    mocks.getDailyChargesSummary.mockResolvedValue(summary())
  })

  it('labels all-time charges as latest 90 days only', async () => {
    const user = userEvent.setup()
    render(wrap(<AnalyticsV3Page />))

    await user.click(screen.getByRole('button', { name: 'All time' }))

    expect(screen.getByText('Charges & net P&L (latest 90 days)')).toBeInTheDocument()
    expect(screen.getByText(/all time\. charges\/net p&l here use latest 90 days only/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Net P&L (90d)')).toBeInTheDocument())
  })
})
