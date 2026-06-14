import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTrade } from '@/types'
import { todaySessionDate } from '@/utils/tradeDates'
import { CockpitV3Page } from '../CockpitV3Page'
import type { CockpitV3Data } from '../types'

const mocks = vi.hoisted(() => ({
  useCockpitV3Data: vi.fn(),
  useDailyChargesSummary: vi.fn(),
  useRiskDashboardQuery: vi.fn(),
  useEdgeCommandCenterQuery: vi.fn(),
  useDailyFocus: vi.fn(),
}))

vi.mock('../hooks/useCockpitV3Data', () => ({
  useCockpitV3Data: mocks.useCockpitV3Data,
}))

vi.mock('../hooks/useDailyChargesSummary', () => ({
  useDailyChargesSummary: mocks.useDailyChargesSummary,
}))

vi.mock('@/hooks/useRiskDashboardQuery', () => ({
  useRiskDashboardQuery: mocks.useRiskDashboardQuery,
}))

vi.mock('@/hooks/useEdgeCommandCenterQuery', () => ({
  useEdgeCommandCenterQuery: mocks.useEdgeCommandCenterQuery,
}))

vi.mock('../hooks/useImprovementActions', () => ({
  useDailyFocus: mocks.useDailyFocus,
  useImprovementActions: () => ({ data: [], isLoading: false }),
  useCreateImprovementAction: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateImprovementAction: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useDeleteImprovementAction: () => ({ mutate: vi.fn(), isPending: false }),
  useSelectDailyFocus: () => ({ mutate: vi.fn(), isPending: false }),
  useClearDailyFocus: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerateSuggestions: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVerifyImprovementAction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

function trade(overrides: Partial<ApiTrade>): ApiTrade {
  return {
    id: overrides.id ?? 1,
    symbol: overrides.symbol ?? 'RELIANCE',
    entry_time: overrides.entry_time ?? `${todaySessionDate()}T09:25:00`,
    entry_price: overrides.entry_price ?? '2500',
    quantity: overrides.quantity ?? '10',
    direction: overrides.direction ?? 'LONG',
    status: overrides.status ?? 'closed',
    ...overrides,
  } as ApiTrade
}

function data(overrides: Partial<CockpitV3Data> = {}): CockpitV3Data {
  return {
    operational: undefined,
    intelligence: undefined,
    trades: [],
    isLoading: false,
    isFetching: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  }
}

describe('CockpitV3Page', () => {
  beforeEach(() => {
    mocks.useCockpitV3Data.mockReturnValue(data())
    mocks.useDailyChargesSummary.mockReturnValue({ data: null, isLoading: false, isFetching: false, error: null, refetch: vi.fn() })
    mocks.useRiskDashboardQuery.mockReturnValue({ data: undefined, isLoading: false, error: null })
    mocks.useEdgeCommandCenterQuery.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() })
    mocks.useDailyFocus.mockReturnValue({ data: { date: todaySessionDate(), focus: null, backlog: [] }, isLoading: false, isError: false })
  })

  it('renders loading state safely', () => {
    mocks.useCockpitV3Data.mockReturnValue(data({ isLoading: true }))
    render(<CockpitV3Page />)

    expect(screen.getByLabelText('Loading Cockpit v3')).toBeInTheDocument()
  })

  it('renders demo preview mode without enabling protected API calls', () => {
    render(<CockpitV3Page dataEnabled={false} />)

    expect(mocks.useCockpitV3Data).toHaveBeenCalledWith(false)
    expect(screen.getByText('Demo preview mode')).toBeInTheDocument()
    expect(screen.getByText('No API calls')).toBeInTheDocument()
  })

  it('renders empty safe state without production data', () => {
    render(<CockpitV3Page />)

    expect(screen.getByRole('heading', { name: 'Cockpit', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('No live exposure')).toBeInTheDocument()
    expect(screen.getByText('No trades in this period')).toBeInTheDocument()
    expect(screen.getByText('No setup data yet')).toBeInTheDocument()
    expect(screen.getAllByText('Desk clear').length).toBeGreaterThan(0)
  })

  it('shows missing charges as pending and does not fake net P&L', () => {
    mocks.useCockpitV3Data.mockReturnValue(data({
      trades: [trade({ pnl: '500', fees: undefined, setup: 'ORB', review_notes: 'Reviewed' })],
    }))

    render(<CockpitV3Page />)

    expect(screen.getAllByText('Not added').length).toBeGreaterThan(0)
    expect(screen.getByText('Pending charges')).toBeInTheDocument()
    expect(screen.queryByText('₹0')).not.toBeInTheDocument()
  })

  it('does not render null, undefined, NaN, or object text for invalid values', () => {
    mocks.useCockpitV3Data.mockReturnValue(data({
      trades: [
        trade({
          pnl: Number.NaN as unknown as string,
          fees: undefined,
          r_multiple: Number.NaN as unknown as string,
          setup: '',
          tags: [],
        }),
      ],
    }))

    const { container } = render(<CockpitV3Page />)

    expect(container.textContent).not.toMatch(/NaN|undefined|null|\[object Object\]/)
  })

  it('renders review action center empty state when no items are pending', () => {
    mocks.useCockpitV3Data.mockReturnValue(data({
      trades: [trade({ pnl: '100', fees: '10', setup: 'Breakout', tags: ['breakout'], notes: 'Clean', review_notes: 'Reviewed' })],
    }))
    mocks.useDailyChargesSummary.mockReturnValue({
      data: { charges_recorded_days: 1, trading_days: 1, missing_charge_days: 0, total_charges: '10', gross_realized_pnl: '110', net_realized_pnl: '100' },
      isLoading: false, isFetching: false, error: null, refetch: vi.fn(),
    })

    render(<CockpitV3Page />)

    expect(screen.getAllByText('Desk clear').length).toBeGreaterThan(0)
    expect(screen.getByText('No review items pending.')).toBeInTheDocument()
  })

  it('renders data-backed attention signals', () => {
    mocks.useCockpitV3Data.mockReturnValue(data({
      trades: [trade({ pnl: '-200', fees: undefined, setup: '', tags: [] })],
    }))

    render(<CockpitV3Page />)

    expect(screen.getAllByText('Charges pending').length).toBeGreaterThan(0)
    expect(screen.getByText('Period gross P&L negative')).toBeInTheDocument()
    expect(screen.getByText('Setup context missing')).toBeInTheDocument()
  })

  it('shows partial dashboard warning without hiding trades', () => {
    mocks.useCockpitV3Data.mockReturnValue(data({
      trades: [trade({ pnl: '100', fees: '10', setup: 'ORB', notes: 'Clean', review_notes: 'Reviewed' })],
      dashboardError: new Error('dashboard failed'),
    }))

    render(<CockpitV3Page />)

    expect(screen.getByText('Trades loaded')).toBeInTheDocument()
    expect(screen.getByText('Partial data')).toBeInTheDocument()
    expect(screen.getAllByText('RELIANCE').length).toBeGreaterThan(0)
  })

  it('opens and closes drawer preview from trading tape', async () => {
    const user = userEvent.setup()
    mocks.useCockpitV3Data.mockReturnValue(data({
      trades: [trade({ pnl: '100', fees: '10', setup: 'ORB', notes: 'Clean', review_notes: 'Reviewed' })],
    }))

    render(<CockpitV3Page />)

    await user.click(screen.getAllByRole('button', { name: /RELIANCE/ })[0])
    expect(screen.getByRole('dialog', { name: 'RELIANCE preview' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog', { name: 'RELIANCE preview' })).not.toBeInTheDocument()
  })
})
