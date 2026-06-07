import { useState } from 'react'
import { Badge, Button, Cluster, EmptyState, Panel, Stack } from '@/new-ui'
import { Pencil, Archive, ArchiveRestore } from 'lucide-react'
import { useUpdateSetupMutation, useArchiveSetupMutation } from '@/hooks/useSetupPlaybookQuery'
import { useToastStore } from '@/store/toastStore'
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
  onEditSetup?: (entry: PlaybookSetupEntry) => void
}

function originBadge(entry: PlaybookSetupEntry) {
  if (entry.origin === 'untagged') return <Badge variant="warning">Untagged trades</Badge>
  if (entry.origin === 'trade-derived') return <Badge variant="info">Not in playbook</Badge>
  if (entry.playbook?.is_active === 'archived') return <Badge variant="neutral">Archived</Badge>
  return <Badge variant="success" dot>Active</Badge>
}

function SetupActions({ entry }: { entry: PlaybookSetupEntry }) {
  const updateMut = useUpdateSetupMutation()
  const archiveMut = useArchiveSetupMutation()
  const addToast = useToastStore((s) => s.addToast)
  const [confirmArchive, setConfirmArchive] = useState(false)

  if (entry.origin !== 'playbook' || !entry.playbook) return null
  const isArchived = entry.playbook.is_active === 'archived'

  const handleArchive = async () => {
    try {
      await archiveMut.mutateAsync(entry.playbook!.id)
      addToast({ title: 'Setup archived', message: `${entry.name} archived.`, variant: 'info' })
      setConfirmArchive(false)
    } catch (e: unknown) {
      addToast({ title: 'Archive failed', message: e instanceof Error ? e.message : 'Try again.', variant: 'error' })
    }
  }

  const handleRestore = async () => {
    try {
      await updateMut.mutateAsync({ id: entry.playbook!.id, payload: { is_active: 'active' } })
      addToast({ title: 'Setup restored', message: `${entry.name} is active again.`, variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Restore failed', message: e instanceof Error ? e.message : 'Try again.', variant: 'error' })
    }
  }

  if (isArchived) {
    return (
      <Button size="sm" variant="secondary" onClick={handleRestore} disabled={updateMut.isPending}>
        <ArchiveRestore aria-hidden="true" size={14} />
        Restore
      </Button>
    )
  }

  if (confirmArchive) {
    return (
      <Cluster gap="sm">
        <Button size="sm" variant="danger" onClick={handleArchive} disabled={archiveMut.isPending}>
          {archiveMut.isPending ? 'Archiving…' : 'Confirm archive'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(false)}>
          Cancel
        </Button>
      </Cluster>
    )
  }

  return (
    <Button size="sm" variant="ghost" onClick={() => setConfirmArchive(true)}>
      <Archive aria-hidden="true" size={14} />
      Archive
    </Button>
  )
}

export function SetupDetailPanel({ entry, onOpenTrade, onReviewTrade, onEditSetup }: SetupDetailPanelProps) {
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
  const isPlaybook = entry.origin === 'playbook' && entry.playbook != null

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
        action={
          <Cluster gap="sm">
            {isPlaybook && onEditSetup && (
              <Button size="sm" variant="ghost" onClick={() => onEditSetup(entry)}>
                <Pencil aria-hidden="true" size={14} />
                Edit
              </Button>
            )}
            <SetupActions entry={entry} />
            {originBadge(entry)}
          </Cluster>
        }
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
