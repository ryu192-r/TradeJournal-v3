import { useEffect, useState } from 'react'
import { Badge, Button, DataList, DataRow, MoneyValue, Panel, RMultipleValue, Stack, Value } from '@/new-ui'
import type { ApiTrade, EntryContext } from '@/types'
import { useReviewTradeMutation } from '@/hooks/useReviewTradeMutation'
import { useToastStore } from '@/store/toastStore'
import {
  formatTradePrice, formatTradeQuantity, getCurrentStop, getOriginalStop,
  getTradeDirection, getTradeSessionDateSafe, getTradeSetup,
} from '../../trades/utils/tradesV3Formatters'
import { getTradeGrossPnl, getTradeRMultiple } from '../../trades/utils/tradesV3Metrics'
import { getReviewStatus, getReviewStatusLabel } from '../utils/reviewStatus'
import { FormTextarea, FormInput } from '../../trade-form/components/FormControls'

interface ReviewWorkspaceProps {
  trade: ApiTrade
  onReviewed?: () => void
  onOpenDetail?: (id: number) => void
}

export function ReviewWorkspace({ trade, onReviewed, onOpenDetail }: ReviewWorkspaceProps) {
  const addToast = useToastStore((s) => s.addToast)
  const mutation = useReviewTradeMutation()
  const [notes, setNotes] = useState(trade.review_notes ?? '')
  const [tags, setTags] = useState((trade.review_tags ?? []).join(', '))
  const [entryContext, setEntryContext] = useState<EntryContext | null>(trade.entry_context ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setNotes(trade.review_notes ?? '')
    setTags((trade.review_tags ?? []).join(', '))
    setEntryContext(trade.entry_context ?? null)
    setError(null)
  }, [trade.id, trade.review_notes, trade.review_tags, trade.entry_context])

  const status = getReviewStatus(trade)

  const handleSave = async () => {
    setError(null)
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
    try {
      await mutation.mutateAsync({ id: trade.id, payload: { review_notes: notes.trim() || null, review_tags: tagList, entry_context: entryContext } })
      addToast({ title: 'Review saved', message: `${trade.symbol} reviewed.`, variant: 'success' })
      onReviewed?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save review.')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--tj-space-section)', gridTemplateColumns: 'minmax(0,1fr)' }}>
      <Panel
        title={`${trade.symbol} review`}
        description="Capture what happened, mistakes, and lessons."
        action={<Badge variant={status === 'reviewed' ? 'success' : 'warning'}>{getReviewStatusLabel(status)}</Badge>}
      >
        <Stack gap="md">
          <EntryContextSelector value={entryContext} onChange={setEntryContext} />
          <FormTextarea
            label="Review notes"
            rows={6}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What went well? What went wrong? What is the lesson?"
          />
          <FormInput
            label="Review tags (comma-separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. chased entry, good exit, broke rule"
            help="Tag mistakes or lessons for later analysis."
          />
          {error && <span style={{ color: 'var(--color-loss)', fontSize: '0.8125rem' }} role="alert">{error}</span>}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {onOpenDetail && (
              <Button variant="ghost" onClick={() => onOpenDetail(trade.id)}>View trade detail</Button>
            )}
            <Button variant="primary" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : status === 'reviewed' ? 'Update review' : 'Save review'}
            </Button>
          </div>
        </Stack>
      </Panel>

      <Panel title="Trade context" description="Read-only. Original SL and current protection SL are distinct.">
        <DataList>
          <DataRow title="Direction" trailing={<Value value={getTradeDirection(trade)} />} />
          <DataRow title="Session date" trailing={<Value value={getTradeSessionDateSafe(trade)} />} />
          <DataRow title="Entry" trailing={<Value value={formatTradePrice(trade.entry_price)} />} />
          <DataRow title="Exit" trailing={<Value value={formatTradePrice(trade.weighted_avg_exit_price ?? trade.exit_price)} />} />
          <DataRow title="Quantity" trailing={<Value value={formatTradeQuantity(trade.quantity)} />} />
          <DataRow title="Original SL" trailing={<Value value={formatTradePrice(getOriginalStop(trade), 'Not set')} />} />
          <DataRow title="Current protection SL" trailing={<Value value={formatTradePrice(getCurrentStop(trade), 'No SL')} />} />
          <DataRow title="Gross P&L" subtitle="Pre daily charges" trailing={<MoneyValue value={getTradeGrossPnl(trade)} tone="auto" />} />
          <DataRow title="R multiple" trailing={<RMultipleValue value={getTradeRMultiple(trade)} tone="auto" />} />
          <DataRow title="Setup" trailing={<Value value={getTradeSetup(trade)} />} />
          <DataRow title="Mood / emotion" trailing={<Value value="Not set" />} />
          <DataRow title="Execution grade" trailing={<Value value="Not set" />} />
        </DataList>
      </Panel>
    </div>
  )
}

const ENTRY_CONTEXT_OPTIONS: { value: EntryContext; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'opportunistic_valid', label: 'Opportunistic (valid)' },
  { value: 'impulse', label: 'Impulse' },
  { value: 'unclear', label: 'Unclear' },
]

function EntryContextSelector({ value, onChange }: { value: EntryContext | null; onChange: (v: EntryContext | null) => void }) {
  return (
    <div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.375rem' }}>
        Entry context {value == null && <span style={{ color: 'var(--color-warning)' }}>— needs classification</span>}
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
        {ENTRY_CONTEXT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(value === opt.value ? null : opt.value)}
            aria-pressed={value === opt.value}
            style={{
              padding: '0.3rem 0.625rem',
              borderRadius: '0.5rem',
              border: `1px solid ${value === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: value === opt.value ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
              color: value === opt.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
