import { useState } from 'react'
import { Badge, Button, EmptyState, Panel, Stack } from '@/new-ui'
import { useToastStore } from '@/store/toastStore'
import type {
  ImprovementAction,
  ImprovementActionStatus,
  ImprovementContractType,
} from '@/types/performanceOs'
import {
  useImprovementActions,
  useGenerateSuggestions,
  useUpdateImprovementAction,
} from '../hooks/useImprovementActions'

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

interface SuggestionsPanelProps {
  dataEnabled?: boolean
}

export function SuggestionsPanel({ dataEnabled = true }: SuggestionsPanelProps) {
  const addToast = useToastStore((s) => s.addToast)
  const { data: actions = [], isLoading } = useImprovementActions('suggested', dataEnabled)
  const generate = useGenerateSuggestions()
  const update = useUpdateImprovementAction()

  const handleGenerate = async () => {
    try {
      const created = await generate.mutateAsync(30)
      addToast({
        title: created.length === 0 ? 'No new suggestions' : `${created.length} suggestion${created.length === 1 ? '' : 's'} generated`,
        message: created.length === 0
          ? 'No new patterns detected in the last 30 days.'
          : 'Review the suggested actions below and approve, edit, or retire each.',
        variant: created.length === 0 ? 'info' : 'success',
      })
    } catch (err) {
      addToast({
        title: 'Could not generate suggestions',
        message: err instanceof Error ? err.message : 'Unknown error',
        variant: 'error',
      })
    }
  }

  return (
    <Panel
      title="Suggested Improvement Actions"
      description="Generated from journal rule violations and weak execution grades. Approve, edit, or retire each suggestion."
      action={
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={generate.isPending || !dataEnabled}
          aria-label="Generate suggestions"
        >
          {generate.isPending ? 'Scanning…' : 'Generate suggestions'}
        </Button>
      }
    >
      {isLoading ? (
        <Stack gap="sm">
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Loading…</span>
        </Stack>
      ) : actions.length === 0 ? (
        <EmptyState
          title="No suggested actions"
          description="Click Generate suggestions to scan recent journal entries and execution grades."
        />
      ) : (
        <Stack gap="sm">
          {actions.map((a) => (
            <SuggestionRow
              key={a.id}
              action={a}
              onApprove={async () => {
                await update.mutateAsync({ id: a.id, payload: { status: 'active' } })
                addToast({ title: 'Suggestion approved', message: a.title, variant: 'success' })
              }}
              onRetire={async () => {
                await update.mutateAsync({ id: a.id, payload: { status: 'retired' } })
                addToast({ title: 'Suggestion retired', message: a.title, variant: 'info' })
              }}
              onEdit={async (title, description) => {
                await update.mutateAsync({ id: a.id, payload: { title, description } })
                addToast({ title: 'Suggestion updated', message: title, variant: 'success' })
              }}
              busy={update.isPending}
            />
          ))}
        </Stack>
      )}
    </Panel>
  )
}

interface SuggestionRowProps {
  action: ImprovementAction
  onApprove: () => void | Promise<void>
  onRetire: () => void | Promise<void>
  onEdit: (title: string, description: string | null) => void | Promise<void>
  busy?: boolean
}

function SuggestionRow({ action, onApprove, onRetire, onEdit, busy }: SuggestionRowProps) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(action.title)
  const [description, setDescription] = useState(action.description ?? '')

  const evidence = action.source_evidence as
    | { type?: string; kind?: string; occurrences?: number; window_days?: number; evidence_refs?: unknown[] }
    | null

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: '0.625rem',
        padding: '0.75rem',
        background: 'var(--color-bg-muted)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ ...inputStyle, fontWeight: 600 }}
              aria-label="Edit suggestion title"
            />
          ) : (
            <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.875rem' }}>
              {action.title}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
            <Badge variant={STATUS_VARIANT[action.status]}>{action.status}</Badge>
            <Badge variant="neutral">{CONTRACT_LABEL[action.contract_type]}</Badge>
          </div>
        </div>
      </div>

      {editing ? (
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ ...inputStyle, marginTop: '0.5rem', fontFamily: 'inherit', resize: 'vertical' }}
          aria-label="Edit suggestion description"
          placeholder="Describe the behavior commitment…"
        />
      ) : (
        action.description && (
          <p style={{ margin: '0.5rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {action.description}
          </p>
        )
      )}

      {evidence && evidence.occurrences != null && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 0.625rem',
            background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
          }}
          aria-label="Source evidence"
        >
          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Evidence:</span>{' '}
          {evidence.occurrences} {evidence.kind ?? evidence.type ?? 'pattern'} occurrence{evidence.occurrences === 1 ? '' : 's'}
          {evidence.window_days ? ` in last ${evidence.window_days} days` : ''}
          {evidence.evidence_refs?.length ? ` · ${evidence.evidence_refs.length} record${evidence.evidence_refs.length === 1 ? '' : 's'}` : ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.625rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {editing ? (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false)
                setTitle(action.title)
                setDescription(action.description ?? '')
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                await onEdit(title.trim(), description.trim() || null)
                setEditing(false)
              }}
              disabled={busy || !title.trim()}
            >
              Save
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onRetire} disabled={busy} aria-label="Retire suggestion">
              Retire
            </Button>
            <Button variant="ghost" onClick={() => setEditing(true)} disabled={busy} aria-label="Edit suggestion">
              Edit
            </Button>
            <Button variant="primary" onClick={onApprove} disabled={busy} aria-label="Approve suggestion">
              Approve
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
