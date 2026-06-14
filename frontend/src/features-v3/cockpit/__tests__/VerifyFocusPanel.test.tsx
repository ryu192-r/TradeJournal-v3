import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DailyFocus, ImprovementAction, VerificationResult } from '@/types/performanceOs'
import { VerifyFocusPanel } from '../components/VerifyFocusPanel'

const mocks = vi.hoisted(() => ({
  useDailyFocus: vi.fn(),
  verifyMutate: vi.fn(),
  updateMutate: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('../hooks/useImprovementActions', () => ({
  useDailyFocus: mocks.useDailyFocus,
  useVerifyImprovementAction: () => ({ mutateAsync: mocks.verifyMutate, isPending: false }),
  useUpdateImprovementAction: () => ({ mutateAsync: mocks.updateMutate, isPending: false }),
}))

vi.mock('@/store/toastStore', () => ({
  useToastStore: (selector: (s: { addToast: () => void }) => unknown) =>
    selector({ addToast: mocks.addToast }),
}))

function makeAction(over: Partial<ImprovementAction> = {}): ImprovementAction {
  return {
    id: 1,
    title: 'Cap daily trade count',
    description: null,
    status: 'active',
    due_session: '2026-06-14',
    contract_type: 'max_trades',
    contract_params: { max: 2 },
    source_evidence: {},
    is_daily_focus: true,
    created_at: '2026-06-13T00:00:00Z',
    updated_at: '2026-06-13T00:00:00Z',
    ...over,
  }
}

function setFocus(focus: DailyFocus['focus'], backlog: ImprovementAction[] = []) {
  mocks.useDailyFocus.mockReturnValue({
    data: { date: '2026-06-14', focus, backlog },
    isLoading: false,
    isError: false,
  })
}

function makeResult(over: Partial<VerificationResult> = {}): VerificationResult {
  return {
    action_id: 1,
    contract_type: 'max_trades',
    session: '2026-06-14',
    result: 'kept',
    summary: '1 of 2 trades — under cap.',
    evidence: { max: 2, count: 1, checks_performed: 1 },
    requires_confirmation: false,
    ...over,
  }
}

describe('VerifyFocusPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyMutate.mockResolvedValue(makeResult())
    mocks.updateMutate.mockResolvedValue(undefined)
  })

  it('renders nothing when no focus is set', () => {
    setFocus(null)
    const { container } = render(<VerifyFocusPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when dataEnabled=false', () => {
    setFocus(makeAction())
    const { container } = render(<VerifyFocusPanel dataEnabled={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows resolved status when focus is already kept', () => {
    setFocus(makeAction({ status: 'kept' }))
    render(<VerifyFocusPanel />)
    expect(screen.getByText("Today's focus is already finalized.")).toBeInTheDocument()
    expect(screen.getByText('Kept')).toBeInTheDocument()
  })

  it('shows resolved status when focus is already broken', () => {
    setFocus(makeAction({ status: 'broken' }))
    render(<VerifyFocusPanel />)
    expect(screen.getByText('Broken')).toBeInTheDocument()
  })

  it('shows Verify button initially when focus is active', () => {
    setFocus(makeAction({ status: 'active' }))
    render(<VerifyFocusPanel />)
    expect(screen.getByRole('button', { name: /verify focus/i })).toBeInTheDocument()
  })

  it('clicking Verify calls the mutation and renders kept result + evidence', async () => {
    setFocus(makeAction())
    const user = userEvent.setup()
    render(<VerifyFocusPanel />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalledWith({ id: 1 }))
    expect(screen.getByText('Kept')).toBeInTheDocument()
    expect(screen.getByText(/1 of 2 trades — under cap/i)).toBeInTheDocument()
    const evidence = screen.getByLabelText('Result evidence')
    expect(evidence.textContent).toContain('1 check')
  })

  it('renders broken result with violation details', async () => {
    setFocus(makeAction())
    mocks.verifyMutate.mockResolvedValue(makeResult({
      result: 'broken',
      summary: '1 trade(s) entered before 09:30.',
      evidence: {
        not_before: '09:30',
        violations: [{ trade_id: 7, symbol: 'TCS', entry_clock: '09:25' }],
        checks_performed: 2,
      },
    }))
    const user = userEvent.setup()
    render(<VerifyFocusPanel />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalled())
    expect(screen.getByText('Broken')).toBeInTheDocument()
    const evidence = screen.getByLabelText('Result evidence')
    expect(evidence.textContent).toContain('TCS')
    expect(evidence.textContent).toContain('09:25')
  })

  it('manual result requires confirmation and shows neutral badge', async () => {
    setFocus(makeAction({ contract_type: 'manual_check' }))
    mocks.verifyMutate.mockResolvedValue(makeResult({
      result: 'manual',
      summary: 'Manual check — confirm whether the action was kept or broken.',
      evidence: {},
      requires_confirmation: true,
    }))
    const user = userEvent.setup()
    render(<VerifyFocusPanel />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalled())
    expect(screen.getByText('Manual review')).toBeInTheDocument()
    // Both buttons should still be available (override-style)
    expect(screen.getByRole('button', { name: /mark kept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark broken/i })).toBeInTheDocument()
  })

  it('Confirm kept calls update with status=kept', async () => {
    setFocus(makeAction({ id: 5 }))
    const user = userEvent.setup()
    render(<VerifyFocusPanel />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: /mark kept/i }))
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 5, payload: { status: 'kept' } })
  })

  it('Override → Broken calls update with status=broken (when preselected kept)', async () => {
    setFocus(makeAction({ id: 8 }))
    mocks.verifyMutate.mockResolvedValue(makeResult({ result: 'kept' }))
    const user = userEvent.setup()
    render(<VerifyFocusPanel />)
    await user.click(screen.getByRole('button', { name: /verify focus/i }))
    await waitFor(() => expect(mocks.verifyMutate).toHaveBeenCalled())
    // Button text should read "Override → Broken" since preselect was kept
    const overrideBtn = screen.getByRole('button', { name: /mark broken/i })
    expect(overrideBtn.textContent).toMatch(/override/i)
    await user.click(overrideBtn)
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled())
    expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 8, payload: { status: 'broken' } })
  })
})
