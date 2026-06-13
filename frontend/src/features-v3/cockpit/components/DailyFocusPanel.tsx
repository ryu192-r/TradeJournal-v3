import { useState } from 'react'
import { Badge, Button, EmptyState, Panel, Stack } from '@/new-ui'
import { useToastStore } from '@/store/toastStore'
import { todaySessionDate } from '@/utils/tradeDates'
import type {
  ImprovementAction,
  ImprovementActionStatus,
  ImprovementContractType,
} from '@/types/performanceOs'
import {
  useDailyFocus,
  useCreateImprovementAction,
  useUpdateImprovementAction,
  useDeleteImprovementAction,
  useSelectDailyFocus,
  useClearDailyFocus,
} from '../hooks/useImprovementActions'

const CONTRACT_OPTIONS: { value: ImprovementContractType; label: string }[] = [
  { value: 'manual_check', label: 'Manual check' },
  { value: 'no_early_entry', label: 'No early entry' },
  { value: 'max_trades', label: 'Max trades' },
  { value: 'cooldown_after_loss', label: 'Cooldown after loss' },
  { value: 'stop_not_widened', label: 'Stop not widened' },
]

const CONTRACT_LABEL: Record<ImprovementContractType, string> = {
  manual_check: 'Manual check',
  no_early_entry: 'No early entry',
  max_trades: 'Max trades',
  cooldown_after_loss: 'Cooldown after loss',
  stop_not_widened: 'Stop not widened',
}

const STATUS_VARIANT: Record<ImprovementActionStatus, 'neutral' | 'accent' | 'profit' | 'loss'> = {
  suggested: 'neutral',
  active: 'accent',
  kept: 'profit',
  broken: 'loss',
  retired: 'neutral',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-muted)',
  color: 'var(--color-text)',
  fontSize: '0.8125rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: '0.25rem',
}

interface FormState {
  title: string
  description: string
  contract_type: ImprovementContractType
}

const EMPTY_FORM: FormState = { title: '', description: '', contract_type: 'manual_check' }

function ActionForm({
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: FormState
  submitLabel: string
  pending: boolean
  onSubmit: (form: FormState) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(initial)
  const canSubmit = form.title.trim().length > 0 && !pending

  return (
    <form
      className="tjv3-daily-focus__form"
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '0.75rem',
        background: 'var(--color-surface)',
      }}
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit(form)
      }}
    >
      <Stack gap="sm">
        <label style={{ display: 'block' }}>
          <span style={labelStyle}>Behavior to change</span>
          <input
            style={inputStyle}
            autoFocus
            value={form.title}
            placeholder="e.g. Wait for the confirmation candle before entering"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={labelStyle}>Why (optional)</span>
          <textarea
            style={{ ...inputStyle, resize: 'vertical' }}
            rows={2}
            value={form.description}
            placeholder="What evidence prompted this? What should change?"
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span style={labelStyle}>Contract type</span>
          <select
            style={inputStyle}
            value={form.contract_type}
            onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value as ImprovementContractType }))}
          >
            {CONTRACT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!canSubmit}>
            {pending ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </Stack>
    </form>
  )
}

