import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, EmptyState, Page, Panel, Stack } from '@/new-ui'
import { useToastStore } from '@/store/toastStore'
import { todaySessionDate } from '@/utils/tradeDates'
import {
  useJournalQuery,
  useCreateJournalMutation,
  useUpdateJournalMutation,
} from '@/hooks/useJournalMutation'
import {
  useDailyFocus,
  useImprovementActions,
  useUpdateImprovementAction,
  useSelectDailyFocus,
  useVerifyImprovementAction,
  useCreateImprovementAction,
} from '@/features-v3/cockpit/hooks/useImprovementActions'
import type {
  ImprovementAction,
  ImprovementContractType,
  VerificationResult,
} from '@/types/performanceOs'
import { realityCheck } from './utils/realityCheck'

interface ImprovementV3PageProps {
  dataEnabled?: boolean
}

const CONTRACT_LABEL: Record<ImprovementContractType, string> = {
  manual_check: 'Manual check',
  no_early_entry: 'No early entry',
  max_trades: 'Max trades',
  cooldown_after_loss: 'Cooldown after loss',
  stop_not_widened: 'Stop not widened',
}

const CONTRACT_OPTIONS: { value: ImprovementContractType; label: string }[] = [
  { value: 'manual_check', label: 'Manual check' },
  { value: 'no_early_entry', label: 'No early entry' },
  { value: 'max_trades', label: 'Max trades' },
  { value: 'cooldown_after_loss', label: 'Cooldown after loss' },
  { value: 'stop_not_widened', label: 'Stop not widened' },
]

export function ImprovementV3Page({ dataEnabled = true }: ImprovementV3PageProps) {
  const today = todaySessionDate()
  const focus = useDailyFocus(today, dataEnabled)
  const focusAction = focus.data?.focus ?? null

  return (
    <Page
      title="Improvement"
      subtitle="Truth Reflection: Lesson → Evidence → Improvement Action → Action Review."
    >
      <Stack gap="lg">
        <NowZone today={today} focus={focusAction} />
        <FocusZone focus={focusAction} dataEnabled={dataEnabled} />
        <NextMoveZone today={today} dataEnabled={dataEnabled} focus={focusAction} />
        <BacklogZone dataEnabled={dataEnabled} todayDate={today} focusId={focusAction?.id ?? null} />
      </Stack>
    </Page>
  )
}

// ───────────────────────── Now ─────────────────────────

function NowZone({ today, focus }: { today: string; focus: ImprovementAction | null }) {
  let chip: { label: string; variant: 'profit' | 'loss' | 'accent' | 'neutral' }
  if (!focus) chip = { label: 'No focus set', variant: 'neutral' }
  else if (focus.status === 'kept') chip = { label: 'Kept', variant: 'profit' }
  else if (focus.status === 'broken') chip = { label: 'Broken', variant: 'loss' }
  else chip = { label: 'Pending verification', variant: 'accent' }

  return (
    <Panel
      title="Now"
      description="Today's session at a glance."
      action={<Badge variant={chip.variant}>{chip.label}</Badge>}
    >
      <Stack gap="sm">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: 'var(--color-text)' }}>
          <span style={{ fontWeight: 600 }}>Session:</span>
          <span style={{ color: 'var(--color-text-muted)' }}>{today}</span>
        </div>
        {focus ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
            Daily Focus: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{focus.title}</span>{' '}
            <Badge variant="neutral">{CONTRACT_LABEL[focus.contract_type]}</Badge>
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
            No Daily Focus selected. Choose one in the Backlog zone or in the Cockpit.
          </div>
        )}
      </Stack>
    </Panel>
  )
}

// ───────────────────────── Focus ─────────────────────────

