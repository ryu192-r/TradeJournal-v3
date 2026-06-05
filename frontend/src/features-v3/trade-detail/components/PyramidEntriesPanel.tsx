import { useState } from 'react'
import { Button, DataList, DataRow, EmptyState, Panel, Value } from '@/new-ui'
import { Layers, Pencil, Trash2, Check, X } from 'lucide-react'
import type { PyramidEntry } from '@/types'
import { formatTradeDateTime, formatTradePrice, formatTradeQuantity } from '../utils/tradeDetailV3Formatters'

interface PyramidEntriesPanelProps {
  entries: PyramidEntry[]
  onEdit?: (entryId: number, payload: { entry_price?: number; quantity?: number; fees?: number; entry_time?: string }) => void
  onDelete?: (entryId: number) => void
  isSubmitting?: boolean
}

export function PyramidEntriesPanel({ entries, onEdit, onDelete, isSubmitting }: PyramidEntriesPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editQty, setEditQty] = useState('')
  const [editFees, setEditFees] = useState('')
  const [editTime, setEditTime] = useState('')

  const startEdit = (entry: PyramidEntry) => {
    setEditingId(entry.id)
    setEditPrice(entry.entry_price)
    setEditQty(entry.quantity)
    setEditFees(entry.fees)
    setEditTime(entry.entry_time?.slice(0, 16) ?? '')
  }

  const cancelEdit = () => setEditingId(null)

  const confirmEdit = () => {
    if (!editingId || !onEdit) return
    onEdit(editingId, {
      entry_price: Number(editPrice) || undefined,
      quantity: Number(editQty) || undefined,
      fees: Number(editFees) || undefined,
      entry_time: editTime ? editTime + ':00' : undefined,
    })
    setEditingId(null)
  }

  return (
    <Panel title="Pyramid entries (position adds)" description="Each buy-add that built this position. Edits recalculate weighted avg entry price and total quantity.">
      {entries.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden="true" />}
          title="No pyramid entries"
          description="Pyramid entries will appear after using the Pyramid action on this trade."
        />
      ) : (
        <DataList>
          {entries.map((entry, i) => (
            editingId === entry.id ? (
              <div key={entry.id} className="tjv3-trade-detail__edit-row">
                <div className="tjv3-trade-detail__edit-fields">
                  <label>Price <input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} /></label>
                  <label>Qty <input type="number" step="1" value={editQty} onChange={(e) => setEditQty(e.target.value)} /></label>
                  <label>Fees <input type="number" step="0.01" value={editFees} onChange={(e) => setEditFees(e.target.value)} /></label>
                  <label>Time <input type="datetime-local" value={editTime} onChange={(e) => setEditTime(e.target.value)} /></label>
                </div>
                <div className="tjv3-trade-detail__edit-actions">
                  <Button variant="primary" size="sm" onClick={confirmEdit} disabled={isSubmitting}><Check size={13} /></Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}><X size={13} /></Button>
                </div>
              </div>
            ) : (
              <DataRow
                key={entry.id}
                title={`${i === 0 ? 'Initial' : `Add #${i}`} — ${formatTradeDateTime(entry.entry_time)}`}
                subtitle={entry.fees && Number(entry.fees) > 0 ? `Fees: ₹${entry.fees}` : undefined}
                trailing={
                  <div className="tjv3-trade-detail__partial-trailing">
                    <Value value={`${formatTradeQuantity(entry.quantity)} @ ${formatTradePrice(entry.entry_price)}`} />
                    {onEdit && (
                      <Button variant="ghost" size="sm" onClick={() => startEdit(entry)} disabled={isSubmitting}>
                        <Pencil aria-hidden="true" size={13} />
                      </Button>
                    )}
                    {onDelete && entries.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => onDelete(entry.id)} disabled={isSubmitting}>
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
