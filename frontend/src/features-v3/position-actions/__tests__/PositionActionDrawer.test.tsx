import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PositionActionDrawer } from '../PositionActionDrawer'
import type { ApiTrade } from '@/types'

const mocks = vi.hoisted(() => ({
  createPartialExit: vi.fn(),
  updateTrade: vi.fn(),
  createStopHistory: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('@/lib/endpoints', () => ({
  createPartialExit: mocks.createPartialExit,
  updateTrade: mocks.updateTrade,
  createStopHistory: mocks.createStopHistory,
}))
vi.mock('@/store/toastStore', () => ({
  useToastStore: (sel: any) => sel({ addToast: mocks.addToast }),
}))

function openTrade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: null,
    quantity: '10', entry_time: '2025-01-01T09:30:00', exit_time: null, fees: '0',
    notes: null, tags: null, setup: null, tactic: null, stop_price: '2400',
    original_stop_price: '2400', current_stop_price: '2450', stop_loss_status: 'breakeven',
    target_price: null, r_multiple: null, status: 'open', remaining_qty: '10', ...o,
  }
}

function closedTrade(): ApiTrade {
  return openTrade({ exit_price: '2600', status: 'closed', remaining_qty: '0' })
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
  return { invalidateSpy }
}

describe('PositionActionDrawer', () => {
  beforeEach(() => {
    mocks.createPartialExit.mockReset()
    mocks.updateTrade.mockReset()
    mocks.createStopHistory.mockReset()
    mocks.addToast.mockClear()
  })

  it('shows view-only for closed trade', () => {
    render(wrap(<PositionActionDrawer open trade={closedTrade()} onClose={vi.fn()} />))
    expect(screen.getByText(/closed.*view only/i)).toBeInTheDocument()
  })

  it('shows action tabs for open trade', () => {
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    expect(screen.getByText('Partial exit')).toBeInTheDocument()
    expect(screen.getByText('Close trade')).toBeInTheDocument()
    expect(screen.getByText('Move stop')).toBeInTheDocument()
  })

  it('shows original SL separate from current protection', () => {
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    expect(screen.getByText('Original SL')).toBeInTheDocument()
    expect(screen.getByText('Current protection')).toBeInTheDocument()
  })

  it('validates partial exit qty > remaining', async () => {
    const user = userEvent.setup()
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    const qtyInput = screen.getByText('Exit quantity').closest('label')!.querySelector('input')!
    const priceInput = screen.getByText('Exit price (₹)').closest('label')!.querySelector('input')!
    await user.type(qtyInput, '10') // equals remaining, not allowed (partial only)
    await user.type(priceInput, '2600')
    await user.click(screen.getByText('Add partial exit'))
    expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 9/)
    expect(mocks.createPartialExit).not.toHaveBeenCalled()
  })

  it('submits valid partial exit', async () => {
    mocks.createPartialExit.mockResolvedValue({ partial_exit: {}, trade: openTrade() })
    const user = userEvent.setup()
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    const qtyInput = screen.getByText('Exit quantity').closest('label')!.querySelector('input')!
    const priceInput = screen.getByText('Exit price (₹)').closest('label')!.querySelector('input')!
    await user.type(qtyInput, '5')
    await user.type(priceInput, '2600')
    await user.click(screen.getByText('Add partial exit'))
    await waitFor(() => expect(mocks.createPartialExit).toHaveBeenCalled())
    expect(mocks.createPartialExit.mock.calls[0][1].qty).toBe('5')
  })

  it('invalidates trade, lifecycle, dashboard, analytics, and charges after action', async () => {
    mocks.createPartialExit.mockResolvedValue({ partial_exit: {}, trade: openTrade() })
    const user = userEvent.setup()
    const { invalidateSpy } = renderWithClient(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />)
    const qtyInput = screen.getByText('Exit quantity').closest('label')!.querySelector('input')!
    const priceInput = screen.getByText('Exit price (₹)').closest('label')!.querySelector('input')!

    await user.type(qtyInput, '5')
    await user.type(priceInput, '2600')
    await user.click(screen.getByText('Add partial exit'))

    await waitFor(() => expect(mocks.createPartialExit).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trades'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trade', 1] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['partial-exits', 1] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'intelligence'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
  })

  it('shows matching validation message for non-positive partial exit price', async () => {
    const user = userEvent.setup()
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    const qtyInput = screen.getByText('Exit quantity').closest('label')!.querySelector('input')!
    const priceInput = screen.getByText('Exit price (₹)').closest('label')!.querySelector('input')!
    await user.type(qtyInput, '5')
    await user.type(priceInput, '0')
    await user.click(screen.getByText('Add partial exit'))
    expect(screen.getByRole('alert')).toHaveTextContent('Exit price must be positive.')
    expect(mocks.createPartialExit).not.toHaveBeenCalled()
  })

  it('submits valid close', async () => {
    mocks.updateTrade.mockResolvedValue(closedTrade())
    const user = userEvent.setup()
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} initialAction="close" />))
    const priceInput = screen.getByText('Close price (₹)').closest('label')!.querySelector('input')!
    await user.type(priceInput, '2600')
    const buttons = screen.getAllByText('Close trade')
    await user.click(buttons[buttons.length - 1]) // submit button is last
    await waitFor(() => expect(mocks.updateTrade).toHaveBeenCalled())
    expect(mocks.updateTrade.mock.calls[0][1].exit_price).toBe('2600')
  })

  it('invalidates affected domains after close', async () => {
    mocks.updateTrade.mockResolvedValue(closedTrade())
    const user = userEvent.setup()
    const { invalidateSpy } = renderWithClient(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} initialAction="close" />)
    const priceInput = screen.getByText('Close price (₹)').closest('label')!.querySelector('input')!

    await user.type(priceInput, '2600')
    const buttons = screen.getAllByText('Close trade')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => expect(mocks.updateTrade).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trades'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trade', 1] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['analytics'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
  })

  it('submits valid stop update', async () => {
    mocks.createStopHistory.mockResolvedValue({})
    const user = userEvent.setup()
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} initialAction="protection_stop" />))
    const priceInput = screen.getByText('New stop price (₹)').closest('label')!.querySelector('input')!
    await user.type(priceInput, '2500')
    await user.click(screen.getByText('Update stop'))
    await waitFor(() => expect(mocks.createStopHistory).toHaveBeenCalled())
    expect(mocks.createStopHistory.mock.calls[0][1].price).toBe('2500')
  })

  it('invalidates affected domains after stop update', async () => {
    mocks.createStopHistory.mockResolvedValue({})
    const user = userEvent.setup()
    const { invalidateSpy } = renderWithClient(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} initialAction="protection_stop" />)
    const priceInput = screen.getByText('New stop price (₹)').closest('label')!.querySelector('input')!

    await user.type(priceInput, '2500')
    await user.click(screen.getByText('Update stop'))

    await waitFor(() => expect(mocks.createStopHistory).toHaveBeenCalled())
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trades'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trade', 1] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stop-history', 1] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['risk-dashboard'] })
  })

  it('shows error on API failure', async () => {
    mocks.createPartialExit.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    const qtyInput = screen.getByText('Exit quantity').closest('label')!.querySelector('input')!
    const priceInput = screen.getByText('Exit price (₹)').closest('label')!.querySelector('input')!
    await user.type(qtyInput, '3')
    await user.type(priceInput, '2600')
    await user.click(screen.getByText('Add partial exit'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('boom'))
  })

  it('no NaN or undefined visible', () => {
    render(wrap(<PositionActionDrawer open trade={openTrade()} onClose={vi.fn()} />))
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })
})
