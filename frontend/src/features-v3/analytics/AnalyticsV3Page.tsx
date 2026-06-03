import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, EmptyState, ErrorState, Grid, LoadingState, MetricCard, Page, Panel, Stack, Value, MoneyValue, PercentValue, RMultipleValue } from '@/new-ui'
import { useTradesV3Data } from '../trades/hooks/useTradesV3Data'
import { getDailyChargesSummary } from '@/lib/endpoints'
import { todaySessionDate } from '@/utils/tradeDates'
import type { TradesV3Period } from '../trades/types'
import { filterByPeriod, computePerformance, groupBySetup, groupByExchange, groupByProductType, buildChargesStatus, type GroupMetrics } from './utils/analyticsMetrics'

type AnalyticsPeriod = TradesV3Period

const PERIODS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

function periodToRange(period: AnalyticsPeriod): [string, string] {
  const today = todaySessionDate()
  if (period === 'today') return [today, today]
  if (period === 'week') {
    const [y, m, d] = today.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    const dow = date.getUTCDay()
    date.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1))
    return [date.toISOString().slice(0, 10), today]
  }
  if (period === 'month') return [`${today.slice(0, 7)}-01`, today]
  // all → 90 day cap for charges
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - 90)
  return [date.toISOString().slice(0, 10), today]
}

export function AnalyticsV3Page({ dataEnabled = true }: { dataEnabled?: boolean }) {
  const { trades, isLoading, error, refresh } = useTradesV3Data(dataEnabled)
  const [period, setPeriod] = useState<AnalyticsPeriod>('month')
  const [start, end] = useMemo(() => periodToRange(period), [period])

  const chargesQuery = useQuery({
    queryKey: ['daily-charges', 'summary', 'analytics', start, end],
    queryFn: () => getDailyChargesSummary(start, end),
    enabled: dataEnabled,
    staleTime: 30_000,
  })

  const filtered = useMemo(() => filterByPeriod(trades, period), [trades, period])
  const perf = useMemo(() => computePerformance(filtered), [filtered])
  const setups = useMemo(() => groupBySetup(filtered), [filtered])
  const exchanges = useMemo(() => groupByExchange(filtered), [filtered])
  const products = useMemo(() => groupByProductType(filtered), [filtered])
  const charges = useMemo(() => buildChargesStatus(chargesQuery.data ?? null), [chargesQuery.data])

  if (isLoading) return <Page title="Analytics"><LoadingState label="Loading analytics…" /></Page>
  if (error) return <Page title="Analytics"><ErrorState title="Could not load data" onRetry={() => void refresh()} /></Page>

  return (
    <Page title="Analytics" subtitle="Performance overview. Gross P&L from trades; net P&L only when daily charges are complete.">
      <Stack gap="lg">
        {/* Period filter */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {PERIODS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${period === p.value ? 'var(--color-accent)' : 'var(--color-border)'}`, background: period === p.value ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent', color: period === p.value ? 'var(--color-accent)' : 'var(--color-text-muted)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>{p.label}</button>
          ))}
        </div>

        {/* Performance overview */}
        <Grid minColumnWidth="9rem">
          <MetricCard label="Trades" value={<Value value={String(perf.closedTrades)} />} />
          <MetricCard label="Open" value={<Value value={String(perf.openTrades)} />} />
          <MetricCard label="Gross P&L" value={<MoneyValue value={perf.grossPnl} tone="auto" />} />
          <MetricCard label="Win rate" value={<PercentValue value={perf.winRate} />} />
          <MetricCard label="Avg R" value={<RMultipleValue value={perf.avgR} tone="auto" />} />
          <MetricCard label="Best trade" value={<MoneyValue value={perf.bestTrade} tone="profit" />} />
          <MetricCard label="Worst trade" value={<MoneyValue value={perf.worstTrade} tone="loss" />} />
          <MetricCard label="Reviewed" value={<Value value={`${perf.reviewedCount} / ${perf.closedTrades}`} />} />
        </Grid>

        {/* Charges / Net P&L */}
        <Panel title="Charges & net P&L" description="Net P&L only shown when all trading days have recorded charges.">
          {charges.tradingDays === 0 ? (
            <EmptyState title="No trading days" description="No closed trades in this period." />
          ) : (
            <Grid minColumnWidth="10rem">
              <MetricCard label="Gross P&L" value={<MoneyValue value={charges.grossPnl} tone="auto" />} />
              <MetricCard label="Total charges" value={<MoneyValue value={charges.totalCharges} tone="neutral" />} />
              <MetricCard label="Net P&L" value={charges.isComplete ? <MoneyValue value={charges.netPnl} tone="auto" /> : <Badge variant="warning">Pending — {charges.missingDays} day{charges.missingDays !== 1 ? 's' : ''} missing</Badge>} />
              <MetricCard label="Charge days" value={<Value value={`${charges.chargesRecordedDays} / ${charges.tradingDays}`} />} />
            </Grid>
          )}
        </Panel>

        {/* Setup breakdown */}
        {setups.length > 0 && (
          <Panel title="Setup performance">
            <GroupTable rows={setups} />
          </Panel>
        )}

        {/* Market metadata */}
        {(exchanges.length > 0 || products.length > 0) && (
          <Panel title="Market breakdown">
            <Grid minColumnWidth="18rem">
              {exchanges.length > 0 && <GroupTable rows={exchanges} title="Exchange" />}
              {products.length > 0 && <GroupTable rows={products} title="Product type" />}
            </Grid>
          </Panel>
        )}

        {/* Review analytics */}
        <Panel title="Review status">
          <Grid minColumnWidth="10rem">
            <MetricCard label="Reviewed" value={<Value value={String(perf.reviewedCount)} />} />
            <MetricCard label="Pending" value={<Value value={String(perf.pendingReview)} />} />
            <MetricCard label="Reviewed %" value={<PercentValue value={perf.closedTrades > 0 ? (perf.reviewedCount / perf.closedTrades) * 100 : null} />} />
          </Grid>
        </Panel>

        {filtered.length === 0 && <EmptyState title="No trades" description="No non-deleted trades found for this period." />}
      </Stack>
    </Page>
  )
}

function GroupTable({ rows, title }: { rows: GroupMetrics[]; title?: string }) {
  return (
    <div>
      {title && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{title}</div>}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ width: '100%', minWidth: '26rem', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
            <th style={{ padding: '0.375rem 0' }}>Name</th>
            <th style={{ padding: '0.375rem 0' }}>Count</th>
            <th style={{ padding: '0.375rem 0' }}>Gross P&L</th>
            <th style={{ padding: '0.375rem 0' }}>Win %</th>
            <th style={{ padding: '0.375rem 0' }}>Avg R</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} style={{ borderTop: '1px solid var(--color-border)' }}>
              <td style={{ padding: '0.5rem 0', fontWeight: 500 }}>{r.label}</td>
              <td style={{ padding: '0.5rem 0' }}>{r.count}</td>
              <td style={{ padding: '0.5rem 0', color: r.grossPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{r.grossPnl.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</td>
              <td style={{ padding: '0.5rem 0' }}>{r.winRate != null ? `${r.winRate.toFixed(0)}%` : '—'}</td>
              <td style={{ padding: '0.5rem 0' }}>{r.avgR != null ? `${r.avgR.toFixed(2)}R` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
