import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, EmptyState, ErrorState, LoadingState, Page, Stack } from '@/new-ui'
import { RefreshCw, Receipt } from 'lucide-react'
import { deleteDailyCharges } from '@/lib/endpoints'
import { invalidateChargesDependents } from '@/lib/queryInvalidation'
import { todaySessionDate } from '@/utils/tradeDates'
import { useChargesLedgerData } from './hooks/useChargesLedgerData'
import { ChargesPeriodFilter } from './components/ChargesPeriodFilter'
import { ChargesSummaryCards } from './components/ChargesSummaryCards'
import { MissingChargesQueue } from './components/MissingChargesQueue'
import { RecordedChargesLedger } from './components/RecordedChargesLedger'
import { DailyChargesEntryDrawer } from './components/DailyChargesEntryDrawer'
import { ChargesDeleteConfirm } from './components/ChargesDeleteConfirm'

export function ChargesLedgerPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isFetching, error, refetch, period, setPeriod } = useChargesLedgerData()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit'>('add')
  const [drawerDate, setDrawerDate] = useState('')
  const [deleteConfirmDate, setDeleteConfirmDate] = useState<string | null>(null)

  const openAdd = useCallback((date: string) => {
    setDrawerMode('add')
    setDrawerDate(date)
    setDrawerOpen(true)
  }, [])

  const openEdit = useCallback((date: string) => {
    setDrawerMode('edit')
    setDrawerDate(date)
    setDrawerOpen(true)
  }, [])

  const handleDelete = useCallback(async (date: string) => {
    try {
      await deleteDailyCharges(date)
      setDeleteConfirmDate(null)
      void refetch()
      void invalidateChargesDependents(queryClient)
    } catch {
      // keep confirm open if needed, or show toast
    }
  }, [refetch, queryClient])

  return (
    <Page
      title="Daily Charges Ledger"
      subtitle="Record contract-note charges by trading day to unlock accurate net P&L."
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Button variant="ghost" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw size={14} />
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="primary" size="sm" onClick={() => openAdd(todaySessionDate())}>
            Add charges
          </Button>
        </div>
      }
    >
      <Stack gap="lg">
        <ChargesPeriodFilter value={period} onChange={setPeriod} />
        <ChargesSummaryCards summary={data ?? null} isLoading={isLoading} />

        {isLoading && <LoadingState label="Loading ledger..." />}
        {error && (
          <ErrorState
            title="Ledger unavailable"
            description="Could not load daily charges data."
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !error && data && data.days.length === 0 && (
          <EmptyState
            icon={<Receipt size={24} />}
            title="No trading activity"
            description="There are no closed trades in the selected period. Charges will appear here once trades exist."
          />
        )}
        {!isLoading && !error && data && data.days.length > 0 && (
          <>
            <MissingChargesQueue days={data.days} onAddCharges={openAdd} />
            <RecordedChargesLedger
              days={data.days}
              onEdit={openEdit}
              onDelete={(date) => setDeleteConfirmDate(date)}
            />
          </>
        )}
      </Stack>

      <DailyChargesEntryDrawer
        open={drawerOpen}
        date={drawerDate}
        mode={drawerMode}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          void refetch()
          void invalidateChargesDependents(queryClient)
        }}
      />

      {deleteConfirmDate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--tj-backdrop)',
          }}
          onClick={() => setDeleteConfirmDate(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ChargesDeleteConfirm
              date={deleteConfirmDate}
              onConfirm={() => handleDelete(deleteConfirmDate)}
              onCancel={() => setDeleteConfirmDate(null)}
            />
          </div>
        </div>
      )}
    </Page>
  )
}
