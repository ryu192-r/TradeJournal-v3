import { useState } from 'react'
import { Button, Cluster, Panel } from '@/new-ui'
import { ExternalLink, Pencil, Scissors, XCircle, Shield, Layers, Trash2 } from 'lucide-react'
import type { PositionAction } from '../../position-actions'

interface TradeDetailActionsProps {
  onBack: () => void
  onEdit?: () => void
  onDelete?: () => void
  isDeleting?: boolean
  onOpenLegacyWorkspace?: () => void
  showLegacyWorkspace?: boolean
  isTradeOpen?: boolean
  onPositionAction?: (action: PositionAction) => void
}

export function TradeDetailActions({
  onBack,
  onEdit,
  onDelete,
  isDeleting,
  onOpenLegacyWorkspace,
  showLegacyWorkspace = true,
  isTradeOpen = false,
  onPositionAction,
}: TradeDetailActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        {onDelete && !confirmDelete && (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" size={14} />
            Delete
          </Button>
        )}
        {onDelete && confirmDelete && (
          <>
            <Button variant="danger" onClick={onDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Confirm delete'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
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