function ActionRow({
  action,
  dateStr,
  isFocus,
}: {
  action: ImprovementAction
  dateStr: string
  isFocus: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const addToast = useToastStore((s) => s.addToast)
  const updateMut = useUpdateImprovementAction()
  const deleteMut = useDeleteImprovementAction()
  const selectMut = useSelectDailyFocus()
  const clearMut = useClearDailyFocus()

  const onError = (e: unknown) =>
    addToast({ title: 'Action failed', message: e instanceof Error ? e.message : 'Please retry.', variant: 'error' })

  if (editing) {
    return (
      <ActionForm
        initial={{ title: action.title, description: action.description ?? '', contract_type: action.contract_type }}
        submitLabel="Save"
        pending={updateMut.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={(form) =>
          updateMut.mutate(
            {
              id: action.id,
              payload: {
                title: form.title.trim(),
                description: form.description.trim() || null,
                contract_type: form.contract_type,
              },
            },
            { onSuccess: () => setEditing(false), onError },
          )
        }
      />
    )
  }

  return (
    <div
      style={{
        border: isFocus ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
        borderRadius: '0.75rem',
        padding: '0.75rem',
        background: isFocus ? 'var(--color-accent-muted, var(--color-surface))' : 'var(--color-surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{action.title}</span>
            <Badge variant={STATUS_VARIANT[action.status]}>{action.status}</Badge>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-faint)' }}>{CONTRACT_LABEL[action.contract_type]}</span>
          </div>
          {action.description && (
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{action.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          {confirmDelete ? (
            <Button type="button" variant="danger" size="sm" disabled={deleteMut.isPending}
              onClick={() => deleteMut.mutate(action.id, { onError })}>
              Confirm
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>Delete</Button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
        {isFocus ? (
          <>
            <Button type="button" variant="secondary" size="sm" disabled={updateMut.isPending}
              onClick={() => updateMut.mutate({ id: action.id, payload: { status: 'kept' } }, { onError })}>
              Kept
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={updateMut.isPending}
              onClick={() => updateMut.mutate({ id: action.id, payload: { status: 'broken' } }, { onError })}>
              Broken
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={clearMut.isPending}
              onClick={() => clearMut.mutate(action.id, { onError })}>
              Clear focus
            </Button>
          </>
        ) : (
          <Button type="button" variant="primary" size="sm" disabled={selectMut.isPending}
            onClick={() => selectMut.mutate({ id: action.id, date: dateStr }, { onError })}>
            Make today's focus
          </Button>
        )}
      </div>
    </div>
  )
}

interface DailyFocusPanelProps {
  dataEnabled?: boolean
}

export function DailyFocusPanel({ dataEnabled = true }: DailyFocusPanelProps) {
  const dateStr = todaySessionDate()
  const { data, isLoading, isError } = useDailyFocus(dateStr, dataEnabled)
  const createMut = useCreateImprovementAction()
  const addToast = useToastStore((s) => s.addToast)
  const [adding, setAdding] = useState(false)

  const focus = data?.focus ?? null
  const backlog = data?.backlog ?? []

  return (
    <Panel
      title="Daily Focus Action"
      description="One evidence-backed behavior to commit to today. Other ideas stay in the backlog."
      action={
        !adding ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)} disabled={!dataEnabled}>
            Add
          </Button>
        ) : undefined
      }
    >
      <Stack gap="md">
        {!dataEnabled ? (
          <EmptyState title="Sign in to use the improvement loop" description="Daily Focus Actions load with a real account." />
        ) : isLoading ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Loading focus…</div>
        ) : isError ? (
          <EmptyState title="Couldn't load focus actions" description="Please retry in a moment." />
        ) : (
          <>
            {focus ? (
              <ActionRow action={focus} dateStr={dateStr} isFocus />
            ) : (
              <EmptyState
                title="No focus set for today"
                description="Pick one Improvement Action from the backlog, or add a new one to commit to."
              />
            )}

            <div>
              <span style={{ ...labelStyle, marginBottom: '0.5rem' }}>Improvement Backlog</span>
              <Stack gap="sm">
                {adding && (
                  <ActionForm
                    initial={EMPTY_FORM}
                    submitLabel="Create"
                    pending={createMut.isPending}
                    onCancel={() => setAdding(false)}
                    onSubmit={(form) =>
                      createMut.mutate(
                        {
                          title: form.title.trim(),
                          description: form.description.trim() || null,
                          contract_type: form.contract_type,
                        },
                        {
                          onSuccess: () => setAdding(false),
                          onError: (e) =>
                            addToast({ title: 'Create failed', message: e instanceof Error ? e.message : 'Please retry.', variant: 'error' }),
                        },
                      )
                    }
                  />
                )}
                {backlog.length === 0 && !adding ? (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-faint)' }}>
                    Backlog is empty. Add an Improvement Action to start the loop.
                  </div>
                ) : (
                  backlog.map((a) => <ActionRow key={a.id} action={a} dateStr={dateStr} isFocus={false} />)
                )}
              </Stack>
            </div>
          </>
        )}
      </Stack>
    </Panel>
  )
}
