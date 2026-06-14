import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyFocus, ImprovementAction } from '@/types/performanceOs'
import { TodaysFocusCard } from '../components/TodaysFocusCard'

const mocks = vi.hoisted(() => ({
  useDailyFocus: vi.fn(),
  setActiveView: vi.fn(),
}))

vi.mock('../hooks/useImprovementActions', () => ({
  useDailyFocus: mocks.useDailyFocus,
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: (selector: (s: { setActiveView: (v: string) => void }) => unknown) =>
    selector({ setActiveView: mocks.setActiveView }),
}))

function makeAction(over: Partial<ImprovementAction> = {}): ImprovementAction {
  return {
    id: 1,
    title: 'Wait for confirmation',
    description: 'Wait one candle before entry.',
    status: 'active',
    due_session: '2026-06-14',
    contract_type: 'no_early_entry',
    contract_params: { not_before: '09:30' },
    source_evidence: {},
    is_daily_focus: true,
    created_at: '2026-06-14T00:00:00Z',
    updated_at: '2026-06-14T00:00:00Z',
    ...over,
  }
}

function setData(focus: DailyFocus['focus'], opts: { isLoading?: boolean } = {}) {
  mocks.useDailyFocus.mockReturnValue({
    data: focus == null && opts.isLoading ? undefined : { date: '2026-06-14', focus, backlog: [] },
    isLoading: opts.isLoading ?? false,
    isError: false,
  })
}

describe('TodaysFocusCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders sign-in prompt when dataEnabled=false', () => {
    setData(null)
    render(<TodaysFocusCard dataEnabled={false} />)
    expect(screen.getByText('Sign in to load the Daily Focus.')).toBeInTheDocument()
  })

  it('renders loading state', () => {
    setData(null, { isLoading: true })
    render(<TodaysFocusCard />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders no-focus empty state with Open Improvement button', () => {
    setData(null)
    render(<TodaysFocusCard />)
    expect(screen.getByText('No Daily Focus selected for this session.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open improvement page/i })).toBeInTheDocument()
  })

  it('clicking Open Improvement (no focus) navigates to improvement view', async () => {
    setData(null)
    const user = userEvent.setup()
    render(<TodaysFocusCard />)
    await user.click(screen.getByRole('button', { name: /open improvement page/i }))
    expect(mocks.setActiveView).toHaveBeenCalledWith('improvement')
  })

  it('renders focus title + contract + status when focus is active', () => {
    setData(makeAction({ status: 'active' }))
    render(<TodaysFocusCard />)
    expect(screen.getByText('Wait for confirmation')).toBeInTheDocument()
    expect(screen.getByText('No early entry')).toBeInTheDocument()
    expect(screen.getByText('Pending verification')).toBeInTheDocument()
  })

  it('shows Kept badge when focus is kept', () => {
    setData(makeAction({ status: 'kept' }))
    render(<TodaysFocusCard />)
    expect(screen.getByText('Kept')).toBeInTheDocument()
  })

  it('shows Broken badge when focus is broken', () => {
    setData(makeAction({ status: 'broken' }))
    render(<TodaysFocusCard />)
    expect(screen.getByText('Broken')).toBeInTheDocument()
  })

  it('clicking the title navigates to improvement view', async () => {
    setData(makeAction())
    const user = userEvent.setup()
    render(<TodaysFocusCard />)
    await user.click(screen.getByRole('button', { name: /go to improvement page/i }))
    expect(mocks.setActiveView).toHaveBeenCalledWith('improvement')
  })

  it('clicking the header Open Improvement action navigates', async () => {
    setData(makeAction())
    const user = userEvent.setup()
    render(<TodaysFocusCard />)
    await user.click(screen.getByRole('button', { name: /open improvement page/i }))
    expect(mocks.setActiveView).toHaveBeenCalledWith('improvement')
  })

  it('renders focus description when present', () => {
    setData(makeAction({ description: 'Custom description text' }))
    render(<TodaysFocusCard />)
    expect(screen.getByText('Custom description text')).toBeInTheDocument()
  })
})
