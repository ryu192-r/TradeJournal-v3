import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiTrade } from '@/types'
import { ReviewV3Page } from '../ReviewV3Page'
import type { TradesV3Data } from '../../trades/types'

const mocks = vi.hoisted(() => ({
  useTradesV3Data: vi.fn(),
  reviewMutate: vi.fn(),
  openDetailTrade: vi.fn(),
}))

vi.mock('../../trades/hooks/useTradesV3Data', () => ({ useTradesV3Data: mocks.useTradesV3Data }))
vi.mock('@/hooks/useReviewTradeMutation', () => ({
  useReviewTradeMutation: () => ({ mutateAsync: mocks.reviewMutate, isPending: false }),
}))
vi.mock('@/store/toastStore', () => ({ useToastStore: (sel: any) => sel({ addToast: vi.fn() }) }))
vi.mock('@/store/appStore', () => ({
  useAppStore: (sel: any) => sel({ reviewTargetId: null, openDetailTrade: mocks.openDetailTrade }),
}))

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'ORB', tactic: null, stop_price: '2450',
    original_stop_price: '2450', current_stop_price: '2450', target_price: null,
    r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, ...o,
  }
}

function data(overrides: Partial<TradesV3Data> = {}): TradesV3Data {
  return { trades: [], total: 0, isLoading: false, isFetching: false, error: null, refresh: vi.fn(), ...overrides }
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('ReviewV3Page', () => {
  beforeEach(() => {
    mocks.useTradesV3Data.mockReset()
    mocks.reviewMutate.mockReset()
    mocks.openDetailTrade.mockReset()
  })

  it('renders loading state', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ isLoading: true }))
    render(wrap(<ReviewV3Page />))
    expect(screen.getByLabelText(/Loading review queue/i)).toBeInTheDocument()
  })

  it('renders empty queue', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [] }))
    render(wrap(<ReviewV3Page />))
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText(/No trades match/i)).toBeInTheDocument()
  })

  it('renders pending trades in queue', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, symbol: 'TCS', review_notes: null })] }))
    render(wrap(<ReviewV3Page />))
    expect(screen.getByText('TCS')).toBeInTheDocument()
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0)
  })

  it('selecting trade opens workspace with context', async () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, symbol: 'TCS' })] }))
    const user = userEvent.setup()
    render(wrap(<ReviewV3Page />))
    await user.click(screen.getByText('TCS'))
    expect(screen.getByText('TCS review')).toBeInTheDocument()
    expect(screen.getByText('Trade context')).toBeInTheDocument()
    expect(screen.getByText('Original SL')).toBeInTheDocument()
    expect(screen.getByText('Current protection SL')).toBeInTheDocument()
  })

  it('saving review calls mutation with review fields', async () => {
    mocks.reviewMutate.mockResolvedValue(trade())
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, symbol: 'TCS' })] }))
    const user = userEvent.setup()
    render(wrap(<ReviewV3Page />))
    await user.click(screen.getByText('TCS'))
    const notes = screen.getByText('Review notes').closest('label')!.querySelector('textarea')!
    await user.type(notes, 'Chased the entry')
    await user.click(screen.getByText('Save review'))
    await waitFor(() => expect(mocks.reviewMutate).toHaveBeenCalled())
    expect(mocks.reviewMutate.mock.calls[0][0].payload.review_notes).toBe('Chased the entry')
  })

  it('shows daily review limitation note', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [] }))
    render(wrap(<ReviewV3Page />))
    expect(screen.getByText(/Daily review persistence is not implemented/i)).toBeInTheDocument()
  })

  it('no NaN or undefined visible', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, pnl: null, r_multiple: null })] }))
    render(wrap(<ReviewV3Page />))
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it('shows "needs classification" when entry_context is null', async () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, symbol: 'TCS', entry_context: null })] }))
    const user = userEvent.setup()
    render(wrap(<ReviewV3Page />))
    await user.click(screen.getByText('TCS'))
    expect(screen.getByText(/needs classification/i)).toBeInTheDocument()
  })

  it('clicking entry context chip includes it in save payload', async () => {
    mocks.reviewMutate.mockResolvedValue(trade({ entry_context: 'impulse' }))
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, symbol: 'TCS', entry_context: null })] }))
    const user = userEvent.setup()
    render(wrap(<ReviewV3Page />))
    await user.click(screen.getByText('TCS'))
    await user.click(screen.getByText('Impulse'))
    await user.click(screen.getByText('Save review'))
    await waitFor(() => expect(mocks.reviewMutate).toHaveBeenCalled())
    expect(mocks.reviewMutate.mock.calls[0][0].payload.entry_context).toBe('impulse')
  })

  it('clicking same chip again deselects to null', async () => {
    mocks.reviewMutate.mockResolvedValue(trade({ entry_context: null }))
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [trade({ id: 1, symbol: 'TCS', entry_context: 'planned', review_notes: null })] }))
    const user = userEvent.setup()
    render(wrap(<ReviewV3Page />))
    // Trade is reviewed (has entry_context) — switch to Reviewed filter
    await user.click(screen.getByRole('button', { name: 'Reviewed' }))
    await user.click(screen.getByText('TCS'))
    await user.click(screen.getByText('Planned'))
    await user.click(screen.getByText('Update review'))
    await waitFor(() => expect(mocks.reviewMutate).toHaveBeenCalled())
    expect(mocks.reviewMutate.mock.calls[0][0].payload.entry_context).toBeNull()
  })

  it('unclassified metric card shows count', () => {
    mocks.useTradesV3Data.mockReturnValue(data({ trades: [
      trade({ id: 1, entry_context: null }),
      trade({ id: 2, entry_context: 'planned' }),
    ] }))
    render(wrap(<ReviewV3Page />))
    expect(screen.getAllByText('Unclassified').length).toBeGreaterThanOrEqual(1)
  })
})
