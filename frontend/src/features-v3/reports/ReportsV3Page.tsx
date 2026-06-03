import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, EmptyState, ErrorState, Grid, LoadingState, MetricCard, Page, Panel, PercentValue, RMultipleValue, Stack, Value, MoneyValue } from '@/new-ui'
import { Printer } from 'lucide-react'
import { useTradesV3Data } from '../trades/hooks/useTradesV3Data'
import { getDailyChargesSummary } from '@/lib/endpoints'
import { tradeMatchesPeriod } from '../trades/utils/tradesV3Filters'
import { isDeletedTrade } from '../trades/utils/tradesV3Metrics'
import {
  computePerformance, groupBySetup, groupByExchange, groupByProductType,
  buildChargesStatus, type GroupMetrics,
} from '../analytics/utils/analyticsMetrics'
import { REPORT_PERIOD_OPTIONS, reportPeriodToRange, getPeriodLabel, type ReportPeriod } from './utils/reportPeriods'
import { buildDailyRows, summarizeDaily } from './utils/reportDaily'

export function ReportsV3Page({ dataEnabled = true }: { dataEnabled?: boolean }) {
  const { trades, isLoading, error, refresh } = useTradesV3Data(dataEnabled)
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [start, end] = useMemo(() => reportPeriodToRange(period), [period])

  const chargesQuery = useQuery({
    queryKey: ['daily-charges', 'summary', 'reports', start, end],
    queryFn: () => getDailyChargesSummary(start, end),
    enabled: dataEnabled,
    staleTime: 30_000,
  })

  // Map V3 period values used by tradeMatchesPeriod
  const v3Period = period === 'today' ? 'today' : period === 'week' ? 'week' : 'month'
  const filtered = useMemo(
    () => trades.filter((t) => !isDeletedTrade(t) && (period === '30d' || period === '90d' ? true : tradeMatchesPeriod(t, v3Period))),
    [trades, period, v3Period],
  )
  const perf = useMemo(() => computePerformance(filtered), [filtered])
  const setups = useMemo(() => groupBySetup(filtered), [filtered])
  const exchanges = useMemo(() => groupByExchange(filtered), [filtered])
  const products = useMemo(() => groupByProductType(filtered), [filtered])
  const charges = useMemo(() => buildChargesStatus(chargesQuery.data ?? null), [chargesQuery.data])
  const dailyRows = useMemo(() => buildDailyRows(chargesQuery.data?.days ?? []), [chargesQuery.data])
  const dailySummary = useMemo(() => summarizeDaily(dailyRows), [dailyRows])

  if (isLoading) return <Page title="Reports"><LoadingState label="Loading report…" /></Page>
  if (error) return <Page title="Reports"><ErrorState title="Could not load data" onRetry={() => void refresh()} /></Page>

  const reportStatus =
    perf.closedTrades === 0 ? 'No trades' : charges.isComplete ? 'Complete' : `Charges pending — ${charges.missingDays} day${charges.missingDays !== 1 ? 's' : ''}`

  return (
    <Page
      title="Reports"
      subtitle={`Trading journal report · ${getPeriodLabel(period)}. Not a tax statement.`}
      actions={
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden="true" size={14} /> Print
        </Button>
      }
    >
      <Stack gap="lg">
        {/* Period selector */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {REPORT_PERIOD_OPTIONS.map((p) => (
            <button key={p.value} type="button" onClick={() => setPeriod(p.value)} style={{ padding: '0.375rem 0.75rem', borderRadius: '0.5rem', border: `1px solid ${period === p.value ? 'var(--color-accent)' : 'var(--color-border)'}`, background: period === p.value ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent', color: period === p.value ? 'var(--color-accent)' : 'var(--color-text-muted)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>{p.label}</button>
          ))}
        </div>

        {/* Header status */}
        <Panel title={`Report status — ${getPeriodLabel(period)}`} description={`${start} to ${end}. Trading journal report. Not a tax statement.`}>
          <Stack gap="sm">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge variant={reportStatus === 'Complete' ? 'success' : reportStatus === 'No trades' ? 'neutral' : 'warning'}>{reportStatus}</Badge>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {dailySummary.tradingDays} trading day{dailySummary.tradingDays !== 1 ? 's' : ''} · {dailySummary.completeDays} complete · {dailySummary.pendingDays} pending charges
              </span>
            </div>
          </Stack>
        </Panel>

        {/* Period statement */}
        <Panel title="Period statement">
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
        </Panel>

        {/* Charges statement */}
        <Panel title="Charges statement" description="Net P&L is final only when all trading days have recorded charges.">
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

        {/* Daily breakdown */}
        <Panel title="Daily breakdown" description="Per-day P&L and charges status.">
          {dailyRows.length === 0 ? (
            <EmptyState title="No trading days" description="No data for this period." />
          ) : (
            <DailyTable rows={dailyRows} />
          )}
        </Panel>

        {/* Setup summary */}
        {setups.length > 0 && (
          <Panel title="Setup summary"><GroupTable rows={setups} /></Panel>
        )}

        {/* Market summary */}
        {(exchanges.length > 0 || products.length > 0) && (
          <Panel title="Market & product summary">
            <Grid minColumnWidth="18rem">
              {exchanges.length > 0 && <GroupTable rows={exchanges} title="Exchange" />}
              {products.length > 0 && <GroupTable rows={products} title="Product type" />}
            </Grid>
          </Panel>
        )}

        {/* Review summary */}
        <Panel title="Review summary">
          <Grid minColumnWidth="10rem">
            <MetricCard label="Reviewed" value={<Value value={String(perf.reviewedCount)} />} />
            <MetricCard label="Pending" value={<Value value={String(perf.pendingReview)} />} />
            <MetricCard label="Reviewed %" value={<PercentValue value={perf.closedTrades > 0 ? (perf.reviewedCount / perf.closedTrades) * 100 : null} />} />
          </Grid>
        </Panel>

        {/* Disclaimer */}
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem 0' }}>
          Trading journal report. Not a tax statement. CSV/PDF export will be added later.
        </p>
      </Stack>
    </Page>
  )
}

function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DailyTable({ rows }: { rows: ReturnType<typeof buildDailyRows> }) {
  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ width: '100%', minWidth: '32rem', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
          <th style={{ padding: '0.375rem 0' }}>Date</th>
          <th style={{ padding: '0.375rem 0' }}>Trades</th>
          <th style={{ padding: '0.375rem 0' }}>Gross P&L</th>
          <th style={{ padding: '0.375rem 0' }}>Charges</th>
          <th style={{ padding: '0.375rem 0' }}>Net P&L</th>
          <th style={{ padding: '0.375rem 0' }}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date} style={{ borderTop: '1px solid var(--color-border)' }}>
            <td style={{ padding: '0.5rem 0', fontWeight: 500 }}>{r.date}</td>
            <td style={{ padding: '0.5rem 0' }}>{r.tradeCount}</td>
            <td style={{ padding: '0.5rem 0', color: r.grossPnl == null ? 'var(--color-text-muted)' : r.grossPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{fmtMoney(r.grossPnl)}</td>
            <td style={{ padding: '0.5rem 0' }}>{r.chargesRecorded ? fmtMoney(r.totalCharges) : <span style={{ color: 'var(--color-text-muted)' }}>Pending</span>}</td>
            <td style={{ padding: '0.5rem 0', color: r.netPnl == null ? 'var(--color-text-muted)' : r.netPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)' }}>{r.chargesRecorded ? fmtMoney(r.netPnl) : <span style={{ color: 'var(--color-text-muted)' }}>Pending</span>}</td>
            <td style={{ padding: '0.5rem 0' }}>
              {r.status === 'complete' ? <Badge variant="success">Complete</Badge> : r.status === 'pending' ? <Badge variant="warning">Pending</Badge> : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
      </table>
    </div>
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
