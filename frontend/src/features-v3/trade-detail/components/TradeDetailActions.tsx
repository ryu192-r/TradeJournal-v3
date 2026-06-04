import { Button, Cluster, Panel } from '@/new-ui'
import { ExternalLink, Pencil, Scissors, XCircle, Shield, Layers } from 'lucide-react'
import type { PositionAction } from '../../position-actions'

interface TradeDetailActionsProps {
  onBack: () => void
  onEdit?: () => void
  onOpenLegacyWorkspace?: () => void
  showLegacyWorkspace?: boolean
  isTradeOpen?: boolean
  onPositionAction?: (action: PositionAction) => void
}

export function TradeDetailActions({
  onBack,
  onEdit,
  onOpenLegacyWorkspace,
  showLegacyWorkspace = true,
  isTradeOpen = false,
  onPositionAction,
}: TradeDetailActionsProps) {
  return (
    <Panel title="Actions">
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
        {isTradeOpen && onPositionAction && (
          <>
            <Button variant="secondary" onClick={() => onPositionAction('partial_exit')}>
              <Scissors aria-hidden="true" size={14} />
              Partial exit
            </Button>
            <Button variant="secondary" onClick={() => onPositionAction('close')}>
              <XCircle aria-hidden="true" size={14} />
              Close trade
            </Button>
            <Button variant="secondary" onClick={() => onPositionAction('protection_stop')}>
              <Shield aria-hidden="true" size={14} />
              Move stop
            </Button>
            <Button variant="secondary" onClick={() => onPositionAction('pyramid')}>
              <Layers aria-hidden="true" size={14} />
              Pyramid
            </Button>
          </>
        )}
        {showLegacyWorkspace && onOpenLegacyWorkspace && (
          <Button variant="ghost" onClick={onOpenLegacyWorkspace}>
            <ExternalLink aria-hidden="true" size={14} />
            Legacy workspace
          </Button>
        )}
      </Cluster>
    </Panel>
  )
}
