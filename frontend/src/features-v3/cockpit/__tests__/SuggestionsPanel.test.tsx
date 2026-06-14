import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImprovementAction } from '@/types/performanceOs'
import { SuggestionsPanel } from '../components/SuggestionsPanel'

const mocks = vi.hoisted(() => ({
  useImprovementActions: vi.fn(),
  generateMutate: vi.fn(),
  updateMutate: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('../hooks/useImprovementActions', () => ({
  useImprovementActions: mocks.useImprovementActions,
  useGenerateSuggestions: () => ({ mutateAsync: mocks.generateMutate, isPending: false }),
  useUpdateImprovementAction: () => ({ mutateAsync: mocks.updateMutate, isPending: false }),
}))

vi.mock('@/store/toastStore', () => ({
  useToastStore: (selector: (s: { addToast: () => void }) => unknown) =>
    selector({ addToast: mocks.addToast }),
}))

function makeAction(over: Partial<ImprovementAction> = {}): ImprovementAction {
  return {
    id: 1,
    title: 'Stop entering before the trigger',
    description: 'Detected 3 journal rule violations matching early_entry in the last 30 days.',
    status: 'suggested',
    due_session: null,
    contract_type: 'no_early_entry',
    contract_params: {},
    source_evidence: {
      type: 'rule_violation',
      kind: 'early_entry',
      occurrences: 3,
      window_days: 30,
      evidence_refs: [{}, {}, {}],
    },
    is_daily_focus: false,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  }
}

function setActions(actions: ImprovementAction[], isLoading = false) {
  mocks.useImprovementActions.mockReturnValue({ data: actions, isLoading })
}

describe('SuggestionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generateMutate.mockResolvedValue([])
    mocks.updateMutate.mockResolvedValue(undefined)
  })

  it('renders empty state when no suggestions', () => {
    setActions([])
    render(<SuggestionsPanel />)
    expect(screen.getByText('No suggested actions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate suggestions/i })).toBeInTheDocument()
  })

  it('renders suggestion with title, contract, and evidence summary', () => {
    setActions([makeAction()])
    render(<SuggestionsPanel />)
    expect(screen.getByText('Stop entering before the trigger')).toBeInTheDocument()
    expect(screen.getByText('No early entry')).toBeInTheDocument()
    // Status badge
    expect(screen.getByText('suggested')).toBeInTheDocument()
    // Evidence summary references occurrences and window
    const evidence = screen.getByLabelText('Source evidence')
    expect(evidence.textContent).toContain('3')
    expect(evidence.textContent).toContain('30')
    expect(evidence.textContent).toContain('early_entry')
  })

  it('clicking Generate calls the mutation with default 30 days', async () => {
    setActions([])
    mocks.generateMutate.mockResolvedValue([makeAction()])
    const user = userEvent.setup()
    render(<SuggestionsPanel />)
    await user.click(screen.getByRole('button', { name: /generate suggestions/i }))
    await waitFor(() => expect(mocks.generateMutate).toHaveBeenCalled())
    expect(mocks.generateMutate).toHaveBeenCalledWith(30)
  })

  it('clicking Approve sends status=active to update mutation', async () => {
    setActions([makeAction({ id: 7 })])
    const user = userEvent.setup()
    render(<SuggestionsPanel />)
    await user.click(screen.getByRole('button', { name: /approve suggestion/i }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 7, payload: { status: 'active' } })
  })

  it('clicking Retire sends status=retired to update mutation', async () => {
    setActions([makeAction({ id: 9 })])
    const user = userEvent.setup()
    render(<SuggestionsPanel />)
    await user.click(screen.getByRole('button', { name: /retire suggestion/i }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 9, payload: { status: 'retired' } })
  })

  it('Edit flow updates title and description, then exits edit mode', async () => {
    setActions([makeAction({ id: 5 })])
    const user = userEvent.setup()
    render(<SuggestionsPanel />)
    await user.click(screen.getByRole('button', { name: /edit suggestion/i }))
    const titleInput = screen.getByLabelText('Edit suggestion title')
    fireEvent.change(titleInput, { target: { value: 'Custom title' } })
    const descInput = screen.getByLabelText('Edit suggestion description')
    fireEvent.change(descInput, { target: { value: 'Custom desc' } })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({
      id: 5,
      payload: { title: 'Custom title', description: 'Custom desc' },
    })
  })

  it('Edit Cancel reverts and does not call mutation', async () => {
    setActions([makeAction({ id: 6 })])
    const user = userEvent.setup()
    render(<SuggestionsPanel />)
    await user.click(screen.getByRole('button', { name: /edit suggestion/i }))
    fireEvent.change(screen.getByLabelText('Edit suggestion title'), { target: { value: 'Should not save' } })
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mocks.updateMutate).not.toHaveBeenCalled()
    // Original title visible again
    expect(screen.getByText('Stop entering before the trigger')).toBeInTheDocument()
  })

  it('disables Generate button when dataEnabled=false', () => {
    setActions([])
    render(<SuggestionsPanel dataEnabled={false} />)
    expect(screen.getByRole('button', { name: /generate suggestions/i })).toBeDisabled()
  })

  it('shows toast when generate yields no new suggestions', async () => {
    setActions([])
    mocks.generateMutate.mockResolvedValue([])
    const user = userEvent.setup()
    render(<SuggestionsPanel />)
    await user.click(screen.getByRole('button', { name: /generate suggestions/i }))
    await waitFor(() => expect(mocks.addToast).toHaveBeenCalled())
    const toastCall = mocks.addToast.mock.calls[0][0] as { title: string; variant: string }
    expect(toastCall.title).toMatch(/no new/i)
  })
})
