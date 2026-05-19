import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, Circle, ChevronRight, RotateCcw, Calendar,
  TrendingUp, Activity, Brain, Target, BarChart3,
  AlertTriangle, Sparkles, BookOpen, Loader2, ChevronLeft,
  Sunrise, Sunset, GitCompare,
} from 'lucide-react'
import { DailyJournalForm } from '@/components/journal/DailyJournalForm'
import { useDailyDashboard, useAdvancePhase, useUpdateWorkflow, useResetWorkflow } from '@/hooks/usePerformanceOS'
import { getCurrentWeeklyReview, updateWeeklyReview, getCurrentMonthlyReview, updateMonthlyReview } from '@/lib/endpoints'
import { useJournalQuery, useCreateJournalMutation, useUpdateJournalMutation, useWeeklyJournalStatsQuery, useWeeklyJournalsQuery } from '@/hooks/useJournalMutation'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { formatCurrency, formatPrice, formatDate } from '@/utils/format'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/utils'
import type { WorkflowPhase, DailyDashboard } from '@/types/performanceOs'
import type { DailyJournal, ApiTrade } from '@/types'

type ViewTab = 'daily' | 'weekly' | 'monthly'
type ReviewSubTab = 'journal' | 'compare'

const PHASE_META: Record<WorkflowPhase, { label: string; icon: typeof Activity; color: string; desc: string }> = {
  pre_market: { label: 'Pre-Market', icon: Brain, color: 'text-blue-400', desc: 'Prepare, plan, and set your rules' },
  execution: { label: 'Execution', icon: Target, color: 'text-amber-400', desc: 'Trade with discipline and focus' },
  review: { label: 'Review', icon: BookOpen, color: 'text-emerald-400', desc: 'Grade your trades and extract lessons' },
  behavior: { label: 'Behavior', icon: Activity, color: 'text-purple-400', desc: 'Check emotions, discipline, and patterns' },
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function computeDailyStats(trades: ApiTrade[], date: string) {
  const dayTrades = trades.filter((t) => {
    if (!t.entry_time) return false
    return t.entry_time.split('T')[0] === date
  })
  const count = dayTrades.length
  const totalPnl = dayTrades.reduce((sum, t) => sum + (t.pnl ? parseFloat(t.pnl) : 0), 0)
  const wins = dayTrades.filter((t) => t.pnl && parseFloat(t.pnl) > 0)
  const winRate = count > 0 ? Math.round((wins.length / count) * 100) : 0
  const rValues = dayTrades.map((t) => t.r_multiple ? parseFloat(t.r_multiple) : 0).filter((r) => !isNaN(r) && r !== 0)
  const avgR = rValues.length > 0 ? parseFloat((rValues.reduce((a, b) => a + b, 0) / rValues.length).toFixed(2)) : 0
  return { tradeCount: count, totalPnl, winRate, avgR }
}

function PhaseStepper({ phase, progress }: { phase: WorkflowPhase; progress: DailyDashboard['phase_progress'] }) {
  const phases: WorkflowPhase[] = ['pre_market', 'execution', 'review', 'behavior']
  return (
    <div className="flex items-center gap-1">
      {phases.map((p, i) => {
        const meta = PHASE_META[p]
        const Icon = meta.icon
        const done = progress.completed[i]
        const current = p === phase
        const future = phases.indexOf(phase) > i
        return (
          <div key={p} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              current ? `bg-accent/15 ${meta.color} ring-1 ring-accent/30` :
              done ? 'bg-profit-muted/20 text-profit' :
              future ? 'bg-bg-elevated/30 text-text-faint' :
              'bg-bg-elevated/30 text-text-muted'
            }`}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : current ? <Icon className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{meta.label}</span>
            </div>
            {i < phases.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-text-faint" />}
          </div>
        )
      })}
    </div>
  )
}

function PreMarketPhase({ dashboard, dateStr }: { dashboard: DailyDashboard; dateStr: string }) {
  const updateMut = useUpdateWorkflow(dateStr)
  const advanceMut = useAdvancePhase(dateStr)
  const wf = dashboard.workflow!
  const checklist = wf.checklist_items
  const checkedCount = checklist.filter(c => c.checked).length
  const allChecked = checklist.every(c => c.checked)
  const regime = dashboard.market_regime

  const toggleItem = (id: string) => {
    const updated = checklist.map(c => c.id === id ? { ...c, checked: !c.checked } : c)
    updateMut.mutate({ checklist_items: updated })
  }

  return (
    <div className="space-y-5 animate-card-in">
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Market Regime</h4>
        {regime ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] text-text-faint uppercase">Nifty</div>
              <div className="text-sm font-data text-text-heading">{regime.nifty_close ? formatPrice(Number(regime.nifty_close)) : '—'}</div>
              <div className={`text-xs font-data ${regime.nifty_trend === 'bullish' ? 'text-profit' : regime.nifty_trend === 'bearish' ? 'text-loss' : 'text-text-muted'}`}>
                {regime.nifty_trend ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-faint uppercase">Regime</div>
              <div className="text-sm font-data text-text-heading capitalize">{regime.nifty_regime?.replace('_', ' ') ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-faint uppercase">VIX</div>
              <div className="text-sm font-data text-text-heading">{regime.india_vix ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-faint uppercase">A/D</div>
              <div className="text-sm font-data text-text-heading">{regime.advance_count ?? 0}/{regime.decline_count ?? 0}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-muted py-3">
            <AlertTriangle className="w-4 h-4" />
            <span>No market data for today. Seed from Market Context page.</span>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Pre-Market Checklist</h4>
          <span className="text-xs font-data text-text-muted">{checkedCount}/{checklist.length}</span>
        </div>
        <div className="space-y-2">
          {checklist.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                item.checked ? 'border-profit/20 bg-profit-muted/10' : 'border-border hover:border-accent/30'
              }`}
            >
              {item.checked
                ? <CheckCircle2 className="w-4 h-4 text-profit mt-0.5 shrink-0" />
                : <Circle className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
              }
              <span className={`text-sm ${item.checked ? 'text-text-muted line-through' : 'text-text-heading'}`}>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="h-2 flex-1 bg-bg-elevated rounded-full overflow-hidden mr-3">
            <div className="h-full bg-profit rounded-full transition-all" style={{ width: `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%` }} />
          </div>
          <button
            onClick={() => advanceMut.mutate()}
            disabled={!allChecked || advanceMut.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-40"
          >
            {advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Start Trading
          </button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Pre-Market Notes</h4>
        <textarea
          value={wf.pre_market_notes ?? ''}
          onChange={(e) => updateMut.mutate({ pre_market_notes: e.target.value })}
          placeholder="Market context, key levels, setups to watch, risk plan..."
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y min-h-[120px]"
        />
      </div>
    </div>
  )
}

function ExecutionPhase({ dashboard, dateStr }: { dashboard: DailyDashboard; dateStr: string }) {
  const updateMut = useUpdateWorkflow(dateStr)
  const advanceMut = useAdvancePhase(dateStr)
  const wf = dashboard.workflow!
  const positions = dashboard.open_positions
  const todayTrades = dashboard.today_trades

  return (
    <div className="space-y-5 animate-card-in">
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Open Positions</h4>
        {positions.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted">No open positions</div>
        ) : (
          <div className="space-y-2">
            {positions.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-elevated/30">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-heading">{p.symbol}</span>
                  <span className="text-xs text-text-muted ml-2">{p.setup}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-muted">Entry {formatPrice(Number(p.entry_price))} x {p.quantity}</div>
                  {p.stop_price && <div className="text-xs text-loss">SL {formatPrice(Number(p.stop_price))}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Today's Trades</h4>
        {todayTrades.length === 0 ? (
          <div className="py-6 text-center text-sm text-text-muted">No trades yet today</div>
        ) : (
          <div className="space-y-2">
            {todayTrades.map(t => {
              const pnl = t.pnl ? Number(t.pnl) : null
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-bg-elevated/30">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-text-heading">{t.symbol}</span>
                    <span className="text-xs text-text-muted ml-2">{t.setup}</span>
                  </div>
                  <div className="text-right">
                    {pnl !== null && (
                      <div className={`text-sm font-data ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                      </div>
                    )}
                    <div className="text-xs text-text-muted">{t.exit_price ? 'Closed' : 'Open'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Intraday Notes</h4>
        <textarea
          value={wf.intraday_notes ?? ''}
          onChange={(e) => updateMut.mutate({ intraday_notes: e.target.value })}
          placeholder="Trade observations, emotion check-ins, rule violations..."
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y min-h-[80px]"
        />
      </div>

      <button
        onClick={() => advanceMut.mutate()}
        disabled={advanceMut.isPending}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50"
      >
        {advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
        Move to Review Phase
      </button>
    </div>
  )
}

function CompareView({ journal }: { journal: DailyJournal | null | undefined }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex items-center gap-2 text-[.8125rem] font-medium text-text-heading mb-3">
          <Sunrise className="w-[15px] h-[15px] text-accent" /> Pre-market
        </div>
        <div className="text-[.8125rem] text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed">
          {journal?.pre_trade_notes || <span className="text-text-muted italic">No pre-market notes yet.</span>}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-bg-card p-5">
        <div className="flex items-center gap-2 text-[.8125rem] font-medium text-text-heading mb-3">
          <Sunset className="w-[15px] h-[15px] text-accent" /> Post-market
        </div>
        <div className="text-[.8125rem] text-text whitespace-pre-wrap min-h-[12rem] leading-relaxed">
          {journal?.post_trade_notes || <span className="text-text-muted italic">No post-market notes yet.</span>}
        </div>
      </div>
    </div>
  )
}

function ReviewPhase({ dashboard, dateStr }: { dashboard: DailyDashboard; dateStr: string }) {
  const advanceMut = useAdvancePhase(dateStr)
  const addToast = useToastStore((s) => s.addToast)
  const [subTab, setSubTab] = useState<ReviewSubTab>('journal')

  const { data: journal, isLoading: journalLoading } = useJournalQuery(dateStr)
  const { data: tradesData } = useTradesQuery()
  const createMutation = useCreateJournalMutation()
  const updateMutation = useUpdateJournalMutation()

  const summaryStats = useMemo(() => {
    const trades = tradesData?.items ?? []
    return computeDailyStats(trades, dateStr)
  }, [tradesData?.items, dateStr])

  const handleSave = useCallback((payload: import('@/types').DailyJournalPayload) => {
    if (journal) {
      updateMutation.mutate(
        { date: dateStr, payload },
        {
          onSuccess: () => addToast({ title: 'Journal updated', message: `Entry for ${formatDate(dateStr)} saved.`, variant: 'success' }),
          onError: (err: Error) => addToast({ title: 'Save failed', message: err.message, variant: 'error' }),
        }
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => addToast({ title: 'Journal created', message: `Entry for ${formatDate(dateStr)} saved.`, variant: 'success' }),
        onError: (err: Error) => addToast({ title: 'Save failed', message: err.message, variant: 'error' }),
      })
    }
  }, [journal, dateStr, createMutation, updateMutation, addToast])

  const isSaving = createMutation.isPending || updateMutation.isPending
  const todayPnl = dashboard.today_trades.filter(t => t.exit_price).reduce((s, t) => s + (t.pnl ? Number(t.pnl) : 0), 0)

  return (
    <div className="space-y-5 animate-card-in">
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Post-Market Summary</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Trades</div>
            <div className="text-lg font-data font-semibold text-text-heading">{dashboard.today_trades.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Closed</div>
            <div className="text-lg font-data font-semibold text-text-heading">{dashboard.today_trades.filter(t => t.exit_price).length}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Day P&amp;L</div>
            <div className={`text-lg font-data font-semibold ${todayPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(todayPnl)}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-bg-card border border-border overflow-x-auto">
        {([
          { id: 'journal' as ReviewSubTab, label: 'Journal Entry', icon: BookOpen },
          { id: 'compare' as ReviewSubTab, label: 'Compare', icon: GitCompare },
        ]).map(t => {
          const Icon = t.icon
          const active = subTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap',
                active ? 'bg-accent-muted text-accent font-semibold' : 'text-text hover:text-text-heading'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {subTab === 'journal' && !journalLoading && (
        <DailyJournalForm journal={journal} date={dateStr} onSave={handleSave} isSaving={isSaving} summaryStats={summaryStats} />
      )}
      {subTab === 'journal' && journalLoading && (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <Loader2 className="w-5 h-5 text-accent animate-spin mx-auto" />
          <p className="text-sm text-text-muted mt-3">Loading entry...</p>
        </div>
      )}
      {subTab === 'compare' && <CompareView journal={journal} />}

      <button
        onClick={() => advanceMut.mutate()}
        disabled={advanceMut.isPending}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50"
      >
        {advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
        Move to Behavior Phase
      </button>
    </div>
  )
}

function BehaviorPhase({ dashboard }: { dashboard: DailyDashboard }) {
  const { data: journal } = useJournalQuery(new Date().toISOString().slice(0, 10))
  const ds = dashboard.discipline_score
  const wf = dashboard.workflow!

  return (
    <div className="space-y-5 animate-card-in">
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Execution Discipline</h4>
        {ds ? (
          <div className="flex items-center gap-4">
            <div className="text-3xl font-data font-bold text-accent">{ds.avg_execution_grade.toFixed(1)}</div>
            <div>
              <div className="text-sm text-text-heading">Avg Execution Grade</div>
              <div className="text-xs text-text-muted">Based on {ds.total_graded} graded trades (30d)</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-muted py-2">Grade trades to see discipline score</div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Today's Journal</h4>
        {journal ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
              <div className="text-[10px] text-text-faint uppercase">Mood</div>
              <div className="text-lg font-data font-semibold text-text-heading">{journal.mood_rating ?? '—'}/5</div>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
              <div className="text-[10px] text-text-faint uppercase">Discipline</div>
              <div className="text-lg font-data font-semibold text-text-heading">{journal.discipline_rating ?? '—'}/5</div>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 col-span-2">
              <div className="text-[10px] text-text-faint uppercase">Rules Followed</div>
              <div className="text-sm text-text-heading whitespace-pre-wrap mt-1">{journal.rules_followed || '—'}</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-muted py-2">Fill in your journal from the Review phase</div>
        )}
      </div>

      {wf.behavior_done ? (
        <div className="bg-profit-muted/10 border border-profit/20 rounded-2xl p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-profit mx-auto mb-2" />
          <div className="text-sm font-medium text-profit">Day Complete</div>
          <div className="text-xs text-text-muted mt-1">You ran your full trading workflow today.</div>
        </div>
      ) : (
        <div className="bg-accent-muted/10 border border-accent/20 rounded-2xl p-5 text-center">
          <Sparkles className="w-10 h-10 text-accent mx-auto mb-2" />
          <div className="text-sm font-medium text-accent">Behavior review done?</div>
          <div className="text-xs text-text-muted mt-1">Check your emotions, patterns, and rules.</div>
        </div>
      )}
    </div>
  )
}

const PHASE_COMPONENTS: Record<WorkflowPhase, typeof PreMarketPhase> = {
  pre_market: PreMarketPhase,
  execution: ExecutionPhase,
  review: ReviewPhase,
  behavior: BehaviorPhase,
}

export function PerformanceOSPage() {
  const [viewTab, setViewTab] = useState<ViewTab>('daily')
  const [selectedDate, setSelectedDate] = useState<string>(toISODate(new Date()))
  const today = new Date().toISOString().slice(0, 10)
  const isToday = selectedDate === today

  const { data: dashboard, isLoading } = useDailyDashboard(isToday ? undefined : selectedDate)
  const resetMut = useResetWorkflow(today)
  const qc = useQueryClient()

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(toISODate(d))
  }

  if (isLoading && isToday) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
  }

  const wf = dashboard?.workflow
  const phase = wf?.phase ?? 'pre_market'
  const PhaseComponent = PHASE_COMPONENTS[phase]

  return (
    <div className="space-y-[var(--page-gap)] px-[var(--page-px)] py-[var(--page-py)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-text-heading">Performance OS</h1>
          <p className="text-sm text-text-muted mt-0.5">Your daily trading workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text-heading hover:bg-bg-card transition-all cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 pl-8 pr-2 rounded-lg border border-border bg-bg-card text-xs text-text-heading font-data focus:outline-none focus:border-accent/40 cursor-pointer [color-scheme:dark]"
            />
          </div>
          <button onClick={() => shiftDate(1)} className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-text-muted hover:text-text-heading hover:bg-bg-card transition-all cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
          {isToday && (
            <button
              onClick={() => { resetMut.mutate(); qc.invalidateQueries({ queryKey: ['daily-dashboard'] }) }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-elevated/50 text-text-muted hover:text-text-heading hover:bg-bg-card-h transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {([
          { id: 'daily' as ViewTab, label: 'Daily', icon: Calendar },
          { id: 'weekly' as ViewTab, label: 'Weekly', icon: BarChart3 },
          { id: 'monthly' as ViewTab, label: 'Monthly', icon: TrendingUp },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setViewTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              viewTab === t.id ? 'bg-accent text-white' : 'bg-bg-elevated/50 text-text-muted hover:text-text-heading hover:bg-bg-card-h'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {viewTab === 'daily' && dashboard && (
        <>
          <PhaseStepper phase={phase} progress={dashboard.phase_progress} />
          <PhaseComponent dashboard={dashboard} dateStr={selectedDate} />
        </>
      )}

      {viewTab === 'daily' && !dashboard && (
        <div className="bg-card rounded-2xl border border-border p-5 text-center">
          <div className="text-sm text-text-muted">Loading workflow...</div>
        </div>
      )}

      {viewTab === 'weekly' && <WeeklyReviewSection selectedDate={selectedDate} onSelectDate={setSelectedDate} />}
      {viewTab === 'monthly' && <MonthlyReviewSection />}
    </div>
  )
}

function WeeklyReviewSection({ selectedDate, onSelectDate }: { selectedDate: string; onSelectDate: (d: string) => void }) {
  const qc = useQueryClient()
  const { data: review, isLoading: reviewLoading } = useQuery({
    queryKey: ['weekly-review', 'current'],
    queryFn: () => getCurrentWeeklyReview(),
  })
  const updateMut = useMutation({
    mutationFn: (data: import('@/types/performanceOs').WeeklyReviewUpdate) => updateWeeklyReview(review?.week_start ?? '', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-review'] }) },
  })

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

  const { data: stats } = useWeeklyJournalStatsQuery(mondayISO)
  const { data: weekJournals } = useWeeklyJournalsQuery(mondayISO)

  if (reviewLoading && !review) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>

  const pnl = review ? Number(review.total_pnl) : 0

  return (
    <div className="space-y-5 animate-card-in">
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-heading">
            Week of {review?.week_start ? new Date(review.week_start + 'T00:00:00').toLocaleDateString() : formatDate(monday)}
          </h3>
          <span className={`text-lg font-data font-semibold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Trades</div>
            <div className="text-lg font-data font-semibold text-text-heading">{review?.total_trades ?? stats?.trade_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Win Rate</div>
            <div className="text-lg font-data font-semibold text-text-heading">{review?.win_rate ?? (stats ? `${parseFloat(stats.win_rate).toFixed(1)}%` : '—')}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Best Setup</div>
            <div className="text-sm font-medium text-text-heading">{review?.top_setup ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">P&amp;L</div>
            <div className={`text-lg font-data font-semibold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {weekDays.map(wd => {
            const iso = toISODate(wd)
            const isToday = iso === toISODate(new Date())
            const isSelected = iso === selectedDate
            return (
              <button
                key={iso}
                onClick={() => onSelectDate(iso)}
                className={cn(
                  'text-left rounded-xl border p-3 transition-all cursor-pointer',
                  isSelected ? 'border-accent/30 bg-accent-muted' : 'border-border bg-bg-card hover:border-medium'
                )}
              >
                <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1">
                  {wd.toLocaleDateString('en-IN', { weekday: 'short' })}
                </div>
                <div className={cn('text-sm font-semibold', isToday ? 'text-accent' : 'text-text-heading')}>
                  {formatDate(wd)}
                </div>
                <div className="text-[10px] text-text-muted mt-1">{isToday ? 'Today' : 'Tap to open'}</div>
              </button>
            )
          })}
        </div>
      </div>

      {review?.daily_breakdown && review.daily_breakdown.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Daily Breakdown</h4>
          <div className="space-y-1.5">
            {review.daily_breakdown.map(d => (
              <div key={d.date} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-bg-elevated/30">
                <span className="text-xs text-text-muted">{new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span className="text-xs text-text-muted">{d.trades} trades</span>
                <span className={`text-xs font-data ${Number(d.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>{Number(d.pnl) >= 0 ? '+' : ''}{formatCurrency(Number(d.pnl))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weekJournals && weekJournals.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Journal Entries</h4>
          <div className="space-y-2">
            {weekJournals.map(j => (
              <button
                key={j.id}
                onClick={() => onSelectDate(j.date)}
                className="w-full text-left rounded-lg border border-border bg-bg-card hover:bg-accent-muted transition-all cursor-pointer p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-heading">{j.date} — {new Date(j.date).toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                  {j.mood_rating != null && <span className="text-[10px] text-text-muted">Mood: {j.mood_rating}/5</span>}
                </div>
                {j.lessons_learned && <p className="text-xs text-text-muted mt-1 line-clamp-2">{j.lessons_learned}</p>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Key Lessons</h4>
        <textarea
          value={review?.key_lessons ?? ''}
          onChange={(e) => updateMut.mutate({ key_lessons: e.target.value })}
          placeholder="What did you learn this week?"
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y min-h-[80px]"
        />
      </div>
    </div>
  )
}

function MonthlyReviewSection() {
  const qc = useQueryClient()
  const { data: review, isLoading } = useQuery({
    queryKey: ['monthly-review', 'current'],
    queryFn: () => getCurrentMonthlyReview(),
  })
  const updateMut = useMutation({
    mutationFn: (data: import('@/types/performanceOs').MonthlyReviewUpdate) => updateMonthlyReview(review?.month ?? '', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monthly-review'] }) },
  })

  if (isLoading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>

  const pnl = review ? Number(review.total_pnl) : 0
  return (
    <div className="space-y-5 animate-card-in">
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-heading">{review?.month ?? 'Current Month'}</h3>
          <span className={`text-lg font-data font-semibold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Trades</div>
            <div className="text-lg font-data font-semibold text-text-heading">{review?.total_trades ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Win Rate</div>
            <div className="text-lg font-data font-semibold text-text-heading">{review?.win_rate ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Profit Factor</div>
            <div className="text-lg font-data font-semibold text-text-heading">{review?.profit_factor ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Avg R</div>
            <div className="text-lg font-data font-semibold text-text-heading">{review?.avg_r ?? '—'}</div>
          </div>
        </div>
      </div>

      {review?.setup_performance && review.setup_performance.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Setup Performance</h4>
          <div className="space-y-1.5">
            {review.setup_performance.map(s => (
              <div key={s.setup} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-bg-elevated/30">
                <span className="text-sm text-text-heading">{s.setup}</span>
                <span className="text-xs text-text-muted">{s.count} trades</span>
                <span className={`text-xs font-data ${Number(s.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>{Number(s.pnl) >= 0 ? '+' : ''}{formatCurrency(Number(s.pnl))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {review?.top_emotions && review.top_emotions.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5">
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Emotional Landscape</h4>
          <div className="flex flex-wrap gap-2">
            {review.top_emotions.map(e => (
              <span key={e.emotion} className="text-xs px-3 py-1 rounded-full bg-accent-muted/15 text-accent capitalize">{e.emotion} ({e.count})</span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Month Notes</h4>
        <textarea
          value={review?.notes ?? ''}
          onChange={(e) => updateMut.mutate({ notes: e.target.value })}
          placeholder="Reflections, goals progress, next month targets..."
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y min-h-[80px]"
        />
      </div>
    </div>
  )
}