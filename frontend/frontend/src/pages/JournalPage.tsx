import { useState, useCallback, useMemo } from 'react'
import { formatDate } from '@/utils/format'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
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
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text-heading">
          <Sunrise className="w-4 h-4 text-accent" />
          Pre-market
        </div>
        <div className="text-sm text-text whitespace-pre-wrap min-h-[12rem]">
          {journal?.pre_trade_notes || (
            <span className="text-text-muted italic">No pre-market notes yet.</span>
          )}
        </div>
      </GlassCard>
      <GlassCard className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text-heading">
          <Sunset className="w-4 h-4 text-accent" />
          Post-market
        </div>
        <div className="text-sm text-text whitespace-pre-wrap min-h-[12rem]">
          {journal?.post_trade_notes || (
            <span className="text-text-muted italic">No post-market notes yet.</span>
          )}
        </div>
      </GlassCard>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-heading">
          Week of {formatDate(monday)}
        </h3>
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
              className={
                'text-left rounded-xl border p-3 transition-all duration-hover cursor-pointer ' +
                (isSelected
                  ? 'border-accent/40 bg-accent-muted'
                  : 'border-border bg-bg-card/40 hover:bg-bg-elevated/40')
              }
            >
              <div className="text-xs text-text-muted mb-1">
                {wd.toLocaleDateString('en-IN', { weekday: 'short' })}
              </div>
              <div className={isToday ? 'text-accent font-medium' : 'text-text-heading text-sm'}>
                {formatDate(wd)}
              </div>
              <div className="mt-2 text-xs text-text-muted">
                {isToday ? 'Today' : 'Tap to open'}
              </div>
            </button>
          )
        })}
      </div>
      <GlassCard padding="sm" className="bg-bg-elevated/30 border-dashed">
        <p className="text-xs text-text-muted">
          Weekly rollup with stats (total P&amp;L, win rate, avg R) will appear here once backend aggregates are ready.
        </p>
      </GlassCard>
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-heading">Daily Journal</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Situational awareness — pre-market plan and post-market reflection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton variant="ghost" size="sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </GlassButton>
          <GlassInput
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            icon={<Calendar className="w-4 h-4" />}
            className="w-44"
          />
          <GlassButton variant="ghost" size="sm" onClick={() => shiftDate(1)}>
            <ChevronRight className="w-4 h-4" />
          </GlassButton>
        </div>
      </div>

      {/* Empty state hint */}
      {!isLoading && !isError && !journal && activeTab === 'journal' && (
        <GlassCard className="py-4 text-center border-dashed border-border">
          <p className="text-sm text-text-muted">
            No journal entry for {formatDate(selectedDate)} yet. Fill in the form below and hit Save.
          </p>
        </GlassCard>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg bg-bg-card/40 border border-border overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap ' +
                (active
                  ? 'bg-accent-muted text-accent border border-accent/20'
                  : 'text-text hover:text-text-heading hover:bg-bg-elevated/50')
              }
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Loading / Error */}
      {isLoading && activeTab === 'journal' && (
        <GlassCard className="py-12 text-center">
          <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto" />
          <p className="text-sm text-text-muted mt-3">Loading journal entry...</p>
        </GlassCard>
      )}

      {isError && activeTab === 'journal' && (
        <GlassCard className="py-8 text-center border-loss/30">
          <AlertCircle className="w-6 h-6 text-loss mx-auto" />
          <p className="text-sm text-text-heading mt-2">Failed to load journal entry.</p>
          <p className="text-xs text-text-muted mt-1">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </GlassCard>
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
