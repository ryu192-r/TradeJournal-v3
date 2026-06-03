import { Badge, EmptyState, Panel, Stack } from '@/new-ui'
import { SetupPerformancePanel } from './SetupPerformancePanel'
import { SetupTacticsPanel } from './SetupTacticsPanel'
import { SetupRulesPanel } from './SetupRulesPanel'
import { SetupTradesPanel } from './SetupTradesPanel'
import { SetupReviewInsightsPanel } from './SetupReviewInsightsPanel'
import type { PlaybookSetupEntry } from '../utils/playbookGrouping'
import { computeReviewInsights, computeSetupPerformance } from '../utils/playbookMetrics'

interface SetupDetailPanelProps {
  entry: PlaybookSetupEntry | null
  onOpenTrade: (id: number) => void
  onReviewTrade: (id: number) => void
}

function originBadge(entry: PlaybookSetupEntry) {
  if (entry.origin === 'untagged') return <Badge variant="warning">Untagged trades</Badge>
  if (entry.origin === 'trade-derived') return <Badge variant="info">Not in playbook</Badge>
  if (entry.playbook?.is_active === 'archived') return <Badge variant="neutral">Archived</Badge>
  return <Badge variant="success" dot>Active</Badge>
}

export function SetupDetailPanel({ entry, onOpenTrade, onReviewTrade }: SetupDetailPanelProps) {
  if (!entry) {
    return (
      <Panel title="Setup detail">
        <EmptyState
          title="Select a setup"
          description="Pick a setup from the library to see performance, rules, linked trades, and review insights."
        />
      </Panel>
    )
  }

  const performance = computeSetupPerformance(entry.trades)
  const insights = computeReviewInsights(entry.trades)

  return (
    <Stack gap="lg">
      <Panel
        title={entry.name}
        description={
          entry.origin === 'untagged'
            ? 'Trades with no setup tag.'
            : entry.origin === 'trade-derived'
            ? 'This setup name appears on trades but has no playbook record.'
            : 'Playbook setup with linked trades.'
        }
        action={originBadge(entry)}
      >
        <SetupPerformancePanel performance={performance} />
      </Panel>

      {entry.origin === 'playbook' && entry.playbook && (
        <SetupTacticsPanel playbook={entry.playbook} />
      )}

      <SetupRulesPanel entry={entry} />

      <SetupTradesPanel
        trades={entry.trades}
        onOpenTrade={onOpenTrade}
        onReviewTrade={onReviewTrade}
      />

      <SetupReviewInsightsPanel insights={insights} onOpenReview={onReviewTrade} />
    </Stack>
  )
}
