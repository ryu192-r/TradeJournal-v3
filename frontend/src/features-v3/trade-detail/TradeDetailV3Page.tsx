import { useMemo } from 'react'
import { Grid, Stack } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import { useTradeDetailV3Data } from './hooks/useTradeDetailV3Data'
import type { TradeDetailV3PageProps } from './types'
import { PartialExitsPanel } from './components/PartialExitsPanel'
import { PlanVsExecutionPanel } from './components/PlanVsExecutionPanel'
import { NotesReviewPanel } from './components/NotesReviewPanel'
import { SetupTagsPanel } from './components/SetupTagsPanel'
import { TradeChartWorkspace } from './components/TradeChartWorkspace'
import { TradeDetailActions } from './components/TradeDetailActions'
import {
  TradeDetailErrorState,
  TradeDetailLoadingState,
  TradeDetailNotFoundState,
} from './components/TradeDetailEmptyState'
import { TradeDetailHeader } from './components/TradeDetailHeader'
import { TradeLifecycleTimeline } from './components/TradeLifecycleTimeline'
import { TradeRiskProtectionPanel } from './components/TradeRiskProtectionPanel'
import { TradeSummaryPanel } from './components/TradeSummaryPanel'
import { buildTradeDetailTimeline } from './utils/tradeDetailV3Timeline'
import './trade-detail.css'

export function TradeDetailV3Page({ tradeId, onOpenLegacyWorkspace }: TradeDetailV3PageProps) {
  const closeTradeForm = useAppStore((state) => state.closeTradeForm)
  const openEditTrade = useAppStore((state) => state.openEditTrade)
  const data = useTradeDetailV3Data(tradeId)

  const timeline = useMemo(() => {
    if (!data.trade) return []
    return buildTradeDetailTimeline(
      data.trade,
      data.stopHistory,
      data.partialExits,
      data.timelineEvents,
    )
  }, [data.trade, data.stopHistory, data.partialExits, data.timelineEvents])

  const handleBack = () => closeTradeForm()

  if (data.isLoading) {
    return (
      <div className="tjv3-trade-detail">
        <TradeDetailLoadingState />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="tjv3-trade-detail">
        <TradeDetailErrorState onRetry={() => void data.refresh()} onBack={handleBack} />
      </div>
    )
  }

  if (!data.trade) {
    return (
      <div className="tjv3-trade-detail">
        <TradeDetailNotFoundState onBack={handleBack} />
      </div>
    )
  }

  const trade = data.trade

  return (
    <div className="tjv3-trade-detail">
      <Stack gap="lg">
        <TradeDetailHeader trade={trade} onBack={handleBack} />

        <Grid minColumnWidth="20rem" className="tjv3-trade-detail__hero-grid">
          <TradeChartWorkspace trade={trade} />
          <Stack gap="lg">
            <TradeSummaryPanel trade={trade} />
            <TradeRiskProtectionPanel trade={trade} />
          </Stack>
        </Grid>

        <Grid minColumnWidth="18rem">
          <TradeLifecycleTimeline events={timeline} />
          <PartialExitsPanel partialExits={data.partialExits} />
        </Grid>

        <Grid minColumnWidth="18rem">
          <PlanVsExecutionPanel trade={trade} />
          <NotesReviewPanel trade={trade} />
          <SetupTagsPanel trade={trade} />
        </Grid>

        <TradeDetailActions
          onBack={handleBack}
          onEdit={() => openEditTrade(trade.id)}
          onOpenLegacyWorkspace={onOpenLegacyWorkspace}
        />
      </Stack>
    </div>
  )
}
