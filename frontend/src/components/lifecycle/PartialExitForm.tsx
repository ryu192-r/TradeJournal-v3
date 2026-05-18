import { useState } from 'react'
import { useCreatePartialExitMutation } from '@/hooks/usePartialExitQuery'
import { formatPrice } from '@/utils/format'

const EXIT_REASONS = ['target_hit', 'stop_hit', 'trailing_stop', 'manual_rules', 'gut_feeling', 'risk_management', 'partial_profit', 'time_based'] as const

interface PartialExitFormProps {
  tradeId: number
  entryPrice: number
  currentQty: number
  onClose: () => void
}

export function PartialExitForm({ tradeId, entryPrice, currentQty, onClose }: PartialExitFormProps) {
  const [qty, setQty] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [exitReason, setExitReason] = useState<string>('')
  const [note, setNote] = useState('')
  const createMutation = useCreatePartialExitMutation()

  const qtyNum = parseFloat(qty) || 0
  const exitPriceNum = parseFloat(exitPrice) || 0
  const estPnl = qtyNum > 0 && exitPriceNum > 0 ? (exitPriceNum - entryPrice) * qtyNum : null

  const handleSubmit = () => {
    if (!qty || !exitPrice) return
    createMutation.mutate({
      tradeId,
      payload: {
        qty,
        exit_price: exitPrice,
        exit_time: new Date().toISOString(),
        exit_reason: exitReason || null,
        note: note || null,
      },
    }, { onSuccess: onClose })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Qty</label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={`max ${currentQty}`}
            className="w-full text-xs border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-data"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Exit Price</label>
          <input
            type="number"
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value)}
            placeholder={formatPrice(entryPrice)}
            className="w-full text-xs border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent font-data"
          />
        </div>
      </div>

      {estPnl !== null && (
        <div className={`text-xs font-data text-center py-1.5 rounded-lg ${estPnl >= 0 ? 'bg-profit-muted/30 text-profit' : 'bg-loss-muted/30 text-loss'}`}>
          Est. P&L: {estPnl >= 0 ? '+' : ''}{formatPrice(estPnl)}
        </div>
      )}

      <div>
        <label className="text-[10px] text-text-muted uppercase tracking-wider mb-1 block">Reason</label>
        <select
          value={exitReason}
          onChange={(e) => setExitReason(e.target.value)}
          className="w-full text-xs border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading focus:outline-none focus:border-accent"
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
        className="w-full text-xs border border-border rounded-lg bg-bg-elevated/30 px-3 py-2 text-text-heading placeholder:text-text-muted/50 focus:outline-none focus:border-accent resize-none"
        rows={2}
      />

      <div className="flex gap-2 justify-end">
        <button
          onClick={onClose}
          className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-muted hover:text-text-heading transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!qty || !exitPrice || createMutation.isPending}
          className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
        >
          {createMutation.isPending ? 'Saving...' : 'Record Exit'}
        </button>
      </div>
    </div>
  )
}