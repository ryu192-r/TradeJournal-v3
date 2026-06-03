import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiTrade } from '@/types'
import { TradePreviewDrawer } from '../components/TradePreviewDrawer'

vi.mock('@/lib/endpoints', () => ({
  createPartialExit: vi.fn(),
  updateTrade: vi.fn(),
  createStopHistory: vi.fn(),
}))
vi.mock('@/store/toastStore', () => ({
  useToastStore: (sel: any) => sel({ addToast: vi.fn() }),
}))

function openTrade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'TCS', direction: 'LONG', entry_price: '3000', exit_price: null,
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: null, fees: '0',
    notes: null, tags: null, setup: null, tactic: null, stop_price: '2900',
    original_stop_price: '2900', current_stop_price: '2950', stop_loss_status: 'manual',
    target_price: null, r_multiple: null, status: 'open', remaining_qty: '10', ...o,
  }
}

function closedTrade(): ApiTrade {
  return openTrade({ exit_price: '3100', status: 'closed', remaining_qty: '0' })
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

describe('TradePreviewDrawer — position actions', () => {
  it('shows action buttons for open trade', () => {
    render(wrap(<TradePreviewDrawer trade={openTrade()} onClose={vi.fn()} />))
    expect(screen.getByText('Partial exit')).toBeInTheDocument()
    expect(screen.getByText('Close trade')).toBeInTheDocument()
    expect(screen.getByText('Move stop')).toBeInTheDocument()
  })

  it('hides action buttons for closed trade', () => {
    render(wrap(<TradePreviewDrawer trade={closedTrade()} onClose={vi.fn()} />))
    expect(screen.queryByText('Partial exit')).not.toBeInTheDocument()
    expect(screen.queryByText('Close trade')).not.toBeInTheDocument()
    expect(screen.queryByText('Move stop')).not.toBeInTheDocument()
  })

  it('hides action buttons for deleted trade', () => {
    render(wrap(<TradePreviewDrawer trade={openTrade({ status: 'deleted' })} onClose={vi.fn()} />))
    expect(screen.queryByText('Partial exit')).not.toBeInTheDocument()
  })

  it('opens PositionActionDrawer on Partial exit click', async () => {
    const user = userEvent.setup()
    render(wrap(<TradePreviewDrawer trade={openTrade()} onClose={vi.fn()} />))
    await user.click(screen.getByText('Partial exit'))
    // PositionActionDrawer renders with its own content
    expect(screen.getByText('Position actions')).toBeInTheDocument()
    expect(screen.getByText('Exit quantity')).toBeInTheDocument()
  })

  it('opens PositionActionDrawer on Move stop click', async () => {
    const user = userEvent.setup()
    render(wrap(<TradePreviewDrawer trade={openTrade()} onClose={vi.fn()} />))
    await user.click(screen.getByText('Move stop'))
    expect(screen.getByText('New stop price (₹)')).toBeInTheDocument()
  })

  it('keeps Open full trade button', () => {
    const onDetail = vi.fn()
    render(wrap(<TradePreviewDrawer trade={openTrade()} onClose={vi.fn()} onOpenTradeDetail={onDetail} />))
    expect(screen.getByText('Open full trade')).toBeInTheDocument()
  })

  it('shows Original SL and Current protection SL in preview', () => {
    render(wrap(<TradePreviewDrawer trade={openTrade()} onClose={vi.fn()} />))
    expect(screen.getByText('Original SL')).toBeInTheDocument()
    expect(screen.getByText('Current protection SL')).toBeInTheDocument()
  })
})
