import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Download, FileText, NotebookPen, PieChart, TrendingUp } from 'lucide-react'
import { getMonthlyReport, getWeeklyReport } from '@/lib/endpoints'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, formatMetricPercent, parseDecimal } from '@/utils/format'
import { ErrorState, SectionSkeleton } from '@/components/ui/StateComponents'
import { MetricCard, PageHeader, SectionHeader } from '@/components/ui/SharedUI'
import type { DeterministicReportPayload } from '@/types'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function weekStartIso(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

function monthIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function downloadText(name: string, type: string, content: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function toCsv(report: DeterministicReportPayload) {
  const rows = [
    ['Symbol', 'Setup', 'Entry Time', 'Exit Time', 'Quantity', 'P&L', 'R Multiple', 'Exit Reason'],
    ...report.trades.map((trade) => [
      trade.symbol,
      trade.setup,
      trade.entry_time ?? '',
      trade.exit_time ?? '',
      trade.quantity,
      trade.pnl ?? '',
      trade.r_multiple ?? '',
      trade.exit_reason ?? '',
    ]),
  ]
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function toHtml(report: DeterministicReportPayload) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${report.period} report</title></head><body><h1>${report.period} report</h1><p>${report.start_date} to ${report.end_date}</p><h2>Summary</h2><pre>${JSON.stringify(report.summary, null, 2)}</pre><h2>Trades</h2><pre>${JSON.stringify(report.trades, null, 2)}</pre></body></html>`
}

export function ReportsPage() {
  const [mode, setMode] = useState<'weekly' | 'monthly'>('weekly')
  const [weekStart, setWeekStart] = useState(weekStartIso())
  const [month, setMonth] = useState(monthIso())
  const queryKey = mode === 'weekly' ? ['report-weekly', weekStart] : ['report-monthly', month]
  const reportQuery = useQuery({
    queryKey,
    queryFn: () => mode === 'weekly' ? getWeeklyReport(weekStart) : getMonthlyReport(month),
    placeholderData: (previousData) => previousData,
  })
  const report = reportQuery.data
  const fileStem = useMemo(() => report ? `tradingos-${report.period}-${report.start_date}` : `tradingos-report-${todayIso()}`, [report])

  if (reportQuery.isLoading && !report) return <SectionSkeleton rows={6} />
  if (reportQuery.isError) return <ErrorState title="Report unavailable" message="The deterministic report could not be loaded." onRetry={() => reportQuery.refetch()} />

  return (
    <div className="min-h-screen p-[var(--page-px)]">
      <PageHeader
        title="Reports"
        subtitle="Reproducible weekly and monthly reports built from deterministic analytics first."
        right={reportQuery.isFetching ? <span className="text-xs font-data text-accent">Syncing</span> : null}
      />

      <div className="mt-[var(--page-gap)] flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-bg-elevated p-1">
          {(['weekly', 'monthly'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-colors',
                mode === item ? 'bg-card text-text-heading' : 'text-text-muted hover:text-text-heading'
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode === 'weekly' ? (
            <input className="rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-heading outline-none" type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} />
          ) : (
            <input className="rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-heading outline-none" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          )}
          {report && (
            <div className="flex flex-wrap gap-2">
              <ExportButton label="JSON" onClick={() => downloadText(`${fileStem}.json`, 'application/json', JSON.stringify(report, null, 2))} />
              <ExportButton label="CSV" onClick={() => downloadText(`${fileStem}.csv`, 'text/csv', toCsv(report))} />
              <ExportButton label="HTML" onClick={() => downloadText(`${fileStem}.html`, 'text/html', toHtml(report))} />
            </div>
          )}
        </div>
      </div>

      {report && (
        <>
          <div className="mt-[var(--page-gap)] grid gap-[var(--page-gap)] md:grid-cols-4">
            <MetricCard icon={TrendingUp} label="Net P&L" value={formatCurrency(report.summary.net_pnl)} tone={parseDecimal(report.summary.net_pnl) >= 0 ? 'profit' : 'loss'} />
            <MetricCard icon={FileText} label="Trades" value={report.summary.trade_count} detail={`${report.summary.closed_count} closed`} />
            <MetricCard icon={BarChart3} label="Win Rate" value={formatMetricPercent(report.summary.win_rate, 1)} tone="accent" />
            <MetricCard icon={PieChart} label="Profit Factor" value={report.summary.profit_factor ?? '-'} />
          </div>

          <div className="mt-[var(--page-gap)] grid gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_24rem]">
            <section className={CARD}>
              <SectionHeader icon={FileText} title={`${mode === 'weekly' ? 'Weekly' : 'Monthly'} Report`} subtitle={`${formatDate(report.start_date)} to ${formatDate(report.end_date)}`} />
              <div className="mt-[var(--page-gap)] overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-text-muted">
                    <tr className="border-b border-border">
                      <th className="py-2">Symbol</th>
                      <th className="py-2">Setup</th>
                      <th className="py-2">Entry</th>
                      <th className="py-2 text-right">Qty</th>
                      <th className="py-2 text-right">P&L</th>
                      <th className="py-2 text-right">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.trades.map((trade) => (
                      <tr key={trade.id} className="border-b border-border/60">
                        <td className="py-3 font-semibold text-text-heading">{trade.symbol}</td>
                        <td className="py-3 text-text-muted">{trade.setup}</td>
                        <td className="py-3 text-text-muted">{trade.entry_time ? formatDate(trade.entry_time) : '-'}</td>
                        <td className="py-3 text-right font-data text-text-muted">{trade.quantity}</td>
                        <td className={cn('py-3 text-right font-data', parseDecimal(trade.pnl) >= 0 ? 'text-profit' : 'text-loss')}>{formatCurrency(trade.pnl ?? '0')}</td>
                        <td className="py-3 text-right font-data text-text-muted">{trade.r_multiple ?? '-'}</td>
                      </tr>
                    ))}
                    {report.trades.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-text-muted">No trades in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-[var(--page-gap)]">
              <section className={CARD}>
                <SectionHeader icon={TrendingUp} title="Setup Report" />
                <div className="mt-[var(--page-gap)] space-y-2">
                  {report.setup_report.length === 0 ? (
                    <div className="text-sm text-text-muted">No setup data.</div>
                  ) : report.setup_report.map((setup) => (
                    <div key={setup.setup} className="rounded-xl border border-border bg-bg-elevated p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-text-heading">{setup.setup}</div>
                        <div className={cn('font-data text-sm', parseDecimal(setup.net_pnl) >= 0 ? 'text-profit' : 'text-loss')}>{formatCurrency(setup.net_pnl)}</div>
                      </div>
                      <div className="mt-1 text-[10px] text-text-muted">{setup.trade_count} trades · {formatMetricPercent(setup.win_rate, 1)} win rate</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={CARD}>
                <SectionHeader icon={NotebookPen} title="Behavior Report" />
                <div className="mt-[var(--page-gap)] grid grid-cols-2 gap-2 text-sm">
                  <BehaviorStat label="Journal days" value={report.behavior_report.journal_days} />
                  <BehaviorStat label="Rule breaks" value={report.behavior_report.rule_violation_days} />
                  <BehaviorStat label="Avg discipline" value={report.behavior_report.avg_discipline_rating ?? '-'} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {report.behavior_report.top_emotions.map((emotion) => (
                    <span key={emotion.emotion} className="rounded-md border border-border px-2 py-1 text-[10px] font-data text-text-muted">
                      {emotion.emotion} · {emotion.count}
                    </span>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-xs font-semibold text-text-muted hover:text-text-heading">
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function BehaviorStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-3">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className="mt-1 font-data text-base text-text-heading">{value}</div>
    </div>
  )
}
