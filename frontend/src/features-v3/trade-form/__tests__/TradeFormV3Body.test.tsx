import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TradeFormV3Body } from '../TradeFormV3Body'
import type { ApiTrade } from '@/types'

const mocks = vi.hoisted(() => ({ addToast: vi.fn() }))

vi.mock('@/hooks/useSetupPlaybookQuery', () => ({
  useSetupsQuery: () => ({ data: { items: [{ name: 'Breakout' }] }, isLoading: false }),
}))
vi.mock('@/store/toastStore', () => ({
  useToastStore: (sel: any) => sel({ addToast: mocks.addToast }),
}))

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 7, symbol: 'TCS', direction: 'LONG', entry_price: '3000', exit_price: null,
    quantity: '5', entry_time: '2025-06-03T10:00:00', exit_time: null, fees: '0',
    notes: null, tags: null, setup: null, tactic: null, stop_price: '2900',
    current_stop_price: '2950', stop_loss_status: 'breakeven', target_price: '3200',
    r_multiple: null, status: 'open', remaining_qty: null,
    exchange: 'NSE', segment: 'EQUITY', product_type: 'INTRADAY', executed_order_count: 2, ...o,
  }
}

describe('TradeFormV3Body', () => {
  beforeEach(() => mocks.addToast.mockClear())

  const fill = async (user: ReturnType<typeof userEvent.setup>) => {
    const inputBy = (label: string) =>
      screen.getByText(label, { selector: '.tjv3-formfield__label' })
        .closest('label')!.querySelector('input') as HTMLInputElement
    await user.type(inputBy('Symbol'), 'INFY')
    await user.type(inputBy('Entry price (₹)'), '100')
    await user.type(inputBy('Quantity'), '10')
  }

  it('renders all sections in add mode', () => {
    render(<TradeFormV3Body mode="create" submitFn={vi.fn()} />)
    expect(screen.getByText('Trade identity')).toBeInTheDocument()
    expect(screen.getByText('Execution')).toBeInTheDocument()
    expect(screen.getByText('Risk & plan')).toBeInTheDocument()
    expect(screen.getByText('Market details')).toBeInTheDocument()
    expect(screen.getByText('Setup & notes')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('renders market detail fields', () => {
    render(<TradeFormV3Body mode="create" submitFn={vi.fn()} />)
    expect(screen.getByText('Exchange')).toBeInTheDocument()
    expect(screen.getByText('Segment')).toBeInTheDocument()
    expect(screen.getByText('Product type')).toBeInTheDocument()
    expect(screen.getByText('Executed order count')).toBeInTheDocument()
  })

  it('prefills values in edit mode', () => {
    render(<TradeFormV3Body mode="edit" initialData={trade()} submitFn={vi.fn()} />)
    expect((screen.getByDisplayValue('TCS'))).toBeInTheDocument()
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument()
  })

  it('shows current protection SL read-only in edit mode', () => {
    render(<TradeFormV3Body mode="edit" initialData={trade()} submitFn={vi.fn()} />)
    expect(screen.getByText(/Current protection SL/i)).toBeInTheDocument()
    expect(screen.getByText(/breakeven/i)).toBeInTheDocument()
  })

  it('submits create with metadata payload', async () => {
    const submitFn = vi.fn().mockResolvedValue({ id: 1 })
    const user = userEvent.setup()
    render(<TradeFormV3Body mode="create" submitFn={submitFn} />)
    await fill(user)
    await user.click(screen.getByText('Save trade'))
    await waitFor(() => expect(submitFn).toHaveBeenCalled())
    const payload = submitFn.mock.calls[0][0]
    expect(payload.symbol).toBe('INFY')
    expect(payload.exchange).toBe('UNKNOWN')
    expect(payload.executed_order_count).toBeNull()
    expect(payload.direction).toBe('LONG')
  })

  it('lets user change exchange', async () => {
    const user = userEvent.setup()
    render(<TradeFormV3Body mode="create" submitFn={vi.fn()} />)
    const select = screen.getByText('Exchange').closest('label')!.querySelector('select')!
    await user.selectOptions(select, 'NSE')
    expect((select as HTMLSelectElement).value).toBe('NSE')
  })

  it('shows error banner on submit failure', async () => {
    const submitFn = vi.fn().mockRejectedValue(new Error('Server boom'))
    const user = userEvent.setup()
    render(<TradeFormV3Body mode="create" submitFn={submitFn} />)
    await fill(user)
    await user.click(screen.getByText('Save trade'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server boom'))
  })

  it('preview shows Unavailable not NaN when fields empty', () => {
    render(<TradeFormV3Body mode="create" submitFn={vi.fn()} />)
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('calls onCancel', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<TradeFormV3Body mode="create" submitFn={vi.fn()} onCancel={onCancel} />)
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
