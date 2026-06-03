import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TradeFormV3Page } from '../TradeFormV3Page'

const mocks = vi.hoisted(() => ({
  closeTradeForm: vi.fn(),
  createMutation: { mutateAsync: vi.fn() },
  updateMutation: { mutateAsync: vi.fn() },
  tradeQuery: { data: undefined as any, isLoading: false, error: null as any },
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: (sel: any) => sel({ closeTradeForm: mocks.closeTradeForm }),
}))

vi.mock('@/hooks/useTradeMutation', () => ({
  useCreateTradeMutation: () => mocks.createMutation,
  useUpdateTradeMutation: () => mocks.updateMutation,
  useTradeQuery: () => mocks.tradeQuery,
}))

vi.mock('@/components/forms/TradeEntryForm', () => ({
  TradeEntryForm: ({ mode }: { mode: string }) => <div data-testid="trade-entry-form" data-mode={mode} />,
}))

describe('TradeFormV3Page', () => {
  beforeEach(() => {
    mocks.closeTradeForm.mockClear()
    mocks.tradeQuery = { data: undefined, isLoading: false, error: null }
  })

  it('renders add mode with correct title', () => {
    render(<TradeFormV3Page mode="create" />)
    expect(screen.getByText('Add Trade')).toBeInTheDocument()
    expect(screen.getByTestId('trade-entry-form')).toHaveAttribute('data-mode', 'create')
  })

  it('renders edit mode loading state', () => {
    mocks.tradeQuery = { data: undefined, isLoading: true, error: null }
    render(<TradeFormV3Page mode="edit" tradeId={1} />)
    expect(screen.getByText('Edit Trade')).toBeInTheDocument()
    expect(screen.getByText(/Loading trade/)).toBeInTheDocument()
  })

  it('renders edit mode error state', () => {
    mocks.tradeQuery = { data: undefined, isLoading: false, error: new Error('fail') }
    render(<TradeFormV3Page mode="edit" tradeId={99} />)
    expect(screen.getByText('Trade not found')).toBeInTheDocument()
    expect(screen.getByText(/99/)).toBeInTheDocument()
  })

  it('renders edit mode with form when trade loaded', () => {
    mocks.tradeQuery = { data: { id: 1, symbol: 'RELIANCE' }, isLoading: false, error: null }
    render(<TradeFormV3Page mode="edit" tradeId={1} />)
    expect(screen.getByText('Edit Trade')).toBeInTheDocument()
    expect(screen.getByTestId('trade-entry-form')).toHaveAttribute('data-mode', 'edit')
  })

  it('renders back button', () => {
    render(<TradeFormV3Page mode="create" />)
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('does not render legacy embed wrapper', () => {
    const { container } = render(<TradeFormV3Page mode="create" />)
    expect(container.querySelector('.tjv3-legacy-embed')).toBeNull()
  })
})
