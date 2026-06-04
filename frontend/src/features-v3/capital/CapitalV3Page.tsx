import { useState } from 'react'
import {
  Badge, Button, Drawer, EmptyState, ErrorState, Grid, LoadingState,
  MetricCard, MoneyValue, Page, Panel, PercentValue, Stack, Value,
} from '@/new-ui'
import { useCapitalV3Data } from './hooks/useCapitalV3Data'
import { useCapitalEventsQuery, useCreateCapitalEventMutation } from '@/hooks/useCapitalEventsQuery'
import type { CapitalDashboardPayload, CapitalEvent } from '@/types'
import './capital.css'

export function CapitalV3Page() {
  const capital = useCapitalV3Data()
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [depositType, setDepositType] = useState<'deposit' | 'withdrawal'>('deposit')

  if (capital.isLoading) return <Page title="Capital"><LoadingState label="Loading capital…" /></Page>
  if (capital.error) return <Page title="Capital"><ErrorState title="Capital unavailable" description={capital.error.message} onRetry={() => void capital.refresh()} /></Page>
  if (!capital.data) return <Page title="Capital"><EmptyState title="No account" description="Create an account to track capital." /></Page>

  const d = capital.data

  return (
    <Page
      title="Capital"
      subtitle={`${d.account_name} · Equity tracking, deposits, withdrawals, reconciliation.`}
      actions={
        <div className="tjv3-cap__actions">
          <Button variant="primary" size="sm" onClick={() => { setDepositType('deposit'); setShowDepositForm(true) }}>
            + Deposit
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setDepositType('withdrawal'); setShowDepositForm(true) }}>
            − Withdraw
          </Button>
          <Button variant="ghost" size="sm" onClick={() => capital.reconcile(d.account_id)} disabled={capital.isReconciling}>
            {capital.isReconciling ? 'Reconciling…' : 'Reconcile'}
          </Button>
        </div>
      }
    >
      <Stack gap="lg">
        <EquityMetrics data={d} />
        <TierProgress data={d} />
        <EquityCurve data={d} />
        <EventsLedger accountId={d.account_id} />
      </Stack>

      <DepositWithdrawDrawer
        open={showDepositForm}
        type={depositType}
        accountId={d.account_id}
        onClose={() => setShowDepositForm(false)}
      />
    </Page>
  )
}

function EquityMetrics({ data }: { data: CapitalDashboardPayload }) {
  return (
    <Grid minColumnWidth="9rem">
      <MetricCard label="Net equity" value={<MoneyValue value={data.net_equity} tone="neutral" />} />
      <MetricCard label="Initial" value={<MoneyValue value={data.initial_balance} tone="neutral" />} />
      <MetricCard label="Deposits" value={<MoneyValue value={data.total_deposits} tone="profit" />} />
      <MetricCard label="Withdrawals" value={<MoneyValue value={data.total_withdrawals} tone="loss" />} />
      <MetricCard label="Realized P&L" value={<MoneyValue value={data.total_realized_pnl} tone="auto" />} />
      <MetricCard label="Unrealized" value={<MoneyValue value={data.unrealized_pnl} tone="auto" />} />
      <MetricCard label="Deployed" value={<MoneyValue value={data.deployed_capital} tone="neutral" />} />
      <MetricCard label="Available" value={<MoneyValue value={data.available_capital} tone="profit" />} />
      <MetricCard label="Win rate" value={<PercentValue value={data.win_rate} />} />
      <MetricCard label="Profit factor" value={<Value value={data.profit_factor != null ? data.profit_factor.toFixed(2) : '—'} />} />
    </Grid>
  )
}

function TierProgress({ data }: { data: CapitalDashboardPayload }) {
  if (!data.tiers || data.tiers.length === 0) return null
  const current = data.tiers.find((t) => t.current)
  return (
    <Panel title="Tier progress" description={current ? `Current: ${current.name}` : undefined}>
      <div className="tjv3-cap__tiers">
        {data.tiers.map((tier) => (
          <div key={tier.name} className={`tjv3-cap__tier${tier.current ? ' tjv3-cap__tier--current' : ''}`}>
            <span>{tier.name}</span>
            {tier.progress_pct != null && (
              <div className="tjv3-cap__tier-bar">
                <div className="tjv3-cap__tier-fill" style={{ width: `${Math.min(tier.progress_pct, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function EquityCurve({ data }: { data: CapitalDashboardPayload }) {
  if (!data.equity_curve || data.equity_curve.length === 0) return null
  const values = data.equity_curve.map((p) => Number(p.equity))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return (
    <Panel title="Equity curve" description={`${data.equity_curve.length} data points`}>
      <div className="tjv3-cap__curve">
        {data.equity_curve.map((point, i) => {
          const pct = ((Number(point.equity) - min) / range) * 100
          return <div key={i} className="tjv3-cap__curve-bar" style={{ height: `${Math.max(pct, 2)}%` }} title={`${point.date}: ₹${point.equity}`} />
        })}
      </div>
    </Panel>
  )
}

function EventsLedger({ accountId }: { accountId: number }) {
  const { data, isLoading } = useCapitalEventsQuery(accountId)
  if (isLoading) return <LoadingState label="Loading events…" />
  const events: CapitalEvent[] = data?.items ?? []

  return (
    <Panel title="Capital events" description={`${events.length} events`}>
      {events.length === 0 ? (
        <EmptyState title="No events" description="Deposits, withdrawals, and adjustments will appear here." />
      ) : (
        <div className="tjv3-cap__ledger">
          <table className="tjv3-cap__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 50).map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.timestamp.slice(0, 10)}</td>
                  <td><Badge variant={ev.event_type === 'deposit' ? 'profit' : ev.event_type === 'withdrawal' ? 'loss' : 'neutral'}>{ev.event_type}</Badge></td>
                  <td><MoneyValue value={ev.amount} tone="auto" /></td>
                  <td>{ev.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function DepositWithdrawDrawer({
  open,
  type,
  accountId,
  onClose,
}: {
  open: boolean
  type: 'deposit' | 'withdrawal'
  accountId: number
  onClose: () => void
}) {
  const createMut = useCreateCapitalEventMutation()
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')

  const handleSave = () => {
    if (!amount || Number(amount) <= 0) return
    createMut.mutate(
      {
        event_type: type,
        amount,
        timestamp: new Date().toISOString(),
        description: desc || undefined,
        account_id: accountId,
      },
      { onSuccess: () => { setAmount(''); setDesc(''); onClose() } },
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={type === 'deposit' ? 'Add Deposit' : 'Record Withdrawal'}
      footer={
        <Button variant="primary" size="sm" onClick={handleSave} disabled={createMut.isPending || !amount}>
          {createMut.isPending ? 'Saving…' : 'Save'}
        </Button>
      }
    >
      <Stack gap="md">
        <label className="tjv3-cap__field">
          <span>Amount (₹)</span>
          <input type="number" className="tjv3-cap__input" value={amount} onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" />
        </label>
        <label className="tjv3-cap__field">
          <span>Description (optional)</span>
          <input type="text" className="tjv3-cap__input" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
      </Stack>
    </Drawer>
  )
}
