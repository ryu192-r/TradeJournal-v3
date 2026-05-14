import { useState, useCallback, useMemo } from 'react'
import { formatDate, formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'
import { DailyJournalForm } from '@/components/journal/DailyJournalForm'
import {
  useJournalQuery,
  useCreateJournalMutation,
  useUpdateJournalMutation,
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
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react'

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
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex items-center gap-2 text-[.8125rem] font-medium text-text-heading mb-3">
          <Sunrise className="w-[15px] h-[15px] text-accent" />
          Pre-market
        </div>
        <div className="text-[.8125rem] text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed">
          {journal?.pre_trade_notes || (
            <span className="text-text-muted italic">No pre-market notes yet.</span>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex items-center gap-2 text-[.8125rem] font-medium text-text-heading mb-3">
          <Sunset className="w-[15px] h-[15px] text-accent" />
          Post-market
        </div>
        <div className="text-[.8125rem] text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed">
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

function WeeklyView({ selectedDate, onSelectDate }: { selectedDate: string; onSelectDate: (d: string) => void }) {
  const d = new Date(selectedDate)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const cd = new Date(monday)
    cd.setDate(monday.getDate() + i)
    return cd
  })

  return (
    <div className="space-y-5">
      <h3 className="text-[.8125rem] font-medium text-text-heading">
        Week of {formatDate(monday)}
      </h3>
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
              <div className="text-[.6875rem] text-text-muted uppercase tracking-[.05em] font-medium mb-1.5">
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
              <div className="mt-1.5 text-[.6875rem] text-text-muted">
                {isToday ? 'Today' : 'Tap to open'}
              </div>
            </button>
          )
        })}
      </div>
      <div className="rounded-xl border-2 border-dashed border-border py-5 px-4">
        <p className="text-[.75rem] text-text-muted leading-relaxed">
          Weekly rollup with stats (total P&amp;L, win rate, avg R) will appear here once backend aggregates are ready.
        </p>
      </div>
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

  const {
    data: journal,
    isLoading,
    isError,
    error,
  } = useJournalQuery(selectedDate)

  const { data: tradesData } = useTradesQuery()
  const trades = tradesData?.items ?? []

  const createMutation = useCreateJournalMutation()
  const updateMutation = useUpdateJournalMutation()

  const summaryStats = useMemo(() => {
    return computeDailyStats(trades, selectedDate)
  }, [trades, selectedDate])

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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-4 sm:p-6 sm:px-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-[-.01rem] leading-tight text-text-heading">
            Journal
          </h1>
          <p className="text-[.8125rem] text-text-muted mt-1.5 leading-relaxed">
            Situational awareness — pre-market plan &amp; post-market reflection.
          </p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(-1)}
            className="flex items-center justify-center w-[2.25rem] h-[2.25rem] rounded-lg border border-border text-text-muted hover:text-text-heading hover:bg-bg-card transition-all cursor-pointer"
          >
            <ChevronLeft className="w-[15px] h-[15px]" />
          </button>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-text-muted pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-[2.25rem] pl-[2.125rem] pr-2.5 rounded-lg border border-border bg-bg-card text-[.8125rem] text-text-heading font-data focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/15 transition-all cursor-pointer [color-scheme:dark]"
            />
          </div>
          <button
            onClick={() => shiftDate(1)}
            className="flex items-center justify-center w-[2.25rem] h-[2.25rem] rounded-lg border border-border text-text-muted hover:text-text-heading hover:bg-bg-card transition-all cursor-pointer"
          >
            <ChevronRight className="w-[15px] h-[15px]" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
          <div className="text-[.6875rem] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Trades</div>
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
          <div className="text-[.6875rem] text-text-muted uppercase tracking-[.06em] font-medium mb-1">P&amp;L</div>
          <div className={cn(
            'font-data text-lg font-semibold',
            summaryStats.totalPnl >= 0 ? 'text-profit' : 'text-loss'
          )}>
            {summaryStats.totalPnl >= 0 ? '+' : ''}
            {formatCurrency(summaryStats.totalPnl)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
          <div className="text-[.6875rem] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Win Rate</div>
          <div className="font-data text-lg font-semibold text-text-heading">
            {summaryStats.winRate}%
          </div>
        </div>
        <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
          <div className="text-[.6875rem] text-text-muted uppercase tracking-[.06em] font-medium mb-1">Avg R</div>
          <div className="font-data text-lg font-semibold text-text-heading">
            {summaryStats.avgR}R
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {!isLoading && !isError && !journal && activeTab === 'journal' && (
        <div className="rounded-xl border-2 border-dashed border-border py-8 text-center">
          <p className="text-[.8125rem] text-text-muted">
            No journal entry yet.{' '}
            <span className="text-text font-medium">Fill in the form below</span>
            {' '}and hit Save.
          </p>
        </div>
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
                'flex items-center gap-2 px-3.5 py-2 rounded-lg text-[.8125rem] font-medium transition-all cursor-pointer whitespace-nowrap',
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
        <div className="rounded-xl border border-border bg-bg-card py-12 text-center">
          <Loader2 className="w-5 h-5 text-accent animate-spin mx-auto" />
          <p className="text-sm text-text-muted mt-3">Loading entry…</p>
        </div>
      )}

      {/* Error */}
      {isError && activeTab === 'journal' && (
        <div className="rounded-xl border border-loss/25 bg-bg-card py-8 text-center">
          <AlertCircle className="w-5 h-5 text-loss mx-auto" />
          <p className="text-sm text-text-heading mt-2">Failed to load journal entry.</p>
          <p className="text-xs text-text-muted mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
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
        <WeeklyView selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      )}
    </div>
  )
}
