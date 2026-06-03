import { useMemo, useState } from 'react'
import { Badge, ErrorState, LoadingState, Panel, Stack } from '@/new-ui'
import type { ApiTrade } from '@/types'
import { AttentionSignals } from './components/AttentionSignals'
import { CalendarSnapshot } from './components/CalendarSnapshot'
import { ChargesIntelligence } from './components/ChargesIntelligence'
import { CockpitCommandHeader } from './components/CockpitCommandHeader'
import { CockpitDrawerPreview } from './components/CockpitDrawerPreview'
import { CockpitPerformanceDeck } from './components/CockpitPerformanceDeck'
import { OpenRiskBoard } from './components/OpenRiskBoard'
import { ReviewActionCenter } from './components/ReviewActionCenter'
import { SetupIntelligence } from './components/SetupIntelligence'
import { TradingTape } from './components/TradingTape'
import { useCockpitV3Data } from './hooks/useCockpitV3Data'
import { useDailyChargesSummary } from './hooks/useDailyChargesSummary'
import type { CockpitActionItem, CockpitPeriod } from './types'
import { buildCockpitMetrics } from './utils/cockpitMetrics'
import './cockpit.css'

interface CockpitV3PageProps {
  dataEnabled?: boolean
}

export function CockpitV3Page({ dataEnabled = true }: CockpitV3PageProps) {
  const [period, setPeriod] = useState<CockpitPeriod>('all')
  const [selectedTrade, setSelectedTrade] = useState<ApiTrade | null>(null)
  const [selectedActionItem, setSelectedActionItem] = useState<CockpitActionItem | null>(null)
  const data = useCockpitV3Data(dataEnabled)
  const chargesQuery = useDailyChargesSummary(period, dataEnabled)

  const metrics = useMemo(
    () => buildCockpitMetrics(data.trades, period, data.operational),
    [data.operational, data.trades, period],
  )

  const handleSelectTrade = (trade: ApiTrade) => {
    setSelectedActionItem(null)
    setSelectedTrade(trade)
  }

  const handleSelectActionItem = (item: CockpitActionItem) => {
    setSelectedTrade(null)
    setSelectedActionItem(item)
  }

  const handleCloseDrawer = () => {
    setSelectedTrade(null)
    setSelectedActionItem(null)
  }

  if (data.isLoading) {
    return (
      <div className="tjv3-cockpit">
        <LoadingState label="Loading Cockpit v3" lines={8} />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="tjv3-cockpit">
        <ErrorState
          title="Cockpit data unavailable"
          description="Existing trade endpoint did not return data for this preview."
          onRetry={() => {
            void data.refresh()
          }}
        />
      </div>
    )
  }

  return (
    <div className="tjv3-cockpit">
      <Stack gap="lg">
        <CockpitCommandHeader
          period={period}
          metrics={metrics}
          isFetching={data.isFetching}
          onPeriodChange={setPeriod}
          onRefresh={() => {
            void data.refresh()
          }}
        />

        <CockpitPerformanceDeck metrics={metrics} />

        {!dataEnabled && (
          <Panel
            title="Demo preview mode"
            description="Demo credentials unlock the isolated shell only. Protected dashboard and trade APIs are not called without real auth."
            action={<Badge variant="warning">No API calls</Badge>}
          >
            <div className="tjv3-cockpit__micro">
              Log in with a real account to load data-backed Cockpit metrics. N3 still shows honest unavailable states here.
            </div>
          </Panel>
        )}

        {dataEnabled && data.dashboardError && (
          <Panel
            title="Trades loaded"
            description="Some dashboard metrics are unavailable in this preview response."
            action={<Badge variant="warning">Partial data</Badge>}
          >
            <div className="tjv3-cockpit__micro">
              Cockpit v3 is using existing trade data. Dashboard operational or intelligence data can be retried without hiding loaded trades.
            </div>
          </Panel>
        )}

        <div className="tjv3-cockpit__primary-grid">
          <OpenRiskBoard metrics={metrics} onSelectTrade={handleSelectTrade} />
          <TradingTape metrics={metrics} onSelectTrade={handleSelectTrade} />
        </div>

        <div className="tjv3-cockpit__module-grid">
          <ChargesIntelligence
            metrics={metrics}
            summary={chargesQuery.data ?? null}
            onRefetch={() => {
              void chargesQuery.refetch()
            }}
          />
          <ReviewActionCenter items={metrics.reviewItems} onSelectItem={handleSelectActionItem} />
          <SetupIntelligence setups={metrics.setupSummaries} />
          <AttentionSignals signals={metrics.attentionSignals} />
          <CalendarSnapshot trades={metrics.periodTrades} />
        </div>
      </Stack>

      <CockpitDrawerPreview
        trade={selectedTrade}
        actionItem={selectedActionItem}
        onClose={handleCloseDrawer}
      />
    </div>
  )
}
