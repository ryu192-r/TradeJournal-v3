import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { DashboardPage } from '@/pages/DashboardPage'
import { PartialExitForm } from '@/components/lifecycle/PartialExitForm'

let operationalDashboardMock: any = {
  kpi: {
    trade_count: 0,
    win_rate: null,
    profit_factor: null,
    expectancy: null,
    avg_r_multiple: null,
    max_drawdown_amount: null,
    max_drawdown_pct: null,
    net_pnl: '0',
    gross_profit: '0',
    gross_loss: '0',
  },
  open_trades: [],
  risk: {
    net_equity: '100000',
    open_positions: 0,
    deployed_capital: '0',
    available_capital: '100000',
    open_risk: '0',
    portfolio_heat_pct: null,
    deployed_capital_pct: null,
    positions_without_stop: 0,
    warnings: [],
  },
  capital: {
    net_equity: '100000',
    initial_balance: '100000',
    total_deposits: '0',
    total_withdrawals: '0',
    total_realized_pnl: '0',
    unrealized_pnl: '0',
    total_equity_unrealized: '100000',
    total_trades: 0,
    win_rate: null,
  },
  streaks: { current_type: null, current_count: 0, longest_win: 0, longest_loss: 0 },
  equity_curve: [{ date: '2025-01-13', equity: '100000' }],
}

let intelligenceDashboardMock: any = {
  lifecycle: {
    total_emotion_logs: 0,
    most_frequent_emotion: null,
    worst_performing_emotion: null,
    graded_trades: 0,
    avg_grade_score: null,
    high_grade_rate: null,
    discipline_score: null,
  },
  behavioral: {
    overtrading_days: 0,
    overtrading_weeks: 0,
    revenge_trades: 0,
    early_exit_rate: null,
    avg_capture_ratio: null,
  },
  playbook: { setups: [] },
  market: {
    date: null,
    nifty_close: null,
    nifty_change_pct: null,
    nifty_regime: null,
    india_vix: null,
    fii_flow_cr: null,
    dii_flow_cr: null,
    breadth_advance: null,
    breadth_decline: null,
  },
}

vi.mock('@/hooks/useOperationalDashboardQuery', () => ({
  useOperationalDashboardQuery: () => ({
    data: operationalDashboardMock,
    isLoading: false,
    isFetching: false,
    error: null,
  }),
}))

vi.mock('@/hooks/useIntelligenceDashboardQuery', () => ({
  useIntelligenceDashboardQuery: () => ({
    data: intelligenceDashboardMock,
  }),
}))

vi.mock('@/hooks/useMarketContextQuery', () => ({
  useLiveQuotesQuery: () => ({ data: { quotes: [], total: 0 } }),
  useSyncLiveQuotesMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useMarketRegimeQuery: () => ({ data: { current: null }, isLoading: false }),
}))

vi.mock('@/hooks/usePerformanceOS', () => ({
  useDailyDashboard: () => ({
    data: {
      workflow: {
        id: 1,
        date: '2025-01-13',
        phase: 'pre_market',
        pre_market_done: false,
        execution_done: false,
        review_done: false,
        behavior_done: false,
        checklist_items: [{ id: 'risk', label: 'Risk plan ready', checked: false }],
        watchlist_symbols: [],
        pre_market_notes: null,
        intraday_notes: null,
        post_market_notes: null,
        mood_rating: null,
        discipline_rating: null,
        created_at: '2025-01-13T00:00:00',
        updated_at: '2025-01-13T00:00:00',
      },
      today_trades: [],
      open_positions: [],
      market_regime: null,
      journal: null,
      discipline_score: null,
      phase_progress: {
        current_phase: 'pre_market',
        current_index: 0,
        phases: ['pre_market', 'execution', 'review', 'behavior'],
        completed: [false, false, false, false],
        all_done: false,
      },
    },
    isLoading: false,
  }),
  useAdvancePhase: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateWorkflow: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useResetWorkflow: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useEdgeCommandCenterQuery', () => ({
  useEdgeCommandCenterQuery: () => ({
    data: {
      review_queue: [],
      priorities: [],
      summary: { risk_warnings: [] },
      workflow: { is_complete: true, missing_items: [], next_step: '' },
      next_best_action: '',
    },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/hooks/useActionsInboxQuery', () => ({
  useActionsInboxQuery: () => ({
    data: {
      generated_at: '2025-05-31T00:00:00Z',
      interface_mode: 'simple',
      open_count: 0,
      items: [],
      sections: [],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useTradesQuery', () => ({
  useTradesQuery: () => ({
    data: { total: 0, items: [] },
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useJournalMutation', () => ({
  useWeeklyJournalStatsQuery: () => ({ data: null }),
  useWeeklyJournalsQuery: () => ({ data: [] }),
}))

vi.mock('@/hooks/useTradeMutation', () => ({
  useTradeQuery: () => ({
    data: {
      id: 1,
      symbol: 'RELIANCE',
      direction: 'LONG',
      entry_price: '100',
      exit_price: '110',
      quantity: '10',
      entry_time: '2025-01-13T09:30:00',
      exit_time: '2025-01-13T10:00:00',
      fees: '0',
      notes: null,
      tags: [],
      setup: 'EP',
      tactic: null,
      stop_price: '95',
      target_price: '120',
      r_multiple: '2',
      status: 'closed',
      pnl: '100',
      chart_images: [],
      review_notes: null,
      review_tags: [],
      exit_notes: null,
      exit_reason: 'target',
      created_at: '2025-01-13T09:30:00',
      updated_at: '2025-01-13T10:00:00',
      remaining_qty: '10',
      partial_realized_pnl: null,
      unrealized_pnl: null,
    },
    isLoading: false,
    error: null,
  }),
  useDeleteTradeMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/components/trades/ChartImageGallery', () => ({
  ChartImageGallery: () => <div>Chart gallery</div>,
}))

vi.mock('@/components/lifecycle/LifecycleReviewPanel', () => ({
  LifecycleReviewPanel: () => <div>Lifecycle panel</div>,
}))

vi.mock('@/hooks/usePartialExitQuery', () => ({
  usePartialExitsQuery: () => ({
    data: { items: [], remaining_qty: '10' },
    isLoading: false,
  }),
  useCreatePartialExitMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePartialExitMutation: () => ({ mutate: vi.fn(), isPending: false }),
}))

function renderWithQueryClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('Phase 0 frontend smoke tests', () => {
  it('renders Dashboard when optional dashboard arrays are missing', () => {
    operationalDashboardMock = {
      ...operationalDashboardMock,
      open_trades: undefined,
      equity_curve: undefined,
      risk: { ...operationalDashboardMock.risk, warnings: undefined },
    }
    intelligenceDashboardMock = {
      ...intelligenceDashboardMock,
      playbook: undefined,
    }

    renderWithQueryClient(<DashboardPage />)
    expect(screen.getByRole('heading', { name: 'Command Center' })).toBeInTheDocument()
    expect(screen.getByText('Recent trades')).toBeInTheDocument()

    operationalDashboardMock = {
      ...operationalDashboardMock,
      open_trades: [],
      equity_curve: [{ date: '2025-01-13', equity: '100000' }],
      risk: { ...operationalDashboardMock.risk, warnings: [] },
    }
    intelligenceDashboardMock = {
      ...intelligenceDashboardMock,
      playbook: { setups: [] },
    }
  })

  it('renders Dashboard with empty operational data', () => {
    renderWithQueryClient(<DashboardPage />)
    expect(screen.getByRole('heading', { name: 'Command Center' })).toBeInTheDocument()
    expect(screen.getByText('Recent trades')).toBeInTheDocument()
  })



  it('renders Partial Exit form', () => {
    renderWithQueryClient(<PartialExitForm tradeId={1} entryPrice={100} currentQty={10} onClose={vi.fn()} />)
    expect(screen.getByText('Remaining: 10')).toBeInTheDocument()
    expect(screen.getByText('New partial exit')).toBeInTheDocument()
  })
})
