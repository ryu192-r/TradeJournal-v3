import { useMemo } from 'react'
import { Badge, Button, EmptyState, MoneyValue, Panel, RMultipleValue, Stack, Value } from '@/new-ui'
import type { ApiTrade } from '@/types'
import {
  formatTradePrice,
  getTradeSessionDateSafe,
} from '../../trades/utils/tradesV3Formatters'
import {
  getTradeDisplayStatus,
  getTradeGrossPnl,
  getTradeRMultiple,
} from '../../trades/utils/tradesV3Metrics'
import { getReviewStatus, getReviewStatusLabel } from '../../review/utils/reviewStatus'

interface SetupTradesPanelProps {
  trades: ApiTrade[]
  onOpenTrade: (id: number) => void
  onReviewTrade: (id: number) => void
}

const MAX_ROWS = 25

function statusBadgeVariant(status: ReturnType<typeof getTradeDisplayStatus>) {
  switch (status) {
    case 'closed':
      return 'success' as const
    case 'open':
      return 'info' as const
    case 'partial':
      return 'accent' as const
    default:
      return 'neutral' as const
  }
}

export function SetupTradesPanel({ trades, onOpenTrade, onReviewTrade }: SetupTradesPanelProps) {
  // Sort by entry_time desc; cap.
  const rows = useMemo(() => {
    const arr = [...trades]
    arr.sort((a, b) => {
      const at = Date.parse(a.entry_time)
      const bt = Date.parse(b.entry_time)
      const aKey = Number.isFinite(at) ? at : 0
      const bKey = Number.isFinite(bt) ? bt : 0
      return bKey - aKey
    })
    return arr.slice(0, MAX_ROWS)
  }, [trades])

  if (trades.length === 0) {
    return (
      <Panel title="Trades">
        <EmptyState title="No trades" description="No trades linked to this setup yet." />
      </Panel>
    )
  }

  return (
    <Panel
      title="Trades"
      description={trades.length > MAX_ROWS ? `Showing latest ${MAX_ROWS} of ${trades.length}.` : `${trades.length} trade${trades.length === 1 ? '' : 's'}.`}
    >
      <Stack gap="xs">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '7rem minmax(0, 1fr) auto auto auto auto',
            gap: '0.5rem 0.75rem',
            alignItems: 'center',
            padding: '0.375rem 0.5rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <span>Date</span>
          <span>Symbol</span>
          <span style={{ textAlign: 'right' }}>Gross P&L</span>
          <span style={{ textAlign: 'right' }}>R</span>
          <span>Status</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {rows.map((trade) => {
          const status = getTradeDisplayStatus(trade)
          const reviewStatus = getReviewStatus(trade)
          const pnl = getTradeGrossPnl(trade)
          const r = getTradeRMultiple(trade)
          const reviewable = reviewStatus !== 'not_applicable'

          return (
            <div
              key={trade.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '7rem minmax(0, 1fr) auto auto auto auto',
                gap: '0.5rem 0.75rem',
                alignItems: 'center',
                padding: '0.5rem',
                borderRadius: '0.5rem',
                borderTop: '1px solid var(--color-border)',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>{getTradeSessionDateSafe(trade)}</span>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {trade.symbol}
                <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>
                  {formatTradePrice(trade.entry_price)}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                {pnl != null ? <MoneyValue value={pnl} tone="auto" /> : <Value value="—" />}
              </span>
              <span style={{ textAlign: 'right' }}>
                <RMultipleValue value={r} tone="auto" />
              </span>
              <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                {reviewable && (
                  <Badge variant={reviewStatus === 'reviewed' ? 'success' : 'warning'}>
                    {getReviewStatusLabel(reviewStatus)}
                  </Badge>
                )}
              </span>
              <span style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                <Button size="sm" variant="ghost" onClick={() => onOpenTrade(trade.id)}>
                  Open
                </Button>
                {reviewable && (
                  <Button size="sm" variant="ghost" onClick={() => onReviewTrade(trade.id)}>
                    Review
                  </Button>
                )}
              </span>
            </div>
          )
        })}
      </Stack>
    </Panel>
  )
}
