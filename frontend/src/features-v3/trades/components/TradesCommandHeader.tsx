import { Badge, Button, Cluster } from '@/new-ui'
import { RefreshCw, SquarePlus } from 'lucide-react'
import type { TradesV3Filters, TradesV3Summary } from '../types'

interface TradesCommandHeaderProps {
  filters: TradesV3Filters
  summary: TradesV3Summary
  loadedCount: number
  isFetching: boolean
  dataEnabled: boolean
  onRefresh: () => void
}

export function TradesCommandHeader({ filters, summary, loadedCount, isFetching, dataEnabled, onRefresh }: TradesCommandHeaderProps) {
  return (
    <section className="tjv3-trades__header">
      <div className="tjv3-trades__header-main">
        <div>
          <div className="tjv3-trades__eyebrow">Trade Ledger v3</div>
          <h1 className="tjv3-trades__title">Trades</h1>
          <p className="tjv3-trades__subtitle">Ledger, status, risk, and review readiness.</p>
        </div>
        <Cluster justify="flex-end">
          <Button variant="secondary" disabled title="Add trade remains in the legacy flow for N4">
            <SquarePlus aria-hidden="true" size={14} />
            Add trade
          </Button>
          <Button variant="secondary" onClick={onRefresh} disabled={!dataEnabled || isFetching}>
            <RefreshCw aria-hidden="true" size={14} />
            {isFetching ? 'Refreshing' : 'Refresh'}
          </Button>
        </Cluster>
      </div>

      <Cluster>
        <Badge variant="accent">{filters.period === 'all' ? 'All time' : filters.period}</Badge>
        {dataEnabled && <Badge variant="info">API loaded {loadedCount}</Badge>}
        <Badge variant="neutral">{summary.total} trades</Badge>
        <Badge variant={summary.open > 0 ? 'info' : 'neutral'}>{summary.open} open</Badge>
        <Badge variant={summary.partial > 0 ? 'accent' : 'neutral'}>{summary.partial} partial</Badge>
        <Badge variant="neutral">{summary.closed} closed</Badge>
        <Badge variant={summary.needsAttention > 0 ? 'warning' : 'success'}>
          {summary.needsAttention} attention
        </Badge>
      </Cluster>
    </section>
  )
}
