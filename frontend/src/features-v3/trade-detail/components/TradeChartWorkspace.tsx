import { lazy, Suspense } from 'react'
import { EmptyState, ErrorState, LoadingState, Panel } from '@/new-ui'
import { BarChart3 } from 'lucide-react'
import type { ApiTrade } from '@/types'

const TradeLightweightChart = lazy(() =>
  import('@/components/charts/TradeLightweightChart').then((module) => ({
    default: module.TradeLightweightChart,
  })),
)

interface TradeChartWorkspaceProps {
  trade: ApiTrade
}

export function TradeChartWorkspace({ trade }: TradeChartWorkspaceProps) {
  return (
    <Panel
      title="Chart workspace"
      description="Existing lightweight chart with entry, exit, and stop markers when backend data is available."
      className="tjv3-trade-detail__chart-panel"
    >
      <Suspense
        fallback={
          <div className="tjv3-trade-detail__chart-shell">
            <LoadingState label="Loading chart" lines={6} />
          </div>
        }
      >
        <div className="tjv3-trade-detail__chart-shell">
          <TradeLightweightChart trade={trade} />
        </div>
      </Suspense>

      <div className="tjv3-trade-detail__chart-note">
        No fake candles. If providers are unavailable, the chart shows an honest empty state.
      </div>
    </Panel>
  )
}

export function TradeChartEmptyState() {
  return (
    <Panel title="Chart workspace" description="Chart unavailable for this trade.">
      <EmptyState
        icon={<BarChart3 aria-hidden="true" />}
        title="No chart data"
        description="Chart data is unavailable for this trade right now."
      />
    </Panel>
  )
}

export function TradeChartErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Panel title="Chart workspace" description="Chart failed to load.">
      <ErrorState
        title="Chart unavailable"
        description="Could not load chart data for this trade."
        onRetry={onRetry}
      />
    </Panel>
  )
}
