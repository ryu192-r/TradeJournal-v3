import { useState } from 'react'
import { Button, DataList, DataRow, EmptyState, MoneyValue, Panel, Value } from '@/new-ui'
import { Layers, Pencil, Trash2, Check, X } from 'lucide-react'
import type { PartialExit } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity, safeNumber } from '../utils/tradeDetailV3Formatters'

interface PartialExitsPanelProps {
  partialExits: PartialExit[]
  onDelete?: (exitId: number) => void
  onEdit?: (exitId: number, payload: { qty?: string; exit_price?: string; exit_time?: string }) => void
  isDeleting?: boolean
}

export function PartialExitsPanel({ partialExits, onDelete, onEdit, isDeleting }: PartialExitsPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editTime, setEditTime] = useState('')

  const startEdit = (exit: PartialExit) => {
    setEditingId(exit.id)
    setEditQty(exit.qty)
    setEditPrice(exit.exit_price)
    setEditTime(exit.exit_time?.slice(0, 16) ?? '')
  }

  const confirmEdit = () => {
    if (!editingId || !onEdit) return
    onEdit(editingId, { qty: editQty, exit_price: editPrice, exit_time: editTime ? editTime + ':00' : undefined })
    setEditingId(null)
  }

  return (
    <Panel title="Partial exits (sells)" description="Shares sold before full close. Each exit reduces remaining quantity and locks in realized P&L.">
      {partialExits.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden="true" />}
          title="No partial exits recorded"
          description="Partial exits will appear here when they exist on this trade."
        />
      ) : (
        <DataList>
          {partialExits.map((exit) => (
            editingId === exit.id ? (
              <div key={exit.id} className="tjv3-trade-detail__edit-row">
                <div className="tjv3-trade-detail__edit-fields">
                  <label>Qty <input type="number" step="1" value={editQty} onChange={(e) => setEditQty(e.target.value)} /></label>
                  <label>Price <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></label>
                  <label>Time <input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)} /></label>
                </div>
                <div className="tjv3-trade-detail__edit-actions">
                  <Button variant="primary" size="sm" onClick={confirmEdit} disabled={isDeleting}><Check size={13} /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}><X size={13} /></Button>
                </div>
              </div>
            ) : (
              <DataRow
                key={exit.id}
                title={formatTradeDateTime(exit.exit_time)}
                subtitle={exit.note ?? exit.exit_reason ?? undefined}
                trailing={
                  <div className="tjv3-trade-detail__partial-trailing">
                    <Value value={`${formatTradeQuantity(exit.qty)} @ ${formatTradePrice(exit.exit_price)}`} />
                    <MoneyValue value={safeNumber(exit.realized_pnl)} tone="auto" />
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => startEdit(exit)} disabled={isDeleting}>
                        <Pencil aria-hidden="true" size={13} />
                      </Button>
                    )}
                    {onDelete && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(exit.id)} disabled={isDeleting}>
                        <Trash2 aria-hidden="true" size={13} />
                      </Button>
                    )}
                  </div>
                }
              />
            )
          ))}
        </DataList>
      )}
    </Panel>
  )
}
