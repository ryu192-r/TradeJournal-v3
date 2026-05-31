import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Image, NotebookPen, TrendingUp } from 'lucide-react'
import { getCalendarMonth } from '@/lib/endpoints'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate, parseDecimal } from '@/utils/format'
import { weekdayFromSessionDate } from '@/utils/tradeDates'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui'
import { MetricCard, PageHeader, SectionHeader } from '@/components/ui/SharedUI'
import type { CalendarDay } from '@/types'
import { PageShell } from '@/components/layout/PageShell'
import { useAppStore } from '@/store/appStore'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, offset: number) {
  const [year, mon] = month.split('-').map(Number)
  return monthKey(new Date(year, mon - 1 + offset, 1))
}

function pnlTone(value: string) {
  const n = parseDecimal(value)
  if (n > 0) return 'text-profit'
  if (n < 0) return 'text-loss'
  return 'text-text-muted'
}

export function CalendarPage() {
  const [month, setMonth] = useState(monthKey(new Date()))
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['calendar-month', month],
    queryFn: () => getCalendarMonth(month),
    placeholderData: (previousData) => previousData,
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const selectedDay = useMemo(
    () => data?.days.find((day) => day.date === (selectedDate ?? data.days.find((d) => d.trade_count > 0 || d.journal_done)?.date)),
    [data, selectedDate]
  )

  if (isLoading && !data) return <PageShell><LoadingState variant="page" /></PageShell>
  if (isError) return <PageShell><ErrorState title="Calendar unavailable" message="The month aggregate could not be loaded." onRetry={() => refetch()} /></PageShell>

  const days = data?.days ?? []
  const firstWeekday = days[0] ? weekdayFromSessionDate(days[0].date) : 0
  const blanks = Array.from({ length: firstWeekday })

  return (
    <PageShell>
      <PageHeader
        title="Calendar"
        subtitle="Month-level review surface for P&L, discipline, journal coverage, and warning days."
        right={<span className="text-xs font-data text-accent">{isFetching ? 'Syncing' : month}</span>}
      />

      <div className="mt-[var(--page-gap)] flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-xl border border-border bg-bg-elevated p-1">
          <button className="rounded-lg p-2 text-text-muted hover:bg-card hover:text-text-heading" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="min-w-[9rem] bg-transparent px-2 text-sm font-data text-text-heading outline-none"
            aria-label="Select month"
          />
          <button className="rounded-lg p-2 text-text-muted hover:bg-card hover:text-text-heading" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-[var(--page-gap)] grid gap-[var(--page-gap)] md:grid-cols-4">
        <MetricCard icon={TrendingUp} label="Month P&L" value={formatCurrency(data?.summary.net_pnl ?? '0')} tone={parseDecimal(data?.summary.net_pnl) >= 0 ? 'profit' : 'loss'} />
        <MetricCard icon={CalendarDays} label="Trades" value={data?.summary.trade_count ?? 0} detail={`${data?.summary.closed_count ?? 0} closed`} />
        <MetricCard icon={NotebookPen} label="Journal Days" value={data?.summary.journal_days ?? 0} tone="accent" />
        <MetricCard icon={AlertTriangle} label="Warning Days" value={data?.summary.warning_days ?? 0} tone={(data?.summary.warning_days ?? 0) > 0 ? 'warning' : 'neutral'} />
      </div>

      <div className="mt-[var(--page-gap)] grid gap-[var(--page-gap)] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className={CARD}>
          <SectionHeader icon={CalendarDays} title="Monthly P&L Calendar" subtitle="One backend aggregate call for all day cells." />
          <div className="mt-[var(--page-gap)] grid grid-cols-7 gap-2 text-center text-[10px] font-data uppercase tracking-wider text-text-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {blanks.map((_, index) => <div key={`blank-${index}`} className="min-h-[7rem] rounded-xl border border-border/40 bg-bg-elevated/40" />)}
            {days.map((day) => (
              <DayCell key={day.date} day={day} selected={selectedDay?.date === day.date} onClick={() => setSelectedDate(day.date)} />
            ))}
          </div>
        </section>

        <DayDetail day={selectedDay} />
      </div>
    </PageShell>
  )
}

