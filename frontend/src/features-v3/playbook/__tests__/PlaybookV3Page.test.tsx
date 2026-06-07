import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import type { ApiTrade } from '@/types'
import type { SetupPlaybookItem, SetupPlaybookListResponse } from '@/types/setupPlaybook'
import { PlaybookV3Page } from '../PlaybookV3Page'
import type { TradesV3Data } from '../../trades/types'

const mocks = vi.hoisted(() => ({
  useTradesV3Data: vi.fn(),
  useSetupsQuery: vi.fn(),
  useUpdateSetupMutation: vi.fn(),
  useCreateSetupMutation: vi.fn(),
  useArchiveSetupMutation: vi.fn(),
  useSeedSetupsMutation: vi.fn(),
  openDetailTrade: vi.fn(),
  openReviewTrade: vi.fn(),
}))

vi.mock('../components/PlaybookIntelligenceFull', () => ({
  PlaybookIntelligenceFull: () => <div data-testid="playbook-intelligence-mock">Intelligence mock</div>,
}))
vi.mock('../../trades/hooks/useTradesV3Data', () => ({ useTradesV3Data: mocks.useTradesV3Data }))
vi.mock('@/hooks/useSetupPlaybookQuery', () => ({
  useSetupsQuery: mocks.useSetupsQuery,
  useUpdateSetupMutation: mocks.useUpdateSetupMutation,
  useCreateSetupMutation: mocks.useCreateSetupMutation,
  useArchiveSetupMutation: mocks.useArchiveSetupMutation,
  useSeedSetupsMutation: mocks.useSeedSetupsMutation,
}))
vi.mock('@/store/toastStore', () => ({
  useToastStore: (sel: (s: { addToast: () => void }) => unknown) => sel({ addToast: vi.fn() }),
}))
vi.mock('@/store/appStore', () => ({
  useAppStore: (sel: (s: { openDetailTrade: typeof mocks.openDetailTrade; openReviewTrade: typeof mocks.openReviewTrade }) => unknown) =>
    sel({ openDetailTrade: mocks.openDetailTrade, openReviewTrade: mocks.openReviewTrade }),
}))

function trade(o: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 1, symbol: 'RELIANCE', direction: 'LONG', entry_price: '2500', exit_price: '2600',
    quantity: '10', entry_time: '2025-06-03T09:30:00', exit_time: '2025-06-03T15:00:00', fees: '10',
    notes: null, tags: null, setup: 'Episodic Pivot', tactic: null, stop_price: '2450',
    target_price: null, r_multiple: '1.5', status: 'closed', pnl: '990', remaining_qty: '0',
    review_notes: null, review_tags: null, ...o,
  }
}

function pb(o: Partial<SetupPlaybookItem> = {}): SetupPlaybookItem {
  return {
    id: 1, name: 'Episodic Pivot', description: 'Strong news catalyst gap.',
    tactics: [{ name: 'Gap & Go', conditions: ['high volume'] }],
    ideal_conditions: ['catalyst', 'volume'],
    risk_profile: { max_risk_pct: 2 },
    rules: ['Rule one', 'Rule two'],
    win_rate: null, avg_r: null, trade_count: 0, is_active: 'active',
    created_at: '2025-01-01T00:00:00', updated_at: '2025-01-01T00:00:00', ...o,
  }
}

function tradesData(overrides: Partial<TradesV3Data> = {}): TradesV3Data {
  return { trades: [], total: 0, isLoading: false, isFetching: false, error: null, refresh: vi.fn(), ...overrides }
}

function setupsResponse(items: SetupPlaybookItem[]): { data: SetupPlaybookListResponse; isLoading: boolean; error: Error | null; refetch: () => void } {
  return { data: { total: items.length, items }, isLoading: false, error: null, refetch: vi.fn() }
}

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.useTradesV3Data.mockReset()
  mocks.useSetupsQuery.mockReset()
  mocks.useUpdateSetupMutation.mockReset()
  mocks.useCreateSetupMutation.mockReset()
  mocks.useArchiveSetupMutation.mockReset()
  mocks.useSeedSetupsMutation.mockReset()
  mocks.openDetailTrade.mockReset()
  mocks.openReviewTrade.mockReset()
  mocks.useUpdateSetupMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.useCreateSetupMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.useArchiveSetupMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.useSeedSetupsMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

