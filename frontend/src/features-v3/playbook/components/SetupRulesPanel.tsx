import { useEffect, useState } from 'react'
import { Button, EmptyState, Panel, Stack } from '@/new-ui'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import { useUpdateSetupMutation } from '@/hooks/useSetupPlaybookQuery'
import { useToastStore } from '@/store/toastStore'
import type { PlaybookSetupEntry } from '../utils/playbookGrouping'

interface SetupRulesPanelProps {
  entry: PlaybookSetupEntry
}

interface RulesEditorProps {
  playbook: SetupPlaybookItem
}

function RulesEditor({ playbook }: RulesEditorProps) {
  const updateMutation = useUpdateSetupMutation()
  const addToast = useToastStore((s) => s.addToast)
  const [draft, setDraft] = useState<string>((playbook.rules ?? []).join('\n'))
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft((playbook.rules ?? []).join('\n'))
    setEditing(false)
    setError(null)
  }, [playbook.id, playbook.rules])

  const rules = playbook.rules ?? []

  const handleSave = async () => {
    setError(null)
    const lines = draft
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    try {
      await updateMutation.mutateAsync({ id: playbook.id, payload: { rules: lines } })
      addToast({ title: 'Rules saved', message: `${playbook.name} rules updated.`, variant: 'success' })
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save rules.')
    }
  }

  const handleCancel = () => {
    setDraft((playbook.rules ?? []).join('\n'))
    setEditing(false)
    setError(null)
  }

  return (
    <Panel
      title="Rules / checklist"
      description="One rule per line. Backed by playbook record."
      action={
        !editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {rules.length === 0 ? 'Add rules' : 'Edit'}
          </Button>
        ) : null
      }
    >
      {editing ? (
        <Stack gap="sm">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(6, draft.split('\n').length + 1)}
            placeholder="One rule per line, e.g. Wait for breakout volume confirmation"
            aria-label="Setup rules"
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-muted)',
              color: 'var(--color-text)',
              fontSize: '0.8125rem',
              fontFamily: 'var(--tj-font-body)',
              resize: 'vertical',
            }}
          />
          {error && <span role="alert" style={{ color: 'var(--color-loss)', fontSize: '0.8125rem' }}>{error}</span>}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save rules'}
            </Button>
          </div>
        </Stack>
      ) : rules.length === 0 ? (
        <EmptyState
          title="No rules yet"
          description="Click Add rules to write the checklist for this setup."
        />
      ) : (
        <ol
          style={{
            margin: 0,
            paddingLeft: '1.5rem',
            color: 'var(--color-text)',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
          }}
        >
          {rules.map((rule, idx) => (
            <li key={idx} style={{ marginBottom: '0.375rem' }}>
              {rule}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function SetupRulesPanel({ entry }: SetupRulesPanelProps) {
  if (entry.origin === 'playbook' && entry.playbook) {
    return <RulesEditor playbook={entry.playbook} />
  }

  // Honest unsupported state — no fake rules.
  if (entry.origin === 'untagged') {
    return (
      <Panel title="Rules / checklist">
        <EmptyState
          title="Not applicable"
          description="Untagged trades have no setup definition. Tag trades with a setup name to create rules."
        />
      </Panel>
    )
  }

  return (
    <Panel title="Rules / checklist">
      <EmptyState
        title="No playbook record"
        description={`"${entry.name}" appears on trades but has no playbook entry. Create a playbook record (via legacy playbook page) to add rules.`}
      />
    </Panel>
  )
}