function DayCell({ day, selected, onClick }: { day: CalendarDay; selected: boolean; onClick: () => void }) {
  const hasActivity = day.trade_count > 0 || day.journal_done || day.workflow_done
  return (
    <button
      onClick={onClick}
      className={cn(
        'min-h-[5rem] sm:min-h-[7rem] rounded-xl border p-1.5 sm:p-2 text-left transition-all',
        selected ? 'border-accent bg-accent-muted' : 'border-border bg-bg-elevated hover:border-text-muted',
        !hasActivity && 'opacity-60 sm:opacity-70'
      )}
      aria-label={`${new Date(`${day.date}T00:00:00`).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} — ${formatCurrency(day.net_pnl)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-data text-[10px] sm:text-xs text-text-heading">{Number(day.date.slice(8, 10))}</span>
        <div className="flex items-center gap-0.5 sm:gap-1">
          {day.journal_done && <NotebookPen className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-accent" />}
          {day.warnings.length > 0 && <AlertTriangle className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-gold" />}
        </div>
      </div>
      <div className={cn('mt-1.5 sm:mt-3 font-data text-[10px] sm:text-sm font-semibold tabular-nums truncate', pnlTone(day.net_pnl))}>
        {formatCurrency(day.net_pnl)}
      </div>
      <div className="mt-0.5 text-[9px] sm:text-[10px] text-text-muted truncate">
        {day.trade_count} trades
      </div>
      {day.discipline_rating && (
        <div className="mt-1 sm:mt-2 inline-flex rounded-md border border-border px-1 py-0.5 text-[8px] sm:text-[10px] font-data text-text-muted">
          D {day.discipline_rating}/5
        </div>
      )}
    </button>
  )
}

function DayDetail({ day }: { day?: CalendarDay }) {
  const setActiveView = useAppStore((s) => s.setActiveView)
  if (!day) {
    return (
      <aside className={CARD}>
        <EmptyState title="No day selected" message="Select an active day to inspect trades, journal notes, emotions, and review signals." />
      </aside>
    )
  }

  return (
    <aside className={CARD}>
      <SectionHeader
        icon={CalendarDays}
        title={formatDate(day.date)}
        subtitle={`${day.trade_count} trades · ${formatCurrency(day.net_pnl)}`}
        badge={day.workflow_done ? <CheckCircle2 className="h-4 w-4 text-profit" /> : null}
      />

      <div className="mt-[var(--page-gap)] space-y-4">
        {day.warnings.length > 0 && (
          <div className="rounded-xl border border-gold/25 bg-gold-faint p-3">
            <div className="text-xs font-semibold text-gold">Warnings</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {day.warnings.map((warning) => (
                <span key={warning} className="rounded-md border border-gold/25 px-2 py-1 text-[10px] font-data text-gold">{warning}</span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Trades</h3>
          <div className="mt-2 space-y-2">
            {day.trades.length === 0 ? (
              <div className="text-sm text-text-muted">No trades recorded.</div>
            ) : day.trades.map((trade) => (
              <div key={trade.id} className="rounded-xl border border-border bg-bg-elevated p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-text-heading">{trade.symbol}</div>
                    <div className="text-[10px] text-text-muted">{trade.setup ?? 'Unassigned setup'}</div>
                  </div>
                  <div className={cn('font-data text-sm tabular-nums', pnlTone(trade.pnl ?? '0'))}>{formatCurrency(trade.pnl ?? '0')}</div>
                </div>
                {trade.chart_image_count > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-text-muted">
                    <Image className="h-3 w-3" />
                    {trade.chart_image_count} screenshots
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Journal</h3>
          <div className="mt-2 rounded-xl border border-border bg-bg-elevated p-3 text-sm text-text-muted">
            {day.journal ? (
              <div className="space-y-2">
                {day.journal.pre_trade_notes && <p>{day.journal.pre_trade_notes}</p>}
                {day.journal.post_trade_notes && <p>{day.journal.post_trade_notes}</p>}
                {day.journal.rules_violated && <p className="text-gold">Rules violated: {day.journal.rules_violated}</p>}
                {day.journal.lessons_learned && <p>Lesson: {day.journal.lessons_learned}</p>}
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm text-text-muted mb-2">No journal entry for this day.</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveView('sa-notes')}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            Open journal for {formatDate(day.date)}
          </button>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Emotions</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {day.emotions.length === 0 ? (
              <span className="text-sm text-text-muted">No emotion logs.</span>
            ) : day.emotions.map((emotion) => (
              <span key={emotion.id} className="rounded-md border border-border px-2 py-1 text-[10px] font-data text-text-muted">
                {emotion.emotion}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
