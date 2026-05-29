import { useState, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { useSwipeTabs } from '@/hooks/useSwipeTabs'
import { formatDate, formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'
import { DailyJournalForm } from '@/components/journal/DailyJournalForm'
import {
  useJournalQuery,
  useCreateJournalMutation,
  useUpdateJournalMutation,
  useWeeklyJournalStatsQuery,
  useWeeklyJournalsQuery,
} from '@/hooks/useJournalMutation'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import type { DailyJournal, ApiTrade } from '@/types'
import { useToastStore } from '@/store/toastStore'
import {
  Calendar,
  Sunrise,
  Sunset,
  GitCompare,
  LayoutList,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { ErrorState } from '@/components/ui/StateComponents'
import { EmptyState, LoadingState } from '@/components/ui'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function computeDailyStats(trades: ApiTrade[], date: string) {
  const dayTrades = trades.filter((t) => {
    if (!t.entry_time) return false
    const entryDate = t.entry_time.split('T')[0]
    return entryDate === date
  })

  const count = dayTrades.length
  const totalPnl = dayTrades.reduce((sum, t) => {
    const pnl = t.pnl ? parseFloat(t.pnl) : 0
    return sum + (isNaN(pnl) ? 0 : pnl)
  }, 0)

  const winningTrades = dayTrades.filter((t) => {
    const pnl = t.pnl ? parseFloat(t.pnl) : 0
    return pnl > 0
  })
  const winRate = count > 0 ? Math.round((winningTrades.length / count) * 100) : 0

  const rValues = dayTrades
    .map((t) => (t.r_multiple ? parseFloat(t.r_multiple) : 0))
    .filter((r) => !isNaN(r) && r !== 0)
  const avgR =
    rValues.length > 0
      ? parseFloat((rValues.reduce((a, b) => a + b, 0) / rValues.length).toFixed(2))
      : 0

  return { tradeCount: count, totalPnl, winRate, avgR }
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'journal' | 'compare' | 'weekly'

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'journal', label: 'Journal Entry', icon: BookOpen },
  { id: 'compare', label: 'Compare', icon: GitCompare },
  { id: 'weekly', label: 'Weekly', icon: LayoutList },
]

// ---------------------------------------------------------------------------
// Compare view
// ---------------------------------------------------------------------------

function CompareView({ journal }: { journal: DailyJournal | null | undefined }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <div className="flex items-center gap-2 text-[length:var(--text-sm)] font-medium text-text-heading mb-3">
          <Sunrise className="w-[15px] h-[15px] text-accent" />
          Pre-market
        </div>
        <div className="text-[length:var(--text-sm)] text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed">
          {journal?.pre_trade_notes || (
            <span className="text-text-muted italic">No pre-market notes yet.</span>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-bg-card p-5">
        <div className="flex items-center gap-2 text-[length:var(--text-sm)] font-medium text-text-heading mb-3">
          <Sunset className="w-[15px] h-[15px] text-accent" />
          Post-market
        </div>
        <div className="text-[length:var(--text-sm)] text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed">
          {journal?.post_trade_notes || (
            <span className="text-text-muted italic">No post-market notes yet.</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly view
// ---------------------------------------------------------------------------

function WeeklyView({ selectedDate, onSelectDate, onSwitchToJournal }: { selectedDate: string; onSelectDate: (d: string) => void; onSwitchToJournal: () => void }) {
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
      <div className="flex items-center gap-3">
        <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">
          Week of {formatDate(monday)}
        </h3>
        {isLoading && <Loader2 className="w-[14px] h-[14px] text-accent animate-spin" />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {weekDays.map((wd) => {
          const iso = toISODate(wd)
          const isToday = iso === toISODate(new Date())
          const isSelected = iso === selectedDate
          return (
            <button
              key={iso}
              onClick={() => onSelectDate(iso)}
              className={cn(
                'text-left rounded-xl border p-3.5 transition-all cursor-pointer',
                isSelected
                  ? 'border-accent/30 bg-accent-muted'
                  : 'border-border bg-bg-card hover:border-medium'
              )}
            >
              <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.05em] font-medium mb-1.5">
                {wd.toLocaleDateString('en-IN', { weekday: 'short' })}
              </div>
              <div
                className={cn(
                  'text-[.875rem] font-semibold',
                  isToday ? 'text-accent' : 'text-text-heading'
                )}
              >
                {formatDate(wd)}
              </div>
              <div className="mt-1.5 text-[length:var(--text-xs)] text-text-muted">
                {isToday ? 'Today' : 'Tap to open'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Stats rollup */}
      {stats ? (
        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-b border-border">
            <div className="px-[var(--cell-px)] py-[var(--cell-py)]">
              <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Trades</div>
              <div className="font-data text-lg font-semibold text-text-heading">{stats.trade_count}</div>
            </div>
            <div className="px-[var(--cell-px)] py-[var(--cell-py)]">
              <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">P&amp;L</div>
              <div className={cn(
                'font-data text-lg font-semibold',
                parseFloat(stats.total_pnl) >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {formatCurrency(stats.total_pnl)}
              </div>
            </div>
            <div className="px-[var(--cell-px)] py-[var(--cell-py)]">
              <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Win Rate</div>
              <div className="font-data text-lg font-semibold text-text-heading">{parseFloat(stats.win_rate).toFixed(1)}%</div>
            </div>
            <div className="px-[var(--cell-px)] py-[var(--cell-py)]">
              <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Avg R</div>
              <div className="font-data text-lg font-semibold text-text-heading">{parseFloat(stats.avg_r).toFixed(2)}R</div>
            </div>
          </div>

          {/* Daily journal entries for the week */}
          <div className="p-4">
            <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-2">Daily Entries</div>
            {weekJournals && weekJournals.length > 0 ? (
              <div className="space-y-2">
                {weekJournals.map((j) => (
                  <button
                    key={j.id}
                    onClick={() => { onSwitchToJournal(); onSelectDate(j.date); }}
                    className="w-full text-left rounded-lg border border-border bg-bg-card hover:bg-accent-muted transition-all cursor-pointer p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[length:var(--text-sm)] font-medium text-text-heading">
                        {j.date} — {new Date(j.date).toLocaleDateString('en-IN', { weekday: 'long' })}
                      </span>
                      {j.mood_rating != null && (
                        <span className="text-[length:var(--text-xs)] text-text-muted">
                          Mood: {'⭐'.repeat(j.mood_rating)}
                        </span>
                      )}
                    </div>
                    {j.lessons_learned && (
                      <p className="text-[.75rem] text-text-muted mt-1 line-clamp-2">{j.lessons_learned}</p>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-border py-4 text-center">
                <p className="text-[.75rem] text-text-muted">
                  No journal entries this week.{' '}
                  <button
                    type="button"
                    onClick={onSwitchToJournal}
                    className="text-accent underline underline-offset-2 hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-sm"
                  >
                    Write one
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      ) : !isLoading ? (
        <div className="rounded-xl border-2 border-dashed border-border py-5 px-4">
          <p className="text-[.75rem] text-text-muted leading-relaxed">
            No trades this week. Stats will appear when you start trading.
          </p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// JournalPage
// ---------------------------------------------------------------------------

export function JournalPage() {
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()))
  const [activeTab, setActiveTab] = useState<TabId>('journal')
  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()

  const {
    data: journal,
    isLoading,
    isError,
    error,
  } = useJournalQuery(selectedDate)

  const { data: tradesData } = useTradesQuery()

  const createMutation = useCreateJournalMutation()
  const updateMutation = useUpdateJournalMutation()

  const summaryStats = useMemo(() => {
    const trades = tradesData?.items ?? []
    return computeDailyStats(trades, selectedDate)
  }, [tradesData?.items, selectedDate])

  const handleSave = useCallback(
    (payload: import('@/types').DailyJournalPayload) => {
      if (journal) {
        updateMutation.mutate(
          { date: selectedDate, payload },
          {
            onSuccess: () =>
              addToast({
                title: 'Journal updated',
                message: `Entry for ${formatDate(selectedDate)} saved.`,
                variant: 'success',
              }),
            onError: (err) =>
              addToast({
                title: 'Save failed',
                message: err.message,
                variant: 'error',
              }),
          }
        )
      } else {
        createMutation.mutate(payload, {
          onSuccess: () =>
            addToast({
              title: 'Journal created',
              message: `Entry for ${formatDate(selectedDate)} saved.`,
              variant: 'success',
            }),
          onError: (err) =>
            addToast({
              title: 'Save failed',
              message: err.message,
              variant: 'error',
            }),
        })
      }
    },
    [journal, selectedDate, createMutation, updateMutation, addToast]
  )

  const isSaving = createMutation.isPending || updateMutation.isPending

  const shiftDate = useCallback(
    (days: number) => {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() + days)
      setSelectedDate(toISODate(d))
    },
    [selectedDate]
  )

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['journal'] })
    await queryClient.invalidateQueries({ queryKey: ['trades'] })
  }, [queryClient])

  const swipeTabs = useSwipeTabs({
    tabs: ['journal', 'compare', 'weekly'],
    activeTab,
    onTabChange: (tab) => setActiveTab(tab as TabId),
  })

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <PageShell className="space-y-[var(--page-gap)]" {...swipeTabs.handlers}>
      {/* Header */}
      <PageHeader
        title="Journal"
        subtitle="Situational awareness - pre-market plan and post-market reflection."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="flex items-center justify-center w-[2.25rem] h-[2.25rem] rounded-lg border border-border text-text-muted hover:text-text-heading hover:bg-bg-card transition-all cursor-pointer"
              aria-label="Previous date"
            >
              <ChevronLeft className="w-[15px] h-[15px]" />
            </button>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-text-muted pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-[2.25rem] pl-[2.125rem] pr-2.5 rounded-lg border border-border bg-bg-card text-[length:var(--text-sm)] text-text-heading font-data focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/15 transition-all cursor-pointer [color-scheme:dark]"
              />
            </div>
            <button
              onClick={() => shiftDate(1)}
              className="flex items-center justify-center w-[2.25rem] h-[2.25rem] rounded-lg border border-border text-text-muted hover:text-text-heading hover:bg-bg-card transition-all cursor-pointer"
              aria-label="Next date"
            >
              <ChevronRight className="w-[15px] h-[15px]" />
            </button>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-bg-card px-4 py-3">
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Trades</div>
          <div className="font-data text-lg font-semibold text-text-heading">
            {summaryStats.tradeCount}
          </div>
        </div>
        <div className={cn(
          'rounded-xl border px-4 py-3',
          summaryStats.totalPnl >= 0
            ? 'border-profit/10 bg-bg-card'
            : 'border-loss/10 bg-bg-card'
        )}>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">P&amp;L</div>
          <div className={cn(
            'font-data text-lg font-semibold',
            summaryStats.totalPnl >= 0 ? 'text-profit' : 'text-loss'
          )}>
            {summaryStats.totalPnl >= 0 ? '+' : ''}
            {formatCurrency(summaryStats.totalPnl)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-bg-card px-4 py-3">
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Win Rate</div>
          <div className="font-data text-lg font-semibold text-text-heading">
            {summaryStats.winRate}%
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-bg-card px-4 py-3">
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Avg R</div>
          <div className="font-data text-lg font-semibold text-text-heading">
            {summaryStats.avgR}R
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {!isLoading && !isError && !journal && activeTab === 'journal' && (
        <EmptyState title="No journal entry yet" message="Fill form below and save your notes for this day." compact />
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-bg-card border border-border overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-[length:var(--text-sm)] font-medium transition-all cursor-pointer whitespace-nowrap',
                active
                  ? 'bg-accent-muted text-accent font-semibold'
                  : 'text-text hover:text-text-heading'
              )}
            >
              <Icon className="w-[15px] h-[15px]" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Loading */}
      {isLoading && activeTab === 'journal' && (
        <LoadingState variant="skeleton" />
      )}

      {/* Error */}
      {isError && activeTab === 'journal' && (
        <ErrorState
          title="Failed to load journal entry"
          message={error instanceof Error ? error.message : 'Unknown error'}
        />
      )}

      {/* Tab content */}
      {!isLoading && !isError && activeTab === 'journal' && (
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
        <WeeklyView selectedDate={selectedDate} onSelectDate={setSelectedDate} onSwitchToJournal={() => setActiveTab('journal')} />
      )}
    </PageShell>
    </PullToRefresh>
  )
}
