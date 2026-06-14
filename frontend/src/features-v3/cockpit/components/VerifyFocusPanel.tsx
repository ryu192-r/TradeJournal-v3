import { useState } from 'react'
import { Badge, Button, EmptyState, Panel, Stack } from '@/new-ui'
import { useToastStore } from '@/store/toastStore'
import { todaySessionDate } from '@/utils/tradeDates'
import type { VerificationResult } from '@/types/performanceOs'
import {
  useDailyFocus,
  useUpdateImprovementAction,
  useVerifyImprovementAction,
} from '../hooks/useImprovementActions'

interface VerifyFocusPanelProps {
  dataEnabled?: boolean
}

const RESULT_LABEL: Record<string, string> = {
  kept: 'Kept',
  broken: 'Broken',
  manual: 'Manual review',
}

const RESULT_VARIANT: Record<string, 'profit' | 'loss' | 'neutral'> = {
  kept: 'profit',
  broken: 'loss',
  manual: 'neutral',
}

export function VerifyFocusPanel({ dataEnabled = true }: VerifyFocusPanelProps) {
  const addToast = useToastStore((s) => s.addToast)
  const dateStr = todaySessionDate()
  const { data } = useDailyFocus(dateStr, dataEnabled)
  const verify = useVerifyImprovementAction()
  const update = useUpdateImprovementAction()

  const [verification, setVerification] = useState<VerificationResult | null>(null)

  const focus = data?.focus ?? null

  const handleVerify = async () => {
    if (!focus) return
    try {
      const result = await verify.mutateAsync({ id: focus.id })
      setVerification(result)
    } catch (e) {
      addToast({
        title: 'Verification failed',
        message: e instanceof Error ? e.message : 'Unknown error',
        variant: 'error',
      })
    }
  }

  const handleConfirm = async (status: 'kept' | 'broken') => {
    if (!focus) return
    try {
      await update.mutateAsync({ id: focus.id, payload: { status } })
      addToast({
        title: status === 'kept' ? 'Focus kept' : 'Focus broken',
        message: focus.title,
        variant: status === 'kept' ? 'success' : 'info',
      })
      setVerification(null)
    } catch (e) {
      addToast({
        title: 'Could not save',
        message: e instanceof Error ? e.message : 'Unknown error',
        variant: 'error',
      })
    }
  }

  // Hide entire panel if no focus is set today.
  if (!dataEnabled || !focus) {
    return null
  }

  // Already finalized today — show resolved status only.
  if (focus.status === 'kept' || focus.status === 'broken') {
    return (
      <Panel title="Action Review" description="Today's focus is already finalized.">
        <Stack gap="sm">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{focus.title}</span>
            <Badge variant={focus.status === 'kept' ? 'profit' : 'loss'}>
              {focus.status === 'kept' ? 'Kept' : 'Broken'}
            </Badge>
          </div>
        </Stack>
      </Panel>
    )
  }

  return (
    <Panel
      title="Action Review"
      description="Verify today's Daily Focus against real evidence. Confirm or override the preselected result."
      action={
        verification == null ? (
          <Button
            variant="primary"
            size="sm"
            onClick={handleVerify}
            disabled={verify.isPending}
            aria-label="Verify focus"
          >
            {verify.isPending ? 'Verifying…' : 'Verify focus'}
          </Button>
        ) : undefined
      }
    >
      {verification == null ? (
        <EmptyState
          title="Not verified yet"
          description={`Click Verify focus to evaluate "${focus.title}" against today's evidence.`}
        />
      ) : (
        <Stack gap="md">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{focus.title}</span>
            <Badge variant={RESULT_VARIANT[verification.result] ?? 'neutral'}>
              {RESULT_LABEL[verification.result] ?? verification.result}
            </Badge>
          </div>

          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {verification.summary}
          </p>

          <EvidenceList evidence={verification.evidence} />

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button
              variant="ghost"
              onClick={() => handleConfirm('broken')}
              disabled={update.isPending}
              aria-label="Mark broken"
            >
              {verification.result === 'broken' ? 'Confirm broken' : 'Override → Broken'}
            </Button>
            <Button
              variant="primary"
              onClick={() => handleConfirm('kept')}
              disabled={update.isPending}
              aria-label="Mark kept"
            >
              {verification.result === 'kept' ? 'Confirm kept' : 'Override → Kept'}
            </Button>
          </div>
        </Stack>
      )}
    </Panel>
  )
}

function EvidenceList({ evidence }: { evidence: Record<string, unknown> }) {
  const violations = Array.isArray(evidence.violations) ? (evidence.violations as Record<string, unknown>[]) : []
  const trades = Array.isArray(evidence.trades) ? (evidence.trades as Record<string, unknown>[]) : []
  const checks = typeof evidence.checks_performed === 'number' ? evidence.checks_performed : null

  return (
    <div
      style={{
        padding: '0.625rem 0.75rem',
        borderRadius: '0.5rem',
        background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
        fontSize: '0.75rem',
      }}
      aria-label="Result evidence"
    >
      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>Evidence:</span>{' '}
      <span style={{ color: 'var(--color-text-muted)' }}>
        {checks != null && `${checks} check${checks === 1 ? '' : 's'} performed. `}
        {violations.length > 0 && `${violations.length} violation${violations.length === 1 ? '' : 's'}. `}
        {trades.length > 0 && `${trades.length} trade${trades.length === 1 ? '' : 's'} on session. `}
      </span>
      {violations.length > 0 && (
        <ul style={{ margin: '0.375rem 0 0', paddingLeft: '1rem', color: 'var(--color-text-muted)' }}>
          {violations.slice(0, 5).map((v, i) => (
            <li key={i}>
              {formatViolation(v)}
            </li>
          ))}
          {violations.length > 5 && <li>…and {violations.length - 5} more</li>}
        </ul>
      )}
    </div>
  )
}

function formatViolation(v: Record<string, unknown>): string {
  const symbol = typeof v.symbol === 'string' ? v.symbol : ''
  const tradeId = typeof v.trade_id === 'number' ? v.trade_id : null
  const entryClock = typeof v.entry_clock === 'string' ? v.entry_clock : null
  const gapMinutes = typeof v.gap_minutes === 'number' ? v.gap_minutes : null
  const widenedStop = typeof v.widened_stop === 'string' ? v.widened_stop : null

  const parts: string[] = []
  if (symbol) parts.push(symbol)
  if (tradeId != null) parts.push(`#${tradeId}`)
  if (entryClock) parts.push(`entered ${entryClock}`)
  if (gapMinutes != null) parts.push(`${gapMinutes}min gap`)
  if (widenedStop != null) parts.push(`stop → ${widenedStop}`)

  // Cooldown nested shape
  if (v.next_trade && typeof v.next_trade === 'object') {
    const next = v.next_trade as Record<string, unknown>
    if (next.symbol) parts.push(`next: ${next.symbol}`)
  }

  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(v)
}
