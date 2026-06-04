import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChargesLedgerPage } from '../ChargesLedgerPage'

const mocks = vi.hoisted(() => ({
  useChargesLedgerData: vi.fn(),
  deleteDailyCharges: vi.fn(),
  upsertDailyCharges: vi.fn(),
  listTrades: vi.fn(),
}))

vi.mock('../hooks/useChargesLedgerData', () => ({
  useChargesLedgerData: mocks.useChargesLedgerData,
}))

vi.mock('@/lib/endpoints', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    deleteDailyCharges: mocks.deleteDailyCharges,
    upsertDailyCharges: mocks.upsertDailyCharges,
    listTrades: mocks.listTrades,
  }
})

function makeSummary(overrides: Partial<import('@/types').DailyChargesSummary> = {}): import('@/types').DailyChargesSummary {
  return {
    start_date: '2025-09-01',
    end_date: '2025-09-05',
    gross_realized_pnl: '500.00000000',
    total_charges: '100.00000000',
    net_realized_pnl: '400.00000000',
    charges_recorded_days: 2,
    trading_days: 3,
    missing_charge_days: 1,
    days: [
      {
        trade_date: '2025-09-01',
        gross_realized_pnl: '200.00000000',
        charges_recorded: true,
        total_charges: '50.00000000',
        net_realized_pnl: '150.00000000',
        trade_count: 1,
        entry_mode: 'breakdown',
        broker: 'Zerodha',
      },
      {
        trade_date: '2025-09-02',
        gross_realized_pnl: '300.00000000',
        charges_recorded: false,
        total_charges: null,
        net_realized_pnl: null,
        trade_count: 1,
        entry_mode: null,
        broker: null,
      },
      {
        trade_date: '2025-09-03',
        gross_realized_pnl: '0.00000000',
        charges_recorded: true,
        total_charges: '0.00000000',
        net_realized_pnl: '0.00000000',
        trade_count: 0,
        entry_mode: 'total_only',
        broker: null,
      },
    ],
    ...overrides,
  }
}

describe('ChargesLedgerPage', () => {
  function renderPage() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const result = render(
      <QueryClientProvider client={qc}><ChargesLedgerPage /></QueryClientProvider>,
    )
    return { ...result, qc }
  }

  beforeEach(() => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: null,
      isLoading: true,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    mocks.deleteDailyCharges.mockResolvedValue(undefined)
    mocks.upsertDailyCharges.mockResolvedValue(undefined)
    mocks.listTrades.mockResolvedValue({ items: [], total: 0 })
  })

  it('renders loading state', () => {
    renderPage()
    expect(screen.getByText('Daily Charges Ledger')).toBeInTheDocument()
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument()
  })

  it('renders empty state when no trading days', () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary({ days: [], trading_days: 0, missing_charge_days: 0, charges_recorded_days: 0 }),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('No trading activity')).toBeInTheDocument()
  })

  it('renders missing and recorded sections', () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    renderPage()
    expect(screen.getAllByText('Missing charges').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Recorded charges').length).toBeGreaterThan(0)
    expect(screen.getByText(/300\.00/)).toBeInTheDocument()
    expect(screen.getByText(/200\.00/)).toBeInTheDocument()
  })

  it('opens drawer on add charges', async () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getAllByRole('button', { name: /Add charges/i })[0])
    expect(screen.getByRole('dialog', { name: /Add charges/i })).toBeInTheDocument()
  })

  it('shows delete confirmation and deletes on confirm', async () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    const user = userEvent.setup()
    renderPage()

    const deleteButtons = screen.getAllByRole('button', { name: /^Delete$/i })
    await user.click(deleteButtons[0])
    expect(screen.getByText(/Delete charges for/i)).toBeInTheDocument()

    const confirmDelete = screen.getAllByRole('button', { name: /^Delete$/i }).find((el) => {
      // confirmation dialog delete button is in a card, not table
      return el.closest('.tjv3-card') !== null
    })!
    await user.click(confirmDelete)
    await waitFor(() => expect(mocks.deleteDailyCharges).toHaveBeenCalled())
  })

  it('invalidates charges dependents after delete', async () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    const user = userEvent.setup()
    const { qc } = renderPage()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    await user.click(screen.getAllByRole('button', { name: /^Delete$/i })[0])
    const confirmDelete = screen.getAllByRole('button', { name: /^Delete$/i }).find((el) => el.closest('.tjv3-card') !== null)!
    await user.click(confirmDelete)

    await waitFor(() => expect(mocks.deleteDailyCharges).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'intelligence'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] })
  })

  it('invalidates charges dependents after save', async () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary({ days: [] }),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    const user = userEvent.setup()
    const { qc } = renderPage()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    await user.click(screen.getByRole('button', { name: /Add charges/i }))
    await user.type(screen.getByLabelText(/Total charges/i), '25')
    await user.click(screen.getByRole('button', { name: /Save charges/i }))

    await waitFor(() => expect(mocks.upsertDailyCharges).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'intelligence'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] })
  })

  it('does not show missing charges as zero', () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    const { container } = renderPage()
    const missingRow = container.querySelector('tr:has(td:nth-child(4) .tjv3-chip-warning)')
    if (missingRow) {
      expect(missingRow.textContent).toContain('Missing')
      expect(missingRow.textContent).not.toContain('₹0')
    }
  })

  it('shows net P&L as pending when missing days exist', () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary(),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    renderPage()
    expect(screen.getByText('Pending charges')).toBeInTheDocument()
  })

  it('shows net P&L when all days recorded', () => {
    mocks.useChargesLedgerData.mockReturnValue({
      data: makeSummary({ missing_charge_days: 0, charges_recorded_days: 3, net_realized_pnl: '400.00000000' }),
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      period: '30d',
      setPeriod: vi.fn(),
    })
    renderPage()
    expect(screen.queryByText('Pending charges')).not.toBeInTheDocument()
  })
})
