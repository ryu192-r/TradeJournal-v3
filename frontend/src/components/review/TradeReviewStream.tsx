import { TradeReviewCard } from './TradeReviewCard'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useReviewTradeMutation } from '@/hooks/useReviewTradeMutation'
import { useUpdateTradeMutation } from '@/hooks/useTradeMutation'
import { useToastStore } from '@/store/toastStore'
import { ArrowLeft, ArrowRight, CheckCircle2, Layers, X, Loader2 } from 'lucide-react'
import { ErrorState } from '@/components/ui/StateComponents'
import { useState, useCallback, useEffect } from 'react'

type ReviewFilter = 'unreviewed' | 'all'

export function TradeReviewStream() {
  const [filter, setFilter] = useState<ReviewFilter>('unreviewed')
  const { data, isLoading, error } = useTradesQuery()
  const reviewMutation = useReviewTradeMutation()
  const updateMutation = useUpdateTradeMutation()
  const addToast = useToastStore((s) => s.addToast)

  const trades = data?.items?.filter(t => filter === 'all' || !t.review_notes) || []
  const [currentIndex, setCurrentIndex] = useState(0)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkNotes, setBulkNotes] = useState('')
  const [bulkTags, setBulkTags] = useState<string[]>([])
  const [isBulkApplying, setIsBulkApplying] = useState(false)

  useEffect(() => {
    if (trades.length > 0 && currentIndex >= trades.length) {
      setCurrentIndex(trades.length - 1)
    }
  }, [trades.length, currentIndex])

  const handleReview = useCallback(
    async (id: number, payload: import('@/types').ApiTradeUpdatePayload) => {
      try {
        await reviewMutation.mutateAsync({ id, payload })
        addToast({ variant: 'success', title: 'Review saved', message: 'Trade review saved.' })
        setTimeout(() => {
          setCurrentIndex((idx) => {
            const next = idx + 1
            return next < trades.length ? next : idx
          })
        }, 400)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save review.'
        addToast({ variant: 'error', title: 'Save failed', message: msg })
        throw err
      }
    },
    [reviewMutation, addToast, trades.length]
  )

  const handlePrev = () => {
    setCurrentIndex((idx) => (idx > 0 ? idx - 1 : 0))
  }

  const handleNext = () => {
    setCurrentIndex((idx) => (idx < trades.length - 1 ? idx + 1 : idx))
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkApply = async () => {
    if (isBulkApplying || selectedIds.size === 0) return
    setIsBulkApplying(true)
    let success = 0
    let fail = 0
    for (const id of selectedIds) {
      try {
        await updateMutation.mutateAsync({
          id,
          payload: {
            notes: bulkNotes.trim() || null,
            tags: bulkTags.length > 0 ? bulkTags : null,
          },
        })
        success++
      } catch {
        fail++
      }
    }
    setIsBulkApplying(false)
    setSelectedIds(new Set())
    setBulkNotes('')
    setBulkTags([])
    addToast({
      variant: success > 0 ? 'success' : 'error',
      title: 'Bulk update complete',
      message: `${success} updated${fail > 0 ? `, ${fail} failed` : ''}.`,
    })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 sm:p-[2rem_2.5rem]">
        <div className="animate-pulse text-text-muted text-sm">Loading trades...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 sm:p-[2rem_2.5rem]">
        <ErrorState
          title="Failed to load trades"
          message={error instanceof Error ? error.message : 'Unknown error'}
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 sm:p-[2rem_2.5rem]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-accent-muted flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-accent" />
          </div>
          <div className="font-display text-2xl text-text-heading">All caught up!</div>
          <div className="text-sm text-text-muted max-w-xs mx-auto">
            Every trade has been reviewed. Come back after your next session.
          </div>
        </div>
      </div>
    )
  }

  const currentTrade = trades[currentIndex]
  const isFirst = currentIndex <= 0
  const isLast = currentIndex >= trades.length - 1

  return (
    <div className="flex-1 px-[var(--page-px)] py-[var(--page-py)] space-y-5 max-w-3xl mx-auto w-full">
      {/* Filter + Bulk toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setFilter('unreviewed'); setCurrentIndex(0) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === 'unreviewed'
                ? 'bg-accent-muted text-accent border border-accent/20'
                : 'text-text-muted hover:text-text border border-transparent'
            }`}
          >
            Unreviewed
          </button>
          <button
            onClick={() => { setFilter('all'); setCurrentIndex(0) }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-accent-muted text-accent border border-accent/20'
                : 'text-text-muted hover:text-text border border-transparent'
            }`}
          >
            All Trades
          </button>
        </div>
        <button
          onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()) }}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            bulkMode
              ? 'bg-accent text-white'
              : 'text-text-muted hover:text-text border border-border'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Bulk
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isFirst && !bulkMode && (
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-accent-faint transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="font-display text-2xl text-text-heading">Review</h1>
            <div className="text-sm text-text-muted font-data mt-0.5">
              {currentIndex + 1} of {trades.length}{filter === 'unreviewed' ? ' unreviewed' : ''}
              {bulkMode && ` (${selectedIds.size} selected)`}
            </div>
          </div>
        </div>
        {!bulkMode && (
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text transition-all duration-[150ms] ease-out hover:text-text-heading hover:bg-accent-faint cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={handleNext}
            disabled={isLast}
          >
            Skip
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2 mb-1">
        {trades.map((t, idx) => {
          const isReviewed = t.review_notes != null
          return (
            <button
              key={t.id}
              onClick={() => {
                if (bulkMode) {
                  toggleSelect(t.id)
                } else {
                  setCurrentIndex(idx)
                }
              }}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex
                  ? 'bg-accent w-6'
                  : isReviewed
                    ? 'bg-accent/40 w-4'
                    : selectedIds.has(t.id)
                      ? 'bg-accent w-4'
                      : 'bg-border w-4'
              }`}
              title={`${t.symbol}`}
            />
          )
        })}
      </div>

      {/* Bulk mode panel */}
      {bulkMode && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-medium text-text-heading">
            Apply to {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'selected trades'}
          </h3>
          <textarea
            value={bulkNotes}
            onChange={(e) => setBulkNotes(e.target.value)}
            placeholder="Notes to apply to all selected trades..."
            rows={2}
            className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
          />
          <input
            value={bulkTags.join(', ')}
            onChange={(e) => setBulkTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            placeholder="Tags (comma-separated): fomo, early-entry"
            className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
          />
          <div className="flex gap-2">
            <button
              onClick={handleBulkApply}
              disabled={isBulkApplying || selectedIds.size === 0}
              className="flex-1 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {isBulkApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Apply to {selectedIds.size > 0 ? `${selectedIds.size} trades` : 'selected'}
            </button>
            <button
              onClick={() => { setSelectedIds(new Set()); setBulkNotes(''); setBulkTags([]) }}
              className="px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-heading transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Trade card */}
      {!bulkMode && (
        <TradeReviewCard
          key={currentTrade.id}
          trade={currentTrade}
          onReview={handleReview}
          onNext={handleNext}
          isLast={isLast}
        />
      )}

      <div className="text-center text-xs text-text-muted font-data">
        {trades.length - currentIndex - 1 > 0
          ? `${trades.length - currentIndex - 1} remaining after this one`
          : 'Last one — finish strong!'}
      </div>
    </div>
  )
}
