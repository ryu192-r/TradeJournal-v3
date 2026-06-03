import { Button, Cluster, Panel } from '@/new-ui'
import { ExternalLink, Pencil } from 'lucide-react'

interface TradeDetailActionsProps {
  onBack: () => void
  onEdit?: () => void
  onOpenLegacyWorkspace?: () => void
  showLegacyWorkspace?: boolean
}

export function TradeDetailActions({
  onBack,
  onEdit,
  onOpenLegacyWorkspace,
  showLegacyWorkspace = true,
}: TradeDetailActionsProps) {
  return (
    <Panel title="Actions" description="Display-only workspace. Mutations stay in existing legacy flows.">
      <Cluster gap="sm">
        <Button variant="secondary" onClick={onBack}>
          Back to Trades
        </Button>
        {onEdit && (
          <Button variant="primary" onClick={onEdit}>
            <Pencil aria-hidden="true" size={14} />
            Edit trade
          </Button>
        )}
        {showLegacyWorkspace && onOpenLegacyWorkspace && (
          <Button variant="secondary" onClick={onOpenLegacyWorkspace}>
            <ExternalLink aria-hidden="true" size={14} />
            Open legacy workspace
          </Button>
        )}
      </Cluster>
      <div className="tjv3-trade-detail__actions-note">
        Partial exit, close, and delete actions remain in the legacy trade workspace.
      </div>
    </Panel>
  )
}
