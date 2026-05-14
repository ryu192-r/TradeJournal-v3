// Modal form for creating / editing a trade idea
import { useState, useEffect } from 'react'
import type { TradeIdeaItem, TradeIdeaCreatePayload, TradeIdeaUpdatePayload } from '@/types/tradeIdea'
import { X } from 'lucide-react'

interface IdeaFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: TradeIdeaCreatePayload | TradeIdeaUpdatePayload) => void
  idea?: TradeIdeaItem | null
  isPending?: boolean
}

export function IdeaFormModal({ open, onClose, onSubmit, idea, isPending }: IdeaFormModalProps) {
  const [symbol, setSymbol] = useState('')
  const [direction, setDirection] = useState('LONG')
  const [entryPriceTarget, setEntryPriceTarget] = useState('')
  const [stopPrice, setStopPrice] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [thesis, setThesis] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [confidence, setConfidence] = useState('')
  const [tags, setTags] = useState('')
  const [revisitDate, setRevisitDate] = useState('')
  const [status, setStatus] = useState('draft')
  const [error, setError] = useState('')

  const isEdit = !!idea

  useEffect(() => {
    if (!open) return
    if (idea) {
      setSymbol(idea.symbol)
      setDirection(idea.direction)
      setEntryPriceTarget(idea.entry_price_target ?? '')
      setStopPrice(idea.stop_price ?? '')
      setTargetPrice(idea.target_price ?? '')
      setThesis(idea.thesis ?? '')
      setTimeframe(idea.timeframe ?? '')
      setConfidence(idea.confidence ?? '')
      setTags(idea.tags ?? '')
      setRevisitDate(idea.revisit_date ? new Date(idea.revisit_date).toISOString().split('T')[0] : '')
      setStatus(idea.status)
    } else {
      setSymbol('')
      setDirection('LONG')
      setEntryPriceTarget('')
      setStopPrice('')
      setTargetPrice('')
      setThesis('')
      setTimeframe('')
      setConfidence('')
      setTags('')
      setRevisitDate('')
      setStatus('draft')
    }
    setError('')
  }, [open, idea])

  const handleSubmit = () => {
    if (!symbol.trim()) {
      setError('Symbol is required')
      return
    }
    const payload: TradeIdeaCreatePayload | TradeIdeaUpdatePayload = {
      symbol: symbol.trim().toUpperCase(),
      direction: direction as 'LONG' | 'SHORT',
      entry_price_target: entryPriceTarget.trim() || null,
      stop_price: stopPrice.trim() || null,
      target_price: targetPrice.trim() || null,
      thesis: thesis.trim() || null,
      timeframe: timeframe.trim() || null,
      confidence: confidence as 'LOW' | 'MEDIUM' | 'HIGH' | null,
      tags: tags.trim() || null,
      revisit_date: revisitDate ? new Date(revisitDate).toISOString() : null,
      status: status as 'draft' | 'active' | 'traded' | 'archived',
    }
    onSubmit(payload)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl my-8">
        <div className="bg-card rounded-2xl border border-border p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-accent-faint text-text-muted hover:text-accent transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <h2 className="font-display text-xl text-text-heading mb-1 pr-8">
            {isEdit ? 'Edit Idea' : 'New Trade Idea'}
          </h2>
          <p className="text-sm text-text-muted mb-6">
            {isEdit ? `Editing ${idea?.symbol}` : 'Capture a trade idea before it triggers.'}
          </p>

          {error && (
            <div className="mb-4 rounded-lg bg-loss-faint border border-loss/20 px-3 py-2 text-sm text-loss">{error}</div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Symbol *</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="RELIANCE"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Direction *</label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="LONG">Long</option>
                  <option value="SHORT">Short</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Entry Price Target</label>
                <input
                  type="text"
                  value={entryPriceTarget}
                  onChange={(e) => setEntryPriceTarget(e.target.value)}
                  placeholder="2450.00"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Stop Price</label>
                <input
                  type="text"
                  value={stopPrice}
                  onChange={(e) => setStopPrice(e.target.value)}
                  placeholder="2400.00"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Target Price</label>
                <input
                  type="text"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="2550.00"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="w-full">
              <label className="block text-xs font-medium text-text-muted mb-1.5">Thesis</label>
              <textarea
                value={thesis}
                onChange={(e) => setThesis(e.target.value)}
                placeholder="Why this trade? What is the catalyst?"
                rows={3}
                disabled={isPending}
                className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[6rem]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Timeframe</label>
                <input
                  type="text"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  placeholder="Intraday / Swing 2-3d"
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Confidence</label>
                <select
                  value={confidence}
                  onChange={(e) => setConfidence(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select...</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
            </div>

            <div className="w-full">
              <label className="block text-xs font-medium text-text-muted mb-1.5">Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="earnings, breakout, gap-up"
                disabled={isPending}
                className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="w-full">
                <label className="block text-xs font-medium text-text-muted mb-1.5">Revisit Date</label>
                <input
                  type="date"
                  value={revisitDate}
                  onChange={(e) => setRevisitDate(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              {isEdit && (
                <div className="w-full">
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all duration-hover ease-out disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="traded">Traded</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}
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
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Idea'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
