import { useMemo, useState } from 'react'
import { Badge, ErrorState, LoadingState, Panel, Stack } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { TradeEmptyState } from './components/TradeEmptyState'
import { TradePreviewDrawer } from './components/TradePreviewDrawer'
import { TradesCommandHeader } from './components/TradesCommandHeader'
import { TradesFilterBar } from './components/TradesFilterBar'
import { TradesLedger } from './components/TradesLedger'
import { TradesMobileCard } from './components/TradesMobileCard'
import { TradesSummaryStrip } from './components/TradesSummaryStrip'
import { useTradesV3Data } from './hooks/useTradesV3Data'
import { useTradesV3Filters } from './hooks/useTradesV3Filters'
import type { TradesV3PageProps } from './types'
import { applyTradesV3Filters, getSetupOptions } from './utils/tradesV3Filters'
import { summarizeTrades } from './utils/tradesV3Metrics'
import './trades.css'

export function TradesV3Page({ dataEnabled = true }: TradesV3PageProps) {
  const data = useTradesV3Data(dataEnabled)
  const { filters, updateFilter, resetFilters } = useTradesV3Filters()
  const [selectedTrade, setSelectedTrade] = useState<ApiTrade | null>(null)

  const filteredTrades = useMemo(
    () => applyTradesV3Filters(data.trades, filters),
    [data.trades, filters],
  )
  const summary = useMemo(
    () => summarizeTrades(filteredTrades, filters.status === 'deleted'),
    [filteredTrades, filters.status],
  )
  const setupOptions = useMemo(() => getSetupOptions(data.trades), [data.trades])

  if (data.isLoading) {
    return (
      <div className="tjv3-trades">
        <LoadingState label="Loading Trades v3" lines={8} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="tjv3-trades">
        <ErrorState
          title="Could not load trades"
          description="Existing trade list endpoint did not return data for this preview."
          onRetry={() => {
            void data.refresh()
          }}
        />
      </div>
    )
  }

  return (
    <div className="tjv3-trades">
      <Stack gap="lg">
        <TradesCommandHeader
          filters={filters}
          summary={summary}
          isFetching={data.isFetching}
          dataEnabled={dataEnabled}
          onRefresh={() => {
            void data.refresh()
          }}
        />

        {!dataEnabled && (
          <Panel
            title="Demo preview mode"
            description="Demo credentials unlock the isolated shell only. Protected trade APIs are not called without real auth."
            action={<Badge variant="warning">No API calls</Badge>}
          >
            <div className="tjv3-trades__micro">
              Log in with a real account to load data-backed Trades v3 rows. N4 still shows honest empty states here.
            </div>
          </Panel>
        )}

        <TradesSummaryStrip summary={summary} />

        <TradesFilterBar
          filters={filters}
          setupOptions={setupOptions}
          onChange={updateFilter}
          onReset={resetFilters}
        />

        {filteredTrades.length === 0 ? (
          <TradeEmptyState />
        ) : (
          <>
            <TradesLedger trades={filteredTrades} onSelectTrade={setSelectedTrade} />
            <Panel title="Mobile Trade Cards" description="Touch-friendly ledger cards for narrow screens." className="tjv3-trades__mobile-panel">
              <div className="tjv3-trades__mobile-list">
                {filteredTrades.map((trade) => (
                  <TradesMobileCard key={trade.id} trade={trade} onSelectTrade={setSelectedTrade} />
                ))}
              </div>
            </Panel>
          </>
        )}
      </Stack>

      <TradePreviewDrawer trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
    </div>
  )
}
