import { useState } from 'react'
import { usePartialExitsQuery, useCreatePartialExitMutation, useDeletePartialExitMutation } from '@/hooks/usePartialExitQuery'
import { formatPrice, formatCurrency, formatDateTime } from '@/utils/format'
import { nowIST } from '@/schemas/tradeForm'
import { Loader2, Trash2 } from 'lucide-react'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/utils'

const EXIT_REASONS = ['target_hit', 'stop_hit', 'trailing_stop', 'manual_rules', 'gut_feeling', 'risk_management', 'partial_profit', 'time_based'] as const

interface PartialExitFormProps {
  tradeId: number
  entryPrice: number
  currentQty: number
  remainingQty?: number
  onClose: () => void
}

export function PartialExitForm({ tradeId, entryPrice, currentQty, remainingQty: initialRemaining, onClose }: PartialExitFormProps) {
  const [qty, setQty] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [exitReason, setExitReason] = useState<string>('')
  const [note, setNote] = useState('')
  const createMutation = useCreatePartialExitMutation()
  const deleteMutation = useDeletePartialExitMutation()
  const addToast = useToastStore((s) => s.addToast)
  const { data: exitsData, isLoading: exitsLoading } = usePartialExitsQuery(tradeId)

  const remainingQty = exitsData ? Number(exitsData.remaining_qty) : (initialRemaining ?? currentQty)
  const existingExits = exitsData?.items ?? []

  const qtyNum = parseFloat(qty) || 0
  const exitPriceNum = parseFloat(exitPrice) || 0
  const estPnl = qtyNum > 0 && exitPriceNum > 0 ? (exitPriceNum - entryPrice) * qtyNum : null
  const qtyExceeded = qtyNum > remainingQty

  const handleSubmit = () => {
    if (!qty || !exitPrice || qtyExceeded) return
    createMutation.mutate({
      tradeId,
      payload: {
        qty,
        exit_price: exitPrice,
        exit_time: nowIST() + ':00',
        exit_reason: exitReason || null,
        note: note || null,
      },
    }, {
      onSuccess: () => {
        addToast({ title: 'Partial exit recorded', message: `${qty} shares exited.`, variant: 'success' })
        setQty('')
        setExitPrice('')
        setExitReason('')
        setNote('')
      },
      onError: () => addToast({ title: 'Error', message: 'Failed to record partial exit.', variant: 'error' }),
    })
  }

  const handleDelete = (exitId: number) => {
    deleteMutation.mutate(
      { tradeId, exitId },
      {
        onSuccess: () => addToast({ title: 'Deleted', message: 'Partial exit removed.', variant: 'info' }),
        onError: () => addToast({ title: 'Error', message: 'Failed to delete partial exit.', variant: 'error' }),
      },
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between font-data text-[length:var(--text-xs)]">
        <span className="text-text-muted">Total qty: <span className="text-text-heading">{currentQty}</span></span>
        <span className={cn('font-medium', remainingQty <= 0 ? 'text-loss' : 'text-profit')}>
          Remaining: {remainingQty}
        </span>
      </div>

      {/* Existing partial exits */}
      {existingExits.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider">Recorded exits</div>
          {existingExits.map((pe) => {
            const pnl = pe.realized_pnl ? Number(pe.realized_pnl) : null
            return (
              <div key={pe.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated/20 border border-border/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-data text-text-heading">{pe.qty} shares</span>
                    <span className="text-text-muted">@</span>
                    <span className="font-data text-text-heading">{formatPrice(Number(pe.exit_price))}</span>
                    {pnl != null && (
                      <span className={cn('font-data font-medium', pnl >= 0 ? 'text-profit' : 'text-loss')}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-text-faint mt-0.5">
                    <span>{formatDateTime(pe.exit_time)}</span>
                    {pe.exit_reason && <span className="capitalize">{pe.exit_reason.replace(/_/g, ' ')}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(pe.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1 rounded text-text-faint hover:text-loss transition-colors cursor-pointer disabled:opacity-30"
                  title="Delete partial exit"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {exitsLoading && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 text-accent animate-spin" /></div>}

      {/* New partial exit form — only if shares remain */}
      {remainingQty > 0 ? (
        <div className="space-y-3 pt-2 border-t border-border/50">
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider">New partial exit</div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[length:var(--text-xs)] text-text-muted mb-1 block">Qty</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={`max ${remainingQty}`}
                max={remainingQty}
                inputMode="numeric"
                className={cn(
                  'min-h-11 w-full text-sm border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none font-data focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  qtyExceeded ? 'border-loss/60 focus:border-loss' : 'border-border focus:border-accent',
                )}
              />
              {qtyExceeded && (
                <div className="text-[10px] text-loss mt-0.5">Exceeds remaining {remainingQty}</div>
              )}
            </div>
            <div>
              <label className="text-[length:var(--text-xs)] text-text-muted mb-1 block">Exit Price</label>
              <input
                type="number"
                step="0.01"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder={formatPrice(entryPrice)}
                inputMode="decimal"
                className="min-h-11 w-full text-sm border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-data focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              />
            </div>
          </div>

          {estPnl !== null && !qtyExceeded && (
            <div className={cn(
              'text-sm font-data text-center py-1.5 rounded-lg',
              estPnl >= 0 ? 'bg-profit-muted/30 text-profit' : 'bg-loss-muted/30 text-loss',
            )}>
              Est. P&L: {estPnl >= 0 ? '+' : ''}{formatPrice(estPnl)}
            </div>
          )}

          <div>
            <label className="text-[length:var(--text-xs)] text-text-muted mb-1 block">Reason</label>
            <select
              value={exitReason}
              onChange={(e) => setExitReason(e.target.value)}
              className="min-h-11 w-full text-sm border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <option value="">Select reason...</option>
              {EXIT_REASONS.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note..."
            className="min-h-11 w-full text-sm border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            rows={2}
          />

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="text-sm min-h-10 px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={!qty || !exitPrice || qtyExceeded || createMutation.isPending}
              className="text-sm min-h-10 px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              {createMutation.isPending ? 'Saving...' : 'Record Exit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-3 text-[length:var(--text-xs)] text-text-muted">
          All shares have been partially exited.
        </div>
      )}
    </div>
  )
}
