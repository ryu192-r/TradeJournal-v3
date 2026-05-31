import { useState, useCallback, useMemo, type ElementType } from 'react'
import {
  Calendar, Sunrise, Sunset, GitCompare, Loader2,
  ChevronLeft, ChevronRight, BookOpen,
} from 'lucide-react'
import { ErrorState, CardSkeleton } from '@/components/ui/StateComponents'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/ui/SharedUI'
import { DailyJournalForm } from '@/components/journal/DailyJournalForm'
import {
  useJournalQuery,
  useCreateJournalMutation,
  useUpdateJournalMutation,
  useWeeklyJournalStatsQuery,
  useWeeklyJournalsQuery,
} from '@/hooks/useJournalMutation'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { formatDate, formatCurrency } from '@/utils/format'
import { getTradeSessionDate } from '@/utils/tradeDates'
import { cn } from '@/lib/utils'
import { useToastStore } from '@/store/toastStore'
import type { DailyJournal, ApiTrade } from '@/types'

type TabId = 'notes' | 'compare' | 'weekly'

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeDailyStats(trades: ApiTrade[], date: string) {
  const dayTrades = trades.filter((t) => getTradeSessionDate(t) === date)
  const count = dayTrades.length
  const totalPnl = dayTrades.reduce((sum, t) => sum + (t.pnl ? parseFloat(t.pnl) : 0), 0)
  const wins = dayTrades.filter((t) => t.pnl && parseFloat(t.pnl) > 0)
  const winRate = count > 0 ? Math.round((wins.length / count) * 100) : 0
  const rValues = dayTrades.map((t) => t.r_multiple ? parseFloat(t.r_multiple) : 0).filter((r) => !isNaN(r) && r !== 0)
  const avgR = rValues.length > 0 ? parseFloat((rValues.reduce((a, b) => a + b, 0) / rValues.length).toFixed(2)) : 0
  return { tradeCount: count, totalPnl, winRate, avgR }
}

function CompareView({ journal }: { journal: DailyJournal | null | undefined }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted mb-3">
          <Sunrise className="w-3.5 h-3.5 text-accent" /> Pre-market perception
        </div>
        <div className="text-sm text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed rounded-xl bg-bg-elevated/20 p-4">
          {journal?.pre_trade_notes || <span className="text-text-faint italic">No pre-market notes saved yet.</span>}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted mb-3">
          <Sunset className="w-3.5 h-3.5 text-accent" /> Post-market reality
        </div>
        <div className="text-sm text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed rounded-xl bg-bg-elevated/20 p-4">
          {journal?.post_trade_notes || <span className="text-text-faint italic">No post-market notes saved yet.</span>}
        </div>
      </div>
    </div>
  )
}

