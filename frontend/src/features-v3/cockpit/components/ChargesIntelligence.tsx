import { useState } from 'react'
import { Badge, Button, DataList, DataRow, MoneyValue, Panel, Value } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import type { CockpitMetrics } from '../types'
import type { DailyChargesSummary } from '@/types'
import { DailyChargesDrawer } from './DailyChargesDrawer'
import { todaySessionDate } from '@/utils/tradeDates'

interface ChargesIntelligenceProps {
  metrics: CockpitMetrics
  summary?: DailyChargesSummary | null
  onRefetch?: () => void
}

export function ChargesIntelligence({ metrics, summary, onRefetch }: ChargesIntelligenceProps) {
  const { setActiveView } = useAppStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const noTrades = metrics.chargesState === 'no_trades'

  const hasRealData = summary && summary.trading_days > 0
  const chargesRecorded = hasRealData && summary!.charges_recorded_days > 0
  const totalCharges = hasRealData && summary!.total_charges ? Number(summary!.total_charges) : null
  const netPnl = hasRealData && summary!.net_realized_pnl ? Number(summary!.net_realized_pnl) : null
  const missingDays = hasRealData ? (summary!.missing_charge_days ?? 0) : 0

  const today = todaySessionDate()

  return (
    <>
      <Panel
        title="Charges Intelligence"
        description="India-first P&L model: gross trade P&L first, net only after charges are recorded."
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant={
            chargesRecorded && missingDays === 0 ? 'success'
              : noTrades ? 'neutral'
              : 'warning'
          }>
            {noTrades ? 'No trades'
              : chargesRecorded && missingDays === 0 ? 'Recorded'
              : chargesRecorded ? `Missing: ${missingDays} day(s)`
              : 'Pending'}
          </Badge>
          {!noTrades && (
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(true)}>
              {chargesRecorded ? 'Edit charges' : 'Add charges'}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setActiveView('charges')}>
            Open ledger
          </Button>
        </div>
      }
      >
        <DataList>
          <DataRow
            title="Gross P&L"
            subtitle="Closed trades before recorded fees"
            trailing={<MoneyValue value={metrics.grossPnl} tone="auto" />}
          />
          <DataRow
            title="Charges & fees"
            subtitle={
              noTrades
                ? 'No period trades to reconcile'
                : chargesRecorded
                ? 'From daily charges ledger'
                : 'Daily charges not recorded for period'
            }
            trailing={
              chargesRecorded && totalCharges != null
                ? <MoneyValue value={totalCharges} tone="neutral" />
                : <Value value={noTrades ? 'No trades' : 'Not added'} />
            }
          />
          <DataRow
            title="Net P&L"
            subtitle={
              noTrades
                ? 'No period trades yet'
                : chargesRecorded && missingDays === 0
                ? 'Based on daily charges ledger'
                : chargesRecorded
                ? `${missingDays} trading day(s) still missing charges`
                : 'Net withheld until charges are recorded'
            }
            trailing={
              chargesRecorded && missingDays === 0 && netPnl != null
                ? <MoneyValue value={netPnl} tone="auto" />
                : <Value value={noTrades ? 'No trades' : 'Pending charges'} />
            }
          />
        </DataList>
        <div className="tjv3-cockpit__micro">
          {chargesRecorded && missingDays > 0
            ? `${missingDays} trading day(s) in period need daily charges before net P&L is final.`
            : 'Daily charges are recorded per trading day from broker contract note. Not estimated.'}
        </div>
      </Panel>

      <DailyChargesDrawer
        open={drawerOpen}
        date={today}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          onRefetch?.()
        }}
      />
    </>
  )
}
