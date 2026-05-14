// Modal to convert an active trade idea into an actual trade
import { useState } from 'react'
import type { ConvertToTradePayload } from '@/types/tradeIdea'
import { X } from 'lucide-react'

interface ConvertToTradeModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: ConvertToTradePayload) => void
  symbol: string
  direction: string
  isPending?: boolean
}

export function ConvertToTradeModal({ open, onClose, onSubmit, symbol, direction, isPending }: ConvertToTradeModalProps) {
  const [entryPrice, setEntryPrice] = useState('')
  const [exitPrice, setExitPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [fees, setFees] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const handleSubmit = () => {
    if (!entryPrice.trim() || !quantity.trim()) {
      setError('Entry price and quantity are required to convert to a trade.')
      return
    }
    setError('')
    onSubmit({
      entry_price: entryPrice.trim() || null,
      exit_price: exitPrice.trim() || null,
      quantity: quantity.trim() || null,
      fees: fees.trim() || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-md my-8">
        <div className="bg-card rounded-2xl border border-border p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-accent-faint text-text-muted hover:text-accent transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <h2 className="font-display text-lg text-text-heading mb-1 pr-8">Convert to Trade</h2>
          <p className="text-sm text-text-muted mb-6">
            Converting {symbol} ({direction}) idea into an actual trade record.
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-loss-faint border border-loss/20 px-3 py-2 text-sm text-loss">{error}</div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Entry Price *</label>
                <input
                  type="text"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="2450.00"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Exit Price</label>
                <input
                  type="text"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  placeholder="Optional"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Quantity *</label>
                <input
                  type="text"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="100"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Fees</label>
                <input
                  type="text"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="0"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="w-full">
              <label className="block text-xs font-medium text-text-muted mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes for the trade record..."
                rows={3}
                disabled={isPending}
                className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[6rem]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
            <button
              onClick={onClose}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50"
            >
              {isPending ? 'Converting...' : 'Convert to Trade'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
