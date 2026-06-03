import { Badge, Button, Cluster, SegmentedControl } from '@/new-ui'
import { RefreshCw } from 'lucide-react'
import type { CockpitMetrics, CockpitPeriod } from '../types'
import { getPeriodLabel } from '../utils/cockpitFilters'

const PERIOD_OPTIONS: Array<{ value: CockpitPeriod; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

interface CockpitCommandHeaderProps {
  period: CockpitPeriod
  metrics: CockpitMetrics
  isFetching: boolean
  onPeriodChange: (period: CockpitPeriod) => void
  onRefresh: () => void
}

export function CockpitCommandHeader({ period, metrics, isFetching, onPeriodChange, onRefresh }: CockpitCommandHeaderProps) {
  return (
    <section className="tjv3-cockpit__header-surface">
      <div className="tjv3-cockpit__header-main">
        <div>
          <div className="tjv3-cockpit__eyebrow">Midnight Fintech Cockpit</div>
          <h1 className="tjv3-cockpit__title">Cockpit</h1>
          <p className="tjv3-cockpit__subtitle">
            Trading command center for performance, open exposure, review work, and India-first charges readiness.
          </p>
        </div>
        <Cluster justify="flex-end">
          <SegmentedControl
            value={period}
            onChange={(value) => onPeriodChange(value as CockpitPeriod)}
            options={PERIOD_OPTIONS}
            ariaLabel="Cockpit period"
          />
          <Button variant="secondary" onClick={onRefresh} disabled={isFetching}>
            <RefreshCw aria-hidden="true" size={14} />
            {isFetching ? 'Refreshing' : 'Refresh'}
          </Button>
        </Cluster>
      </div>

      <Cluster>
        <Badge variant="accent">{getPeriodLabel(period)}</Badge>
        <Badge variant={metrics.activeTrades.length > 0 ? 'info' : 'neutral'} dot>
          {metrics.activeTrades.length} open
        </Badge>
        <Badge variant={metrics.chargesState === 'recorded' ? 'success' : metrics.chargesState === 'pending' ? 'warning' : 'neutral'}>
          {metrics.chargesState === 'recorded' ? 'Charges recorded' : metrics.chargesState === 'pending' ? 'Charges pending' : 'No trades'}
        </Badge>
        <Badge variant={metrics.reviewItems.length > 0 ? 'warning' : 'success'}>
          {metrics.reviewItems.length > 0 ? `${metrics.reviewItems.length} reviews pending` : 'Desk clear'}
        </Badge>
        {metrics.untaggedCount > 0 && <Badge variant="warning">{metrics.untaggedCount} untagged</Badge>}
      </Cluster>
    </section>
  )
}
