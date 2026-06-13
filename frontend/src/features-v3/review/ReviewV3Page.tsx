import { useMemo, useState, useEffect } from 'react'
import { Badge, EmptyState, ErrorState, Grid, LoadingState, MetricCard, Page, Panel, Stack, Value } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import { useTradesV3Data } from '../trades/hooks/useTradesV3Data'
import {
  formatTradePrice, getTradeSessionDateSafe, getTradeSetup,
} from '../trades/utils/tradesV3Formatters'
import { getTradeGrossPnl } from '../trades/utils/tradesV3Metrics'
import type { ApiTrade } from '@/types'
import { REVIEW_FILTER_OPTIONS, filterReviewTrades, summarizeReview, type ReviewFilter } from './utils/reviewFilters'
import { getReviewStatus, getReviewStatusLabel } from './utils/reviewStatus'
import { ReviewWorkspace } from './components/ReviewWorkspace'

interface ReviewV3PageProps {
  dataEnabled?: boolean
}

export function ReviewV3Page({ dataEnabled = true }: ReviewV3PageProps) {
  const { trades, isLoading, error, refresh } = useTradesV3Data(dataEnabled)
  const reviewTargetId = useAppStore((s) => s.reviewTargetId)
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)
  const [filter, setFilter] = useState<ReviewFilter>('pending')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const summary = useMemo(() => summarizeReview(trades), [trades])
  const queue = useMemo(() => filterReviewTrades(trades, filter), [trades, filter])

  // Deep-link from Trade Detail: preselect target trade
  useEffect(() => {
    if (reviewTargetId != null) setSelectedId(reviewTargetId)
  }, [reviewTargetId])

  const selected = useMemo<ApiTrade | null>(
    () => trades.find((t) => t.id === selectedId) ?? null,
    [trades, selectedId],
  )

  if (isLoading) {
    return <Page title="Review"><LoadingState label="Loading review queue…" /></Page>
  }
  if (error) {
    return <Page title="Review"><ErrorState title="Could not load trades" onRetry={() => void refresh()} /></Page>
  }

  return (
    <Page
      title="Review"
      subtitle="Process trades, capture mistakes, and turn executions into lessons."
    >
      <Stack gap="lg">
        <Grid minColumnWidth="10rem">
          <MetricCard label="Pending" value={<Value value={String(summary.pending)} />} />
          <MetricCard label="Reviewed" value={<Value value={String(summary.reviewed)} />} />
          <MetricCard label="Unclassified" value={<Value value={String(summary.unclassified)} />} />
          <MetricCard label="Reviewable trades" value={<Value value={String(summary.total)} />} />
        </Grid>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {REVIEW_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                border: `1px solid ${filter === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: filter === opt.value ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
                color: filter === opt.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Grid minColumnWidth="20rem" gap="lg">
          {/* Queue */}
          <Panel title="Review queue" description={`${queue.length} trade${queue.length === 1 ? '' : 's'}`}>
            {queue.length === 0 ? (
              <EmptyState title="Nothing here" description="No trades match this filter." />
            ) : (
              <Stack gap="sm">
                {queue.map((t) => (
                  <ReviewQueueRow
                    key={t.id}
                    trade={t}
                    active={t.id === selectedId}
                    onSelect={() => setSelectedId(t.id)}
                  />
                ))}
              </Stack>
            )}
          </Panel>

          {/* Workspace */}
          {selected ? (
            <ReviewWorkspace trade={selected} onReviewed={() => void refresh()} onOpenDetail={openDetailTrade} />
          ) : (
            <Panel title="Workspace">
              <EmptyState title="Select a trade" description="Pick a trade from the queue to review it." />
            </Panel>
          )}
        </Grid>

        <Panel title="Daily review" description="Read-only day context.">
          <Value value="Daily review persistence is not implemented yet — only per-trade review is saved." />
        </Panel>
      </Stack>
    </Page>
  )
}

function ReviewQueueRow({ trade, active, onSelect }: { trade: ApiTrade; active: boolean; onSelect: () => void }) {
  const status = getReviewStatus(trade)
  const pnl = getTradeGrossPnl(trade)
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
        width: '100%', textAlign: 'left', padding: '0.625rem 0.75rem', borderRadius: '0.625rem',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: active ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-bg-muted)',
        cursor: 'pointer', minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{trade.symbol}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {getTradeSessionDateSafe(trade)} · {getTradeSetup(trade)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8125rem', color: pnl == null ? 'var(--color-text-muted)' : pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>
          {pnl == null ? '—' : formatTradePrice(pnl)}
        </span>
        <Badge variant={status === 'reviewed' ? 'success' : 'warning'}>{getReviewStatusLabel(status)}</Badge>
      </div>
    </button>
  )
}
