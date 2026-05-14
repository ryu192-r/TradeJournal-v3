import { TradeReviewCard } from './TradeReviewCard'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useReviewTradeMutation } from '@/hooks/useReviewTradeMutation'
import { useToastStore } from '@/store/toastStore'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

export function TradeReviewStream() {
  const { data, isLoading, error } = useTradesQuery({ status: 'draft' })
  const reviewMutation = useReviewTradeMutation()
  const addToast = useToastStore((s) => s.addToast)

  const trades = data?.items || []
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (trades.length > 0 && currentIndex >= trades.length) {
      setCurrentIndex(trades.length - 1)
    }
  }, [trades.length, currentIndex])

  const handleReview = useCallback(
    async (id: number, payload: import('@/types').ApiTradeUpdatePayload) => {
      try {
        await reviewMutation.mutateAsync({ id, payload })
        addToast({
          variant: 'success',
          title: 'Review saved',
          message: 'Trade reviewed and moved to analytics.',
        })
        setTimeout(() => {
          setCurrentIndex((idx) => {
            const next = idx + 1
            return next < trades.length ? next : idx
          })
        }, 400)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save review.'
        addToast({
          variant: 'error',
          title: 'Save failed',
          message: msg,
        })
        throw err
      }
    },
    [reviewMutation, addToast, trades.length]
  )

  const handleNext = () => {
    setCurrentIndex((idx) => (idx < trades.length - 1 ? idx + 1 : idx))
  }

  const renderProgress = () => (
    <div className="flex items-center justify-center gap-2 mb-4">
      {trades.map((_, idx) => (
        <button
          key={idx}
          onClick={() => setCurrentIndex(idx)}
          className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
            idx === currentIndex
              ? 'bg-accent w-6'
              : idx < currentIndex
                ? 'bg-accent/40 w-4'
                : 'bg-border w-4'
          }`}
        />
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-[2rem_2.5rem_3.5rem_3rem] max-w-[calc(100vw-14rem)]">
        <div className="animate-pulse text-text-muted text-sm">Loading unreviewed trades...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-[2rem_2.5rem_3.5rem_3rem] max-w-[calc(100vw-14rem)]">
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-3 max-w-md">
          <div className="text-loss font-medium">Failed to load trades</div>
          <div className="text-sm text-text-muted">{error instanceof Error ? error.message : 'Unknown error'}</div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-[2rem_2.5rem_3.5rem_3rem] max-w-[calc(100vw-14rem)]">
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
  const isLast = currentIndex >= trades.length - 1

  return (
    <div className="flex-1 p-[2rem_2.5rem_3.5rem_3rem] max-w-[calc(100vw-14rem)] space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-text-heading">Review</h1>
          <div className="text-sm text-text-muted font-data mt-0.5">
            {currentIndex + 1} of {trades.length} unreviewed
          </div>
        </div>
        <button
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text transition-all duration-[150ms] ease-out hover:text-text-heading hover:bg-accent-faint cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={handleNext}
          disabled={isLast}
        >
          Skip
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {renderProgress()}

      <TradeReviewCard
        key={currentTrade.id}
        trade={currentTrade}
        onReview={handleReview}
        onNext={handleNext}
        isLast={isLast}
      />

      <div className="text-center text-xs text-text-muted font-data">
        {trades.length - currentIndex - 1 > 0
          ? `${trades.length - currentIndex - 1} remaining after this one`
          : 'Last one — finish strong!'}
      </div>
    </div>
  )
}
