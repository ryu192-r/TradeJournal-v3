import { useEffect, useState } from 'react'
import { Button, Drawer, Stack } from '@/new-ui'
import { useCreateSetupMutation, useUpdateSetupMutation } from '@/hooks/useSetupPlaybookQuery'
import { useToastStore } from '@/store/toastStore'
import type { SetupPlaybookItem, Tactic } from '@/types/setupPlaybook'

interface SetupFormDrawerProps {
  open: boolean
  onClose: () => void
  /** When provided, drawer edits this setup; otherwise it creates a new one. */
  setup?: SetupPlaybookItem | null
}

interface FormState {
  name: string
  description: string
  rules: string
  idealConditions: string
  maxRiskPct: string
  positionSizingRule: string
  stopStyle: string
  tactics: string
}

const EMPTY: FormState = {
  name: '',
  description: '',
  rules: '',
  idealConditions: '',
  maxRiskPct: '',
  positionSizingRule: '',
  stopStyle: '',
  tactics: '',
}

function fromSetup(s: SetupPlaybookItem): FormState {
  return {
    name: s.name,
    description: s.description ?? '',
    rules: (s.rules ?? []).join('\n'),
    idealConditions: (s.ideal_conditions ?? []).join('\n'),
    maxRiskPct: s.risk_profile?.max_risk_pct != null ? String(s.risk_profile.max_risk_pct) : '',
    positionSizingRule: s.risk_profile?.position_sizing_rule ?? '',
    stopStyle: s.risk_profile?.stop_style ?? '',
    // Tactics: one per line as "name | condition1; condition2"
    tactics: (s.tactics ?? [])
      .map((t) => `${t.name}${t.conditions.length ? ' | ' + t.conditions.join('; ') : ''}`)
      .join('\n'),
  }
}

function toLines(value: string): string[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean)
}

function parseTactics(value: string): Tactic[] {
  return toLines(value).map((line) => {
    const [name, conditionsRaw] = line.split('|')
    return {
      name: (name ?? '').trim(),
      conditions: (conditionsRaw ?? '')
        .split(';')
        .map((c) => c.trim())
        .filter(Boolean),
    }
  }).filter((t) => t.name.length > 0)
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

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--color-text-faint)', marginTop: '0.25rem' }}>{hint}</span>}
    </label>
  )
}

export function SetupFormDrawer({ open, onClose, setup }: SetupFormDrawerProps) {
  const isEdit = setup != null
  const createMut = useCreateSetupMutation()
  const updateMut = useUpdateSetupMutation()
  const addToast = useToastStore((s) => s.addToast)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(setup ? fromSetup(setup) : EMPTY)
    setError(null)
  }, [open, setup])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const isSaving = createMut.isPending || updateMut.isPending

  const handleSave = async () => {
    setError(null)
    const name = form.name.trim()
    if (!name) {
      setError('Name is required.')
      return
    }
    const riskProfile = {
      max_risk_pct: form.maxRiskPct.trim() ? Number(form.maxRiskPct) : null,
      position_sizing_rule: form.positionSizingRule.trim() || null,
      stop_style: form.stopStyle.trim() || null,
    }
    const payload = {
      name,
      description: form.description.trim() || null,
      rules: toLines(form.rules),
      ideal_conditions: toLines(form.idealConditions),
      risk_profile: riskProfile,
      tactics: parseTactics(form.tactics),
    }
    try {
      if (isEdit && setup) {
        await updateMut.mutateAsync({ id: setup.id, payload })
        addToast({ title: 'Setup updated', message: `${name} saved.`, variant: 'success' })
      } else {
        await createMut.mutateAsync(payload)
        addToast({ title: 'Setup created', message: `${name} added to playbook.`, variant: 'success' })
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${setup?.name}` : 'New setup'}
      description={isEdit ? 'Update playbook setup details.' : 'Add a new setup to your playbook.'}
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Create setup'}
          </Button>
        </div>
      }
    >
      <Stack gap="md">
        {error && (
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: 'var(--color-loss-muted)', color: 'var(--color-loss)', fontSize: '0.75rem' }}>
            {error}
          </div>
        )}
        <Field label="Name">
          <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Breakout" />
        </Field>
        <Field label="Description">
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Rules" hint="One rule per line.">
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} value={form.rules} onChange={(e) => set('rules', e.target.value)} />
        </Field>
        <Field label="Ideal conditions" hint="One condition per line.">
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.idealConditions} onChange={(e) => set('idealConditions', e.target.value)} />
        </Field>
        <Field label="Tactics" hint="One per line: name | condition1; condition2">
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={form.tactics} onChange={(e) => set('tactics', e.target.value)} />
        </Field>
        <Field label="Max risk %">
          <input style={inputStyle} type="number" step="0.1" value={form.maxRiskPct} onChange={(e) => set('maxRiskPct', e.target.value)} placeholder="e.g. 1.0" />
        </Field>
        <Field label="Position sizing rule">
          <input style={inputStyle} value={form.positionSizingRule} onChange={(e) => set('positionSizingRule', e.target.value)} placeholder="e.g. Risk-based, 1R = 1% equity" />
        </Field>
        <Field label="Stop style">
          <input style={inputStyle} value={form.stopStyle} onChange={(e) => set('stopStyle', e.target.value)} placeholder="e.g. Below structure low" />
        </Field>
      </Stack>
    </Drawer>
  )
}
