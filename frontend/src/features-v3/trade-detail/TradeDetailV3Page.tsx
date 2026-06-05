import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Grid, Stack } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import { deletePartialExit, deleteStopHistory, updatePartialExit, updatePyramidEntry, deletePyramidEntry, deleteTrade } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import { useTradeDetailV3Data } from './hooks/useTradeDetailV3Data'
import type { TradeDetailV3PageProps } from './types'
import { PositionActionDrawer, type PositionAction } from '../position-actions'
import { PartialExitsPanel } from './components/PartialExitsPanel'
import { PyramidEntriesPanel } from './components/PyramidEntriesPanel'
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

  // Position action drawer
  const [actionDrawer, setActionDrawer] = useState<{ open: boolean; action: PositionAction }>({ open: false, action: 'partial_exit' })
  const openAction = (action: PositionAction) => setActionDrawer({ open: true, action })
  const closeAction = () => setActionDrawer((s) => ({ ...s, open: false }))

  // Delete mutations
  const qc = useQueryClient()
  const deletePartialMut = useMutation({
    mutationFn: (exitId: number) => deletePartialExit(tradeId, exitId),
    onSuccess: () => void invalidateTradeDomain(qc, tradeId),
  })
  const deleteStopMut = useMutation({
    mutationFn: (entryId: number) => deleteStopHistory(tradeId, entryId),
    onSuccess: () => void invalidateTradeDomain(qc, tradeId),
  })
  const editPartialMut = useMutation({
    mutationFn: (args: { exitId: number; payload: { qty?: string; exit_price?: string } }) =>
      updatePartialExit(tradeId, args.exitId, args.payload),
    onSuccess: () => void invalidateTradeDomain(qc, tradeId),
  })
  const editPyramidMut = useMutation({
    mutationFn: (args: { entryId: number; payload: { entry_price?: number; quantity?: number; fees?: number } }) =>
      updatePyramidEntry(tradeId, args.entryId, args.payload),
    onSuccess: () => void invalidateTradeDomain(qc, tradeId),
  })
  const deletePyramidMut = useMutation({
    mutationFn: (entryId: number) => deletePyramidEntry(tradeId, entryId),
    onSuccess: () => void invalidateTradeDomain(qc, tradeId),
  })
  const deleteTradeMut = useMutation({
    mutationFn: () => deleteTrade(tradeId),
    onSuccess: () => {
      void invalidateTradeDomain(qc, tradeId)
      closeTradeForm()
    },
  })

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
          <TradeLifecycleTimeline
            events={timeline}
            onDeleteStopEntry={(id) => deleteStopMut.mutate(id)}
            isDeletingStop={deleteStopMut.isPending}
          />
          <PartialExitsPanel
            partialExits={data.partialExits}
            onDelete={(id) => deletePartialMut.mutate(id)}
            onEdit={(id, payload) => editPartialMut.mutate({ exitId: id, payload })}
            isDeleting={deletePartialMut.isPending || editPartialMut.isPending}
          />
        </Grid>

        {data.pyramidEntries.length > 0 && (
          <PyramidEntriesPanel
            entries={data.pyramidEntries}
            onEdit={(id, payload) => editPyramidMut.mutate({ entryId: id, payload })}
            onDelete={(id) => deletePyramidMut.mutate(id)}
            isSubmitting={editPyramidMut.isPending || deletePyramidMut.isPending}
          />
        )}

        <Grid minColumnWidth="18rem">
          <PlanVsExecutionPanel trade={trade} />
          <NotesReviewPanel trade={trade} />
          <SetupTagsPanel trade={trade} />
        </Grid>

        <TradeDetailActions
          onBack={handleBack}
          onEdit={() => openEditTrade(trade.id)}
          onDelete={() => deleteTradeMut.mutate()}
          isDeleting={deleteTradeMut.isPending}
          onOpenLegacyWorkspace={onOpenLegacyWorkspace}
          isTradeOpen={!trade.exit_price}
          onPositionAction={openAction}
        />
      </Stack>

      {actionDrawer.open && (
        <PositionActionDrawer
          open={actionDrawer.open}
          onClose={closeAction}
          trade={trade}
          initialAction={actionDrawer.action}
        />
      )}
    </div>
  )
}
