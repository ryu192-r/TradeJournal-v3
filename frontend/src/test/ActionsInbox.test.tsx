import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ActionsInbox } from '@/components/actions/ActionsInbox'
import type { ActionsInboxResponse } from '@/types/actionsInbox'

const mockRefetch = vi.fn()
let inboxState: {
  data?: ActionsInboxResponse
  isLoading: boolean
  isError: boolean
  error: Error | null
  isFetching: boolean
} = {
  isLoading: false,
  isError: false,
  error: null,
  isFetching: false,
}

vi.mock('@/hooks/useActionsInboxQuery', () => ({
  useActionsInboxQuery: () => ({
    ...inboxState,
    refetch: mockRefetch,
  }),
}))

const setActiveView = vi.fn()
const openDetailTrade = vi.fn()

vi.mock('@/store/appStore', () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      navMode: 'simple',
      tradeFormMode: 'list',
      setActiveView,
      openDetailTrade,
    }),
}))

vi.mock('@/components/ui/BottomSheet', () => ({
  BottomSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="bottom-sheet">{children}</div> : null,
}))

function renderInbox() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ActionsInbox />
    </QueryClientProvider>
  )
}

const sampleResponse: ActionsInboxResponse = {
  generated_at: '2025-05-31T12:00:00Z',
  interface_mode: 'simple',
  open_count: 1,
  items: [
    {
      id: 'unreviewed-1',
      type: 'trade_review',
      title: 'Review RELIANCE',
      description: 'Closed trade has no review notes yet.',
      severity: 'warning',
      status: 'open',
      source: 'trade',
      related_trade_id: 42,
      created_at: '2025-05-30T10:00:00Z',
      target: { view: 'trades', trade_id: 42 },
      tier: 'simple',
    },
  ],
  sections: [
    {
      id: 'trade_review',
      title: 'Pending trade reviews',
      items: [
        {
          id: 'unreviewed-1',
          type: 'trade_review',
          title: 'Review RELIANCE',
          severity: 'warning',
          status: 'open',
          source: 'trade',
          related_trade_id: 42,
          created_at: '2025-05-30T10:00:00Z',
          target: { view: 'trades', trade_id: 42 },
          tier: 'simple',
        },
      ],
    },
  ],
}

describe('ActionsInbox', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia
    vi.clearAllMocks()
    inboxState = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
    }
  })

  it('shows loading state when opening drawer', async () => {
    inboxState = { ...inboxState, isLoading: true }
    renderInbox()
    fireEvent.click(screen.getByRole('button', { name: /open actions/i }))
    expect(screen.getByText(/loading your action list/i)).toBeInTheDocument()
  })

  it('shows empty state when no open items', () => {
    inboxState = {
      ...inboxState,
      data: {
        generated_at: '2025-05-31T12:00:00Z',
        interface_mode: 'simple',
        open_count: 0,
        items: [],
        sections: [],
      },
    }
    renderInbox()
    fireEvent.click(screen.getByRole('button', { name: /open actions/i }))
    expect(screen.getByText(/you're all set/i)).toBeInTheDocument()
  })

  it('shows error state with retry', async () => {
    inboxState = {
      ...inboxState,
      isError: true,
      error: new Error('Network failed'),
    }
    renderInbox()
    fireEvent.click(screen.getByRole('button', { name: /open actions/i }))
    expect(screen.getByText(/couldn't load actions/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('shows badge count from open_count', () => {
    inboxState = { ...inboxState, data: sampleResponse }
    renderInbox()
    expect(screen.getByRole('button', { name: /actions, 1 pending/i })).toBeInTheDocument()
  })

  it('navigates to trade detail when clicking an item', async () => {
    inboxState = { ...inboxState, data: sampleResponse }
    renderInbox()
    fireEvent.click(screen.getByRole('button', { name: /actions, 1 pending/i }))
    fireEvent.click(screen.getByRole('button', { name: /review reliance/i }))
    await waitFor(() => {
      expect(openDetailTrade).toHaveBeenCalledWith(42)
    })
  })
})
