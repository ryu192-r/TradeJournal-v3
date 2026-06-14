import { Badge, Button, Panel, Stack } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import { todaySessionDate } from '@/utils/tradeDates'
import { useDailyFocus } from '../hooks/useImprovementActions'
import type { ImprovementContractType } from '@/types/performanceOs'

const CONTRACT_LABEL: Record<ImprovementContractType, string> = {
  manual_check: 'Manual check',
  no_early_entry: 'No early entry',
  max_trades: 'Max trades',
  cooldown_after_loss: 'Cooldown after loss',
  stop_not_widened: 'Stop not widened',
}

interface TodaysFocusCardProps {
  dataEnabled?: boolean
}

/**
 * Compact Today's Focus card for the Cockpit (issue #73).
 *
 * Read-only summary that defers to the Improvement page for full detail
 * and management. Clicking either header or empty-state CTA navigates
 * to the Improvement view.
 */
export function TodaysFocusCard({ dataEnabled = true }: TodaysFocusCardProps) {
  const setActiveView = useAppStore((s) => s.setActiveView)
  const { data, isLoading } = useDailyFocus(todaySessionDate(), dataEnabled)
  const focus = data?.focus ?? null

  const goToImprovement = () => setActiveView('improvement')

  if (!dataEnabled) {
    return (
      <Panel
        title="Today's Focus"
        description="Sign in to load the Daily Focus."
      >
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Daily Focus loads with a real account.
        </span>
      </Panel>
    )
  }

  if (isLoading) {
    return (
      <Panel title="Today's Focus" description="Today's commitment.">
        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>Loading…</span>
      </Panel>
    )
  }

  if (!focus) {
    return (
      <Panel
        title="Today's Focus"
        description="No Daily Focus selected for this session."
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={goToImprovement}
            aria-label="Open Improvement page"
          >
            Open Improvement →
          </Button>
        }
      >
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
          Pick or create one Improvement Action and set it as today's focus.
        </p>
      </Panel>
    )
  }

  const statusBadge = (() => {
    if (focus.status === 'kept') return <Badge variant="profit">Kept</Badge>
    if (focus.status === 'broken') return <Badge variant="loss">Broken</Badge>
    return <Badge variant="accent">Pending verification</Badge>
  })()

  return (
    <Panel
      title="Today's Focus"
      description="One behavior contract committed for this session."
      action={
        <Button
          variant="ghost"
          size="sm"
          onClick={goToImprovement}
          aria-label="Open Improvement page"
        >
          Open Improvement →
        </Button>
      }
    >
      <Stack gap="sm">
        <button
          type="button"
          onClick={goToImprovement}
          aria-label="Go to Improvement page"
          style={{
            textAlign: 'left',
            width: '100%',
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '0.9375rem' }}>
            {focus.title}
          </div>
        </button>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {statusBadge}
          <Badge variant="neutral">{CONTRACT_LABEL[focus.contract_type]}</Badge>
        </div>
        {focus.description && (
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
            {focus.description}
          </p>
        )}
      </Stack>
    </Panel>
  )
}