function WeeklyView({ selectedDate, onSelectDate }: { selectedDate: string; onSelectDate: (d: string) => void }) {
  const d = new Date(selectedDate)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(new Date(d).setDate(diff))
  const mondayISO = toISODate(monday)

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const cd = new Date(monday)
    cd.setDate(monday.getDate() + i)
    return cd
  })

  const { data: stats, isLoading } = useWeeklyJournalStatsQuery(mondayISO)
  const { data: weekJournals } = useWeeklyJournalsQuery(mondayISO)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">Week of {formatDate(monday)}</h3>
        {isLoading && <Loader2 className="w-4 h-4 text-accent animate-spin" />}
      </div>

      <div className="flex items-center gap-4 text-sm font-data">
        {stats && (
          <>
            <div><span className="text-[length:var(--text-xs)] text-text-muted block">Trades</span><span className="text-text-heading font-medium">{stats.trade_count}</span></div>
            <div><span className="text-[length:var(--text-xs)] text-text-muted block">P&L</span><span className={cn('font-medium', parseFloat(stats.total_pnl) >= 0 ? 'text-profit' : 'text-loss')}>{formatCurrency(stats.total_pnl)}</span></div>
            <div><span className="text-[length:var(--text-xs)] text-text-muted block">Win Rate</span><span className="text-text-heading font-medium">{parseFloat(stats.win_rate).toFixed(1)}%</span></div>
            <div><span className="text-[length:var(--text-xs)] text-text-muted block">Avg R</span><span className="text-text-heading font-medium">{parseFloat(stats.avg_r).toFixed(2)}R</span></div>
          </>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {weekDays.map(wd => {
          const iso = toISODate(wd)
          const isToday = iso === toISODate(new Date())
          const isSelected = iso === selectedDate
          const hasJournal = weekJournals?.some(j => j.date === iso)
          return (
            <button
              key={iso}
              onClick={() => onSelectDate(iso)}
              className={cn(
                'rounded-lg p-2.5 text-center transition-all cursor-pointer',
                isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-bg-elevated/50 text-text-muted',
              )}
            >
              <div className="text-[10px] uppercase tracking-wider mb-0.5">{wd.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
              <div className={cn('text-sm font-semibold', isToday ? 'text-accent' : 'text-text-heading')}>{wd.getDate()}</div>
              {hasJournal && <div className="w-1 h-1 rounded-full bg-accent mx-auto mt-1" />}
            </button>
          )
        })}
      </div>

      {weekJournals && weekJournals.length > 0 && (
        <div>
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Entries</span>
          <div className="mt-2 divide-y divide-border/50">
            {weekJournals.map(j => (
              <button
                key={j.id}
                onClick={() => onSelectDate(j.date)}
                className="w-full text-left py-2.5 cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[length:var(--text-xs)] font-medium text-text-heading group-hover:text-accent transition-colors">
                    {new Date(j.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  {j.mood_rating != null && <span className="text-[10px] text-text-faint">{j.mood_rating}/5</span>}
                </div>
                {j.lessons_learned && <p className="text-[length:var(--text-xs)] text-text-faint mt-0.5 line-clamp-1">{j.lessons_learned}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function DailySANotesPage() {
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()))
  const [activeTab, setActiveTab] = useState<TabId>('notes')
  const addToast = useToastStore((s) => s.addToast)

  const { data: journal, isLoading, isError, error, refetch } = useJournalQuery(selectedDate)
  const { data: tradesData } = useTradesQuery()
  const createMutation = useCreateJournalMutation()
  const updateMutation = useUpdateJournalMutation()

  const summaryStats = useMemo(() => {
    const trades = tradesData?.items ?? []
    return computeDailyStats(trades, selectedDate)
  }, [tradesData?.items, selectedDate])

  const handleSave = useCallback((payload: import('@/types').DailyJournalPayload) => {
    if (journal) {
      updateMutation.mutate(
        { date: selectedDate, payload },
        {
          onSuccess: () => addToast({ title: 'SA Notes updated', message: `${formatDate(selectedDate)} saved.`, variant: 'success' }),
          onError: (err: Error) => addToast({ title: 'Save failed', message: err.message, variant: 'error' }),
        }
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => addToast({ title: 'SA Notes created', message: `${formatDate(selectedDate)} saved.`, variant: 'success' }),
        onError: (err: Error) => addToast({ title: 'Save failed', message: err.message, variant: 'error' }),
      })
    }
  }, [journal, selectedDate, createMutation, updateMutation, addToast])

  const isSaving = createMutation.isPending || updateMutation.isPending

  const shiftDate = useCallback((days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(toISODate(d))
  }, [selectedDate])

  const tabs: { id: TabId; label: string; icon: ElementType }[] = [
    { id: 'notes', label: 'SA Notes', icon: BookOpen },
    { id: 'compare', label: 'Compare', icon: GitCompare },
    { id: 'weekly', label: 'Weekly', icon: Calendar },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Daily SA Notes"
        subtitle="Situational awareness — pre-market perception &amp; post-market reality"
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftDate(-1)}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-border text-text-muted hover:text-text-heading transition-all cursor-pointer"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-7 pl-7 pr-2 rounded-lg border border-border bg-bg-card text-[length:var(--text-xs)] text-text-heading font-data focus:outline-none focus:border-accent/40 cursor-pointer [color-scheme:dark]"
                aria-label="Select date"
              />
            </div>
            <button
              onClick={() => shiftDate(1)}
              className="flex items-center justify-center w-7 h-7 rounded-lg border border-border text-text-muted hover:text-text-heading transition-all cursor-pointer"
              aria-label="Next day"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Stats strip */}
      <div className="rounded-2xl border border-border bg-card p-[var(--page-px)] animate-card-in">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-data">
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Trades</span><span className="text-text-heading font-medium">{summaryStats.tradeCount}</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">P&L</span><span className={cn('font-medium', summaryStats.totalPnl >= 0 ? 'text-profit' : 'text-loss')}>{summaryStats.totalPnl >= 0 ? '+' : ''}{formatCurrency(summaryStats.totalPnl)}</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Win Rate</span><span className="text-text-heading font-medium">{summaryStats.winRate}%</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Avg R</span><span className="text-text-heading font-medium">{summaryStats.avgR}R</span></div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-bg-card border border-border overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[length:var(--text-xs)] font-medium transition-all cursor-pointer whitespace-nowrap',
                active ? 'bg-accent-muted text-accent font-semibold' : 'text-text hover:text-text-heading',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && activeTab === 'notes' && (
        <CardSkeleton height="h-64" />
      )}

      {/* Error */}
      {isError && activeTab === 'notes' && (
        <ErrorState
          title="Failed to load notes"
          message={error instanceof Error ? error.message : 'Could not load journal entry'}
          onRetry={() => refetch()}
        />
      )}

      {/* Tab content */}
      {!isLoading && !isError && activeTab === 'notes' && (
        <DailyJournalForm
          journal={journal}
          date={selectedDate}
          onSave={handleSave}
          isSaving={isSaving}
          summaryStats={summaryStats}
        />
      )}

      {activeTab === 'compare' && <CompareView journal={journal} />}

      {activeTab === 'weekly' && (
        <WeeklyView selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setActiveTab('notes') }} />
      )}
    </PageShell>
  )
}