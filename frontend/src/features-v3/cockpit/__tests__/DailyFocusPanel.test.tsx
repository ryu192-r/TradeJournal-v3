import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyFocus, ImprovementAction } from '@/types/performanceOs'
import { todaySessionDate } from '@/utils/tradeDates'
import { DailyFocusPanel } from '../components/DailyFocusPanel'

const mocks = vi.hoisted(() => ({
  useDailyFocus: vi.fn(),
  createMutate: vi.fn(),
  selectMutate: vi.fn(),
}))

vi.mock('../hooks/useImprovementActions', () => ({
  useDailyFocus: mocks.useDailyFocus,
  useCreateImprovementAction: () => ({ mutate: mocks.createMutate, isPending: false }),
  useUpdateImprovementAction: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteImprovementAction: () => ({ mutate: vi.fn(), isPending: false }),
  useSelectDailyFocus: () => ({ mutate: mocks.selectMutate, isPending: false }),
  useClearDailyFocus: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/store/toastStore', () => ({
  useToastStore: (selector: (s: { addToast: () => void }) => unknown) => selector({ addToast: vi.fn() }),
}))

function makeAction(over: Partial<ImprovementAction> = {}): ImprovementAction {
  return {
    id: 1,
    title: 'Wait for confirmation candle',
    description: null,
    status: 'suggested',
    due_session: null,
    contract_type: 'manual_check',
    contract_params: {},
    source_evidence: {},
    is_daily_focus: false,
    created_at: '2025-01-13T00:00:00Z',
    updated_at: '2025-01-13T00:00:00Z',
    ...over,
  }
}

function setFocus(focus: DailyFocus['focus'], backlog: ImprovementAction[]) {
  mocks.useDailyFocus.mockReturnValue({
    data: { date: '2025-01-13', focus, backlog },
    isLoading: false,
    isError: false,
  })
}

describe('DailyFocusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the focus action and the backlog separately', () => {
    setFocus(
      makeAction({ id: 1, title: 'Focus action', status: 'active', is_daily_focus: true }),
      [makeAction({ id: 2, title: 'Backlog one' }), makeAction({ id: 3, title: 'Backlog two' })],
    )
    render(<DailyFocusPanel />)

    expect(screen.getByText('Focus action')).toBeInTheDocument()
    expect(screen.getByText('Backlog one')).toBeInTheDocument()
    expect(screen.getByText('Backlog two')).toBeInTheDocument()
    expect(screen.getByText('Daily Focus Action')).toBeInTheDocument()
    expect(screen.getByText('Improvement Backlog')).toBeInTheDocument()
  })

  it('shows the empty focus state when nothing is selected', () => {
    setFocus(null, [])
    render(<DailyFocusPanel />)
    expect(screen.getByText(/No focus set for today/i)).toBeInTheDocument()
  })

  it('creates an improvement action through the add form', () => {
    setFocus(null, [])
    render(<DailyFocusPanel />)

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(screen.getByPlaceholderText(/Wait for the confirmation candle/i), {
      target: { value: 'No revenge trading' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create/i }))

    expect(mocks.createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No revenge trading', contract_type: 'manual_check' }),
      expect.anything(),
    )
  })

  it('selects a backlog action as the daily focus', () => {
    setFocus(null, [makeAction({ id: 7, title: 'Backlog candidate' })])
    render(<DailyFocusPanel />)

    fireEvent.click(screen.getByRole('button', { name: /make today's focus/i }))
    expect(mocks.selectMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, date: todaySessionDate() }),
      expect.anything(),
    )
  })

  it('shows the signed-out state when data is disabled', () => {
    setFocus(null, [])
    render(<DailyFocusPanel dataEnabled={false} />)
    expect(screen.getByText(/Sign in to use the improvement loop/i)).toBeInTheDocument()
  })
})
