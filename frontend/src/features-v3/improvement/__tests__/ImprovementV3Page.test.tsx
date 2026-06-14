import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyFocus, ImprovementAction, VerificationResult } from '@/types/performanceOs'
import type { DailyJournal } from '@/types'
import { ImprovementV3Page } from '../ImprovementV3Page'

const mocks = vi.hoisted(() => ({
  useDailyFocus: vi.fn(),
  useImprovementActions: vi.fn(),
  useJournalQuery: vi.fn(),
  verifyMutate: vi.fn(),
  updateMutate: vi.fn(),
  selectFocusMutate: vi.fn(),
  createActionMutate: vi.fn(),
  createJournalMutate: vi.fn(),
  updateJournalMutate: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('@/features-v3/cockpit/hooks/useImprovementActions', () => ({
  useDailyFocus: mocks.useDailyFocus,
  useImprovementActions: mocks.useImprovementActions,
  useUpdateImprovementAction: () => ({ mutateAsync: mocks.updateMutate, isPending: false }),
  useSelectDailyFocus: () => ({ mutateAsync: mocks.selectFocusMutate, isPending: false }),
  useVerifyImprovementAction: () => ({ mutateAsync: mocks.verifyMutate, isPending: false }),
  useCreateImprovementAction: () => ({ mutateAsync: mocks.createActionMutate, isPending: false }),
}))

vi.mock('@/hooks/useJournalMutation', () => ({
  useJournalQuery: mocks.useJournalQuery,
  useCreateJournalMutation: () => ({ mutateAsync: mocks.createJournalMutate, isPending: false }),
  useUpdateJournalMutation: () => ({ mutateAsync: mocks.updateJournalMutate, isPending: false }),
}))

vi.mock('@/store/toastStore', () => ({
  useToastStore: (selector: (s: { addToast: () => void }) => unknown) =>
    selector({ addToast: mocks.addToast }),
}))

function makeAction(over: Partial<ImprovementAction> = {}): ImprovementAction {
  return {
    id: 1,
    title: 'Cap daily trades',
    description: null,
    status: 'active',
    due_session: '2026-06-14',
    contract_type: 'max_trades',
    contract_params: { max: 2 },
    source_evidence: { kind: 'overtrading', occurrences: 3, window_days: 30, evidence_refs: [{}, {}, {}] },
    is_daily_focus: true,
    created_at: '2026-06-13T00:00:00Z',
    updated_at: '2026-06-13T00:00:00Z',
    ...over,
  }
}

function setFocus(focus: DailyFocus['focus']) {
  mocks.useDailyFocus.mockReturnValue({
    data: { date: '2026-06-14', focus, backlog: [] },
    isLoading: false,
    isError: false,
  })
}

function setActions(status: 'suggested' | 'active', items: ImprovementAction[]) {
  mocks.useImprovementActions.mockImplementation((s?: string) => {
    if (s === status) return { data: items, isLoading: false }
    if (s === 'suggested') return { data: [], isLoading: false }
    if (s === 'active') return { data: [], isLoading: false }
    return { data: [], isLoading: false }
  })
}

function setActionsBoth(suggested: ImprovementAction[], active: ImprovementAction[]) {
  mocks.useImprovementActions.mockImplementation((s?: string) => {
    if (s === 'suggested') return { data: suggested, isLoading: false }
    if (s === 'active') return { data: active, isLoading: false }
    return { data: [], isLoading: false }
  })
}

function setJournal(journal: DailyJournal | null) {
  mocks.useJournalQuery.mockReturnValue({
    data: journal,
    isLoading: false,
  })
}

function makeJournal(over: Partial<DailyJournal> = {}): DailyJournal {
  return {
    id: 1,
    date: '2026-06-14',
    pre_trade_notes: null,
    post_trade_notes: null,
    bias_notes: null,
    trade_count: null,
    total_pnl: null,
    avg_r_multiple: null,
    win_rate: null,
    mood_rating: null,
    discipline_rating: null,
    mood_notes: null,
    rules_followed: null,
    rules_violated: null,
    lessons_learned: null,
    created_at: '2026-06-14T00:00:00Z',
    updated_at: '2026-06-14T00:00:00Z',
    ...over,
  }
}

describe('ImprovementV3Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setFocus(null)
    setActions('suggested', [])
    setJournal(null)
    mocks.useImprovementActions.mockImplementation(() => ({ data: [], isLoading: false }))
    mocks.verifyMutate.mockResolvedValue({} as VerificationResult)
    mocks.updateMutate.mockResolvedValue(undefined)
    mocks.selectFocusMutate.mockResolvedValue(undefined)
    mocks.createActionMutate.mockResolvedValue(undefined)
    mocks.createJournalMutate.mockResolvedValue(undefined)
    mocks.updateJournalMutate.mockResolvedValue(undefined)
  })

  it('renders the page with all four zones', () => {
    render(<ImprovementV3Page />)
    expect(screen.getByText('Improvement')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Now' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Focus' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Next Move' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Backlog' })).toBeInTheDocument()
  })

  it('Now zone shows "No focus set" when no focus', () => {
    render(<ImprovementV3Page />)
    expect(screen.getByText('No focus set')).toBeInTheDocument()
  })

  it('Now zone shows "Pending verification" when focus is active', () => {
    setFocus(makeAction({ status: 'active' }))
    render(<ImprovementV3Page />)
    expect(screen.getByText('Pending verification')).toBeInTheDocument()
  })

  it('Now zone shows "Kept" when focus is kept', () => {
    setFocus(makeAction({ status: 'kept' }))
    render(<ImprovementV3Page />)
    // Both Now and Focus zones can show "Kept" — assert at least one exists
    expect(screen.getAllByText('Kept').length).toBeGreaterThanOrEqual(1)
  })

  it('Focus zone shows empty state with no focus', () => {
    render(<ImprovementV3Page />)
    expect(screen.getByText('No Daily Focus')).toBeInTheDocument()
  })

  it('Focus zone shows source evidence when available', () => {
    setFocus(makeAction())
    render(<ImprovementV3Page />)
    const evidence = screen.getByLabelText('Source evidence')
    expect(evidence.textContent).toContain('3')
    expect(evidence.textContent).toContain('overtrading')
  })

  it('Focus zone Verify button calls verify mutation and shows result', async () => {
    setFocus(makeAction({ id: 7 }))
    mocks.verifyMutate.mockResolvedValue({
      action_id: 7,
      contract_type: 'max_trades',
      session: '2026-06-14',
      result: 'broken',
      summary: '3 trades placed — limit was 2.',
      evidence: { count: 3 },
      requires_confirmation: false,
    })
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalledWith({ id: 7 }))
    expect(screen.getByText('Preselected:')).toBeInTheDocument()
    expect(screen.getByText('3 trades placed — limit was 2.')).toBeInTheDocument()
  })

  it('Focus zone Confirm kept calls update with status=kept', async () => {
    setFocus(makeAction({ id: 9 }))
    mocks.verifyMutate.mockResolvedValue({
      action_id: 9, contract_type: 'max_trades', session: '2026-06-14',
      result: 'kept', summary: 'OK', evidence: {}, requires_confirmation: false,
    })
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: /mark kept/i }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 9, payload: { status: 'kept' } })
  })

  it('Next Move shows Reality Check warning when lesson lacks evidence', async () => {
    render(<ImprovementV3Page />)
    const textarea = screen.getByLabelText('Evidence-backed lesson')
    fireEvent.change(textarea, { target: { value: 'I was bad today.' } })
    expect(screen.getByText('No evidence cited')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toMatch(/Reality Check/i)
  })

  it('Next Move shows "Evidence cited" when lesson references a trade', async () => {
    render(<ImprovementV3Page />)
    const textarea = screen.getByLabelText('Evidence-backed lesson')
    fireEvent.change(textarea, { target: { value: 'Trade #5 — moved stop wrong' } })
    expect(screen.getByText('Evidence cited')).toBeInTheDocument()
  })

  it('Save lesson calls createJournal when no journal exists', async () => {
    setJournal(null)
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    const textarea = screen.getByLabelText('Evidence-backed lesson')
    fireEvent.change(textarea, { target: { value: 'New lesson' } })
    await user.click(screen.getByRole('button', { name: /save lesson/i }))
    await waitFor(() => expect(mocks.createJournalMutate).toHaveBeenCalled())
    expect(mocks.createJournalMutate).toHaveBeenCalledWith({ date: expect.any(String), lessons_learned: 'New lesson' })
  })

  it('Save lesson calls updateJournal when journal exists', async () => {
    setJournal(makeJournal({ lessons_learned: 'old text' }))
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    await user.click(screen.getByRole('button', { name: /save lesson/i }))
    await waitFor(() => expect(mocks.updateJournalMutate).toHaveBeenCalled())
    const call = mocks.updateJournalMutate.mock.calls[0][0] as { date: string; payload: { lessons_learned: string | null } }
    expect(call.payload.lessons_learned).toBe('old text')
  })

  it('Create action button calls createImprovementAction', async () => {
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    fireEvent.change(screen.getByLabelText('Evidence-backed lesson'), { target: { value: 'Stop was widened' } })
    fireEvent.change(screen.getByLabelText('Improvement action title'), { target: { value: 'Do not widen stops' } })
    await user.click(screen.getByRole('button', { name: /create improvement action/i }))
    await waitFor(() => expect(mocks.createActionMutate).toHaveBeenCalled())
    expect(mocks.createActionMutate).toHaveBeenCalledWith({
      title: 'Do not widen stops',
      description: 'Stop was widened',
      contract_type: 'manual_check',
    })
  })

  it('Create action is disabled when title is empty', () => {
    render(<ImprovementV3Page />)
    expect(screen.getByRole('button', { name: /create improvement action/i })).toBeDisabled()
  })

  it('Backlog shows empty state when no actions', () => {
    render(<ImprovementV3Page />)
    expect(screen.getByText('Backlog is empty')).toBeInTheDocument()
  })

  it('Backlog filters out the focus action', () => {
    const focus = makeAction({ id: 1, title: 'My-Focus-Title-Unique', status: 'active' })
    setFocus(focus)
    setActionsBoth([], [focus, makeAction({ id: 2, title: 'Other-Backlog-Item' })])
    render(<ImprovementV3Page />)
    // Focus title appears in Now zone summary, but should not appear in Backlog rows.
    // Backlog row would have a "Set as Focus" button; focus item has no row.
    // Verify backlog shows only the non-focus item.
    expect(screen.getByText('Other-Backlog-Item')).toBeInTheDocument()
    // Set-as-Focus appears once (only for the non-focus item)
    const setFocusBtns = screen.getAllByRole('button', { name: /set as focus/i })
    expect(setFocusBtns.length).toBe(1)
  })

  it('Backlog Approve calls update with status=active', async () => {
    setActionsBoth([makeAction({ id: 5, title: 'Sugg', status: 'suggested' })], [])
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    await user.click(screen.getByRole('button', { name: /^approve$/i }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 5, payload: { status: 'active' } })
  })

  it('Backlog Set as Focus calls selectFocus mutation', async () => {
    setActionsBoth([], [makeAction({ id: 8, title: 'Active', status: 'active' })])
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    await user.click(screen.getByRole('button', { name: /set as focus/i }))
    await waitFor(() => expect(mocks.selectFocusMutate).toHaveBeenCalled())
    const call = mocks.selectFocusMutate.mock.calls[0][0] as { id: number; date: string }
    expect(call.id).toBe(8)
    expect(typeof call.date).toBe('string')
  })

  it('Backlog Retire calls update with status=retired', async () => {
    setActionsBoth([], [makeAction({ id: 11, title: 'Active', status: 'active' })])
    const user = userEvent.setup()
    render(<ImprovementV3Page />)
    await user.click(screen.getByRole('button', { name: /^retire$/i }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 11, payload: { status: 'retired' } })
  })

  it('shows missing-evidence empty states when dataEnabled=false', () => {
    render(<ImprovementV3Page dataEnabled={false} />)
    // All zones should render their disabled state
    const signins = screen.getAllByText('Sign in required')
    expect(signins.length).toBeGreaterThanOrEqual(2)
  })
})