describe('PlaybookV3Page', () => {
  it('renders loading state while data loads', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ isLoading: true }))
    mocks.useSetupsQuery.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() })
    render(wrap(<PlaybookV3Page />))
    expect(screen.getByLabelText(/Loading playbook/i)).toBeInTheDocument()
  })

  it('renders error state and retry button', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ error: new Error('boom') }))
    mocks.useSetupsQuery.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
    render(wrap(<PlaybookV3Page />))
    expect(screen.getByText(/Could not load playbook/i)).toBeInTheDocument()
  })

  it('renders empty library when no playbooks and no trades', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.getByText('Playbook')).toBeInTheDocument()
    expect(screen.getByText(/No setups match/i)).toBeInTheDocument()
    expect(screen.getByText(/Select a setup/i)).toBeInTheDocument()
  })

  it('renders setup library cards with backend playbooks', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [trade({ setup: 'Episodic Pivot' })] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([pb()]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.getAllByText('Episodic Pivot').length).toBeGreaterThan(0)
  })

  it('shows Untagged bucket for trades with no setup', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [trade({ id: 99, setup: null })] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.getAllByText(/Untagged/i).length).toBeGreaterThan(0)
  })

  it('auto-selects first entry and shows performance + tactics + rules', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [trade({ setup: 'Episodic Pivot' })] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([pb()]))
    render(wrap(<PlaybookV3Page />))
    // performance metrics rendered
    expect(screen.getAllByText('Win rate').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Avg R').length).toBeGreaterThan(0)
    // tactics rendered
    expect(screen.getByText('Gap & Go')).toBeInTheDocument()
    // rules rendered (numbered list)
    expect(screen.getByText('Rule one')).toBeInTheDocument()
    expect(screen.getByText('Rule two')).toBeInTheDocument()
  })

  it('selecting a different setup updates detail panel', async () => {
    mocks.useTradesV3Data.mockReturnValue(
      tradesData({
        trades: [
          trade({ id: 1, setup: 'Episodic Pivot' }),
          trade({ id: 2, setup: 'Pullback' }),
        ],
      }),
    )
    mocks.useSetupsQuery.mockReturnValue(
      setupsResponse([
        pb({ id: 1, name: 'Episodic Pivot', description: 'desc one', rules: ['EP rule'] }),
        pb({ id: 2, name: 'Pullback', description: 'desc two', rules: ['PB rule'] }),
      ]),
    )
    const user = userEvent.setup()
    render(wrap(<PlaybookV3Page />))
    // First should be auto-selected (EP rule visible)
    expect(screen.getByText('EP rule')).toBeInTheDocument()
    // Click the Pullback card in the library
    const pullbackHeader = screen
      .getAllByText('Pullback')
      .find((el) => el.closest('[role="button"]'))
    expect(pullbackHeader).toBeDefined()
    await user.click(pullbackHeader!)
    expect(screen.getByText('PB rule')).toBeInTheDocument()
  })

  it('shows honest no-rules state for trade-derived setups', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [trade({ id: 1, setup: 'CustomSetup' })] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.getAllByText(/No playbook record/i).length).toBeGreaterThan(0)
    // Trade-derived badge appears in detail header
    expect(screen.getAllByText(/Not in playbook/i).length).toBeGreaterThan(0)
  })

  it('renders Intelligence tab button', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.getByRole('button', { name: /intelligence/i })).toBeInTheDocument()
  })

  it('shows no NaN, undefined, null, or [object Object] for empty data', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([pb({ id: 1, name: 'Empty' })]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.queryByText(/undefined/i)).toBeNull()
    expect(screen.queryByText(/^null$/)).toBeNull()
    expect(screen.queryByText(/object Object/)).toBeNull()
  })

  it('does not surface fake AI/coaching text', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [trade({ setup: 'Episodic Pivot' })] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([pb()]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.queryByText(/AI insight/i)).toBeNull()
    expect(screen.queryByText(/coaching recommendation/i)).toBeNull()
    expect(screen.queryByText(/auto-generated/i)).toBeNull()
  })

  it('renders gross P&L label, not net', () => {
    mocks.useTradesV3Data.mockReturnValue(tradesData({ trades: [trade({ setup: 'Episodic Pivot' })] }))
    mocks.useSetupsQuery.mockReturnValue(setupsResponse([pb()]))
    render(wrap(<PlaybookV3Page />))
    expect(screen.getAllByText(/Gross P&L/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/^Net P&L$/)).toBeNull()
  })
})