function FocusZone({ focus, dataEnabled }: { focus: ImprovementAction | null; dataEnabled: boolean }) {
  const addToast = useToastStore((s) => s.addToast)
  const verify = useVerifyImprovementAction()
  const update = useUpdateImprovementAction()
  const [verification, setVerification] = useState<VerificationResult | null>(null)

  // Reset verification state when focus changes
  useEffect(() => {
    setVerification(null)
  }, [focus?.id])

  if (!dataEnabled) {
    return (
      <Panel title="Focus" description="Today's commitment.">
        <EmptyState title="Sign in required" description="Daily Focus loads with a real account." />
      </Panel>
    )
  }
  if (!focus) {
    return (
      <Panel title="Focus" description="Today's commitment.">
        <EmptyState
          title="No Daily Focus"
          description="Pick one Improvement Action from the Backlog zone below. The chosen action becomes today's measurable behavior contract."
        />
      </Panel>
    )
  }

  const isResolved = focus.status === 'kept' || focus.status === 'broken'
  const evidence = focus.source_evidence as
    | { kind?: string; occurrences?: number; window_days?: number; evidence_refs?: unknown[] }
    | null

  const handleVerify = async () => {
    try {
      const r = await verify.mutateAsync({ id: focus.id })
      setVerification(r)
    } catch (e) {
      addToast({ title: 'Verification failed', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }

  const handleConfirm = async (status: 'kept' | 'broken') => {
    try {
      await update.mutateAsync({ id: focus.id, payload: { status } })
      addToast({
        title: status === 'kept' ? 'Focus kept' : 'Focus broken',
        message: focus.title,
        variant: status === 'kept' ? 'success' : 'info',
      })
      setVerification(null)
    } catch (e) {
      addToast({ title: 'Could not save', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }

  return (
    <Panel
      title="Focus"
      description="The single behavior contract you committed to today."
      action={
        !isResolved && verification == null ? (
          <Button variant="primary" size="sm" onClick={handleVerify} disabled={verify.isPending}>
            {verify.isPending ? 'Verifying…' : 'Verify focus'}
          </Button>
        ) : isResolved ? (
          <Badge variant={focus.status === 'kept' ? 'profit' : 'loss'}>
            {focus.status === 'kept' ? 'Kept' : 'Broken'}
          </Badge>
        ) : undefined
      }
    >
      <Stack gap="md">
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{focus.title}</div>
          {focus.description && (
            <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {focus.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <Badge variant="neutral">{CONTRACT_LABEL[focus.contract_type]}</Badge>
            {focus.due_session && (
              <Badge variant="neutral">Due {focus.due_session}</Badge>
            )}
          </div>
        </div>

        {evidence && (evidence.occurrences != null || evidence.kind) && (
          <div
            style={{
              padding: '0.5rem 0.625rem',
              borderRadius: '0.5rem',
              background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
            }}
            aria-label="Source evidence"
          >
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Source evidence:</span>{' '}
            {evidence.occurrences != null && `${evidence.occurrences} occurrence${evidence.occurrences === 1 ? '' : 's'}`}
            {evidence.kind ? ` · ${evidence.kind}` : ''}
            {evidence.window_days ? ` · last ${evidence.window_days} days` : ''}
            {evidence.evidence_refs?.length ? ` · ${evidence.evidence_refs.length} record${evidence.evidence_refs.length === 1 ? '' : 's'}` : ''}
          </div>
        )}

        {verification != null && !isResolved && (
          <Stack gap="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Preselected:</span>
              <Badge variant={verification.result === 'kept' ? 'profit' : verification.result === 'broken' ? 'loss' : 'neutral'}>
                {verification.result === 'manual' ? 'Manual review' : verification.result === 'kept' ? 'Kept' : 'Broken'}
              </Badge>
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {verification.summary}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => handleConfirm('broken')} disabled={update.isPending} aria-label="Mark broken">
                {verification.result === 'broken' ? 'Confirm broken' : 'Override → Broken'}
              </Button>
              <Button variant="primary" onClick={() => handleConfirm('kept')} disabled={update.isPending} aria-label="Mark kept">
                {verification.result === 'kept' ? 'Confirm kept' : 'Override → Kept'}
              </Button>
            </div>
          </Stack>
        )}
      </Stack>
    </Panel>
  )
}

// ───────────────────────── Next Move ─────────────────────────

function NextMoveZone({
  today,
  dataEnabled,
  focus,
}: {
  today: string
  dataEnabled: boolean
  focus: ImprovementAction | null
}) {
  const addToast = useToastStore((s) => s.addToast)
  const journalQuery = useJournalQuery(dataEnabled ? today : '')
  const createJournal = useCreateJournalMutation()
  const updateJournal = useUpdateJournalMutation()
  const createAction = useCreateImprovementAction()

  const [lesson, setLesson] = useState('')
  const [actionTitle, setActionTitle] = useState('')
  const [actionContract, setActionContract] = useState<ImprovementContractType>('manual_check')

  // Sync from server data
  useEffect(() => {
    setLesson(journalQuery.data?.lessons_learned ?? '')
  }, [journalQuery.data?.lessons_learned])

  const check = useMemo(() => realityCheck(lesson), [lesson])

  if (!dataEnabled) {
    return (
      <Panel title="Next Move" description="End-of-day reflection.">
        <EmptyState title="Sign in required" description="Lesson capture and Improvement Action creation need a real account." />
      </Panel>
    )
  }

  const handleSaveLesson = async () => {
    const trimmed = lesson.trim()
    try {
      const existing = journalQuery.data
      if (existing) {
        await updateJournal.mutateAsync({ date: today, payload: { date: today, lessons_learned: trimmed || null } })
      } else {
        await createJournal.mutateAsync({ date: today, lessons_learned: trimmed || null })
      }
      addToast({ title: 'Lesson saved', message: 'Stored in today\'s journal.', variant: 'success' })
    } catch (e) {
      addToast({ title: 'Could not save lesson', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }

  const handleCreateAction = async () => {
    const title = actionTitle.trim()
    if (!title) return
    try {
      await createAction.mutateAsync({
        title,
        description: lesson.trim() || null,
        contract_type: actionContract,
      })
      addToast({ title: 'Improvement Action created', message: title, variant: 'success' })
      setActionTitle('')
    } catch (e) {
      addToast({ title: 'Could not create action', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }

  return (
    <Panel title="Next Move" description="End-of-day flow: separate lesson from commitment.">
      <Stack gap="md">
        {/* Step 1: Evidence-Backed Lesson */}
        <Stack gap="sm">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.8125rem' }}>
              Step 1 · Evidence-Backed Lesson
            </span>
            {lesson.trim().length > 0 && (
              check.hasEvidence ? (
                <Badge variant="profit">Evidence cited</Badge>
              ) : (
                <Badge variant="warning">No evidence cited</Badge>
              )
            )}
          </div>
          <textarea
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
            rows={4}
            aria-label="Evidence-backed lesson"
            placeholder="What did you learn today? Cite a trade ID, journal date, or specific evidence (stop, entry, mood, grade…)."
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-muted)',
              color: 'var(--color-text)',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          {!check.hasEvidence && lesson.trim().length > 0 && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                padding: '0.375rem 0.625rem',
                borderRadius: '0.375rem',
                background: 'color-mix(in srgb, var(--color-warning, orange) 8%, transparent)',
              }}
              role="status"
            >
              Reality Check: this lesson does not reference a trade, journal date, or evidence keyword.
              Strengthen it before turning it into an action — or open the Journal to log evidence first.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveLesson}
              disabled={createJournal.isPending || updateJournal.isPending}
              aria-label="Save lesson"
            >
              {createJournal.isPending || updateJournal.isPending ? 'Saving…' : 'Save lesson'}
            </Button>
          </div>
        </Stack>

        {/* Step 2: Convert to Improvement Action */}
        <Stack gap="sm">
          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.8125rem' }}>
            Step 2 · Turn into Improvement Action
          </span>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
            A lesson is a finding. An Improvement Action is a measurable behavior commitment for tomorrow.
            {focus && ' Today already has a focus — this will land in the Backlog.'}
          </p>
          <input
            type="text"
            value={actionTitle}
            onChange={(e) => setActionTitle(e.target.value)}
            placeholder="Action title (e.g., Wait for confirmation candle before entry)"
            aria-label="Improvement action title"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-muted)',
              color: 'var(--color-text)',
              fontSize: '0.8125rem',
            }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Contract:</span>
            <select
              value={actionContract}
              onChange={(e) => setActionContract(e.target.value as ImprovementContractType)}
              aria-label="Contract type"
              style={{
                padding: '0.375rem 0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-muted)',
                color: 'var(--color-text)',
                fontSize: '0.75rem',
              }}
            >
              {CONTRACT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateAction}
                disabled={createAction.isPending || !actionTitle.trim()}
                aria-label="Create improvement action"
              >
                {createAction.isPending ? 'Creating…' : 'Create action'}
              </Button>
            </div>
          </div>
        </Stack>
      </Stack>
    </Panel>
  )
}

// ───────────────────────── Backlog ─────────────────────────

function BacklogZone({
  dataEnabled,
  todayDate,
  focusId,
}: {
  dataEnabled: boolean
  todayDate: string
  focusId: number | null
}) {
  const addToast = useToastStore((s) => s.addToast)
  const suggested = useImprovementActions('suggested', dataEnabled)
  const active = useImprovementActions('active', dataEnabled)
  const update = useUpdateImprovementAction()
  const selectFocus = useSelectDailyFocus()
  const items = useMemoMerge(suggested.data, active.data, focusId)

  if (!dataEnabled) {
    return (
      <Panel title="Backlog" description="Suggested + active actions waiting for commitment.">
        <EmptyState title="Sign in required" description="Backlog loads with a real account." />
      </Panel>
    )
  }

  const isLoading = suggested.isLoading || active.isLoading

  const handleApprove = async (a: ImprovementAction) => {
    try {
      await update.mutateAsync({ id: a.id, payload: { status: 'active' } })
      addToast({ title: 'Approved', message: a.title, variant: 'success' })
    } catch (e) {
      addToast({ title: 'Could not approve', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }
  const handleSelectFocus = async (a: ImprovementAction) => {
    try {
      await selectFocus.mutateAsync({ id: a.id, date: todayDate })
      addToast({ title: 'Set as Daily Focus', message: a.title, variant: 'success' })
    } catch (e) {
      addToast({ title: 'Could not set focus', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }
  const handleRetire = async (a: ImprovementAction) => {
    try {
      await update.mutateAsync({ id: a.id, payload: { status: 'retired' } })
      addToast({ title: 'Retired', message: a.title, variant: 'info' })
    } catch (e) {
      addToast({ title: 'Could not retire', message: e instanceof Error ? e.message : 'Unknown', variant: 'error' })
    }
  }

  return (
    <Panel title="Backlog" description="Suggested + active actions not focused. Approve, set as focus, or retire.">
      {isLoading ? (
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Loading…</span>
      ) : items.length === 0 ? (
        <EmptyState
          title="Backlog is empty"
          description="Generate suggestions in the Cockpit, or use Step 2 above to create your first Improvement Action."
        />
      ) : (
        <Stack gap="sm">
          {items.map((a) => (
            <BacklogRow
              key={a.id}
              action={a}
              busy={update.isPending || selectFocus.isPending}
              onApprove={() => handleApprove(a)}
              onSelectFocus={() => handleSelectFocus(a)}
              onRetire={() => handleRetire(a)}
            />
          ))}
        </Stack>
      )}
    </Panel>
  )
}

function useMemoMerge(
  suggested: ImprovementAction[] | undefined,
  active: ImprovementAction[] | undefined,
  focusId: number | null,
) {
  return useMemo(() => {
    const all = [...(suggested ?? []), ...(active ?? [])]
    return all.filter((a) => a.id !== focusId && a.status !== 'retired')
  }, [suggested, active, focusId])
}

function BacklogRow({
  action,
  busy,
  onApprove,
  onSelectFocus,
  onRetire,
}: {
  action: ImprovementAction
  busy: boolean
  onApprove: () => void
  onSelectFocus: () => void
  onRetire: () => void
}) {
  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: '0.625rem',
        padding: '0.625rem 0.75rem',
        background: 'var(--color-bg-muted)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
            {action.title}
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <Badge variant={action.status === 'active' ? 'accent' : 'neutral'}>{action.status}</Badge>
            <Badge variant="neutral">{CONTRACT_LABEL[action.contract_type]}</Badge>
          </div>
          {action.description && (
            <p style={{ margin: '0.375rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.75rem', lineHeight: 1.4 }}>
              {action.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {action.status === 'suggested' && (
            <Button variant="ghost" size="sm" onClick={onApprove} disabled={busy} aria-label="Approve">
              Approve
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onRetire} disabled={busy} aria-label="Retire">
            Retire
          </Button>
          <Button variant="primary" size="sm" onClick={onSelectFocus} disabled={busy} aria-label="Set as focus">
            Set as Focus
          </Button>
        </div>
      </div>
    </div>
  )
}
