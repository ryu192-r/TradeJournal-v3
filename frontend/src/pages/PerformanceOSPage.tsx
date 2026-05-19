import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, Circle, ChevronRight, RotateCcw, Calendar,
  TrendingUp, Activity, Brain, Target, BarChart3,
  AlertTriangle, Sparkles, BookOpen, Loader2,
} from 'lucide-react'
import { useDailyDashboard, useAdvancePhase, useUpdateWorkflow, useResetWorkflow } from '@/hooks/usePerformanceOS'
import { getCurrentWeeklyReview, updateWeeklyReview, getCurrentMonthlyReview, updateMonthlyReview } from '@/lib/endpoints'
import { formatCurrency, formatPrice } from '@/utils/format'
import type { WorkflowPhase, DailyDashboard } from '@/types/performanceOs'

type ViewTab = 'daily' | 'weekly' | 'monthly'

const PHASE_META: Record<WorkflowPhase, { label: string; icon: typeof Activity; color: string; desc: string }> = {
  pre_market: { label: 'Pre-Market', icon: Brain, color: 'text-blue-400', desc: 'Prepare, plan, and set your rules' },
  execution: { label: 'Execution', icon: Target, color: 'text-amber-400', desc: 'Trade with discipline and focus' },
  review: { label: 'Review', icon: BookOpen, color: 'text-emerald-400', desc: 'Grade your trades and extract lessons' },
  behavior: { label: 'Behavior', icon: Activity, color: 'text-purple-400', desc: 'Check emotions, discipline, and patterns' },
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
      {/* Market Regime */}
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
            <span>No market data for today. Seed data from Market Context page.</span>
          </div>
        )}
      </div>

      {/* Checklist */}
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
            <div
              className="h-full bg-profit rounded-full transition-all"
              style={{ width: `${checklist.length ? (checkedCount / checklist.length) * 100 : 0}%` }}
            />
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

      {/* Notes */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Pre-Market Notes</h4>
        <textarea
          value={wf.pre_market_notes ?? ''}
          onChange={(e) => updateMut.mutate({ pre_market_notes: e.target.value })}
          placeholder="Market bias, setups to watch, risk plan..."
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y min-h-[80px]"
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
      {/* Open Positions */}
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
                  <div className="text-xs text-text-muted">Entry {formatPrice(Number(p.entry_price))} × {p.quantity}</div>
                  {p.stop_price && <div className="text-xs text-loss">SL {formatPrice(Number(p.stop_price))}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Trades */}
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

      {/* Intraday Notes */}
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

function ReviewPhase({ dashboard, dateStr }: { dashboard: DailyDashboard; dateStr: string }) {
  const updateMut = useUpdateWorkflow(dateStr)
  const advanceMut = useAdvancePhase(dateStr)
  const wf = dashboard.workflow!
  const todayTrades = dashboard.today_trades
  const closedTrades = todayTrades.filter(t => t.exit_price)

  return (
    <div className="space-y-5 animate-card-in">
      {/* Trade Performance Summary */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Post-Market Summary</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Trades</div>
            <div className="text-lg font-data font-semibold text-text-heading">{todayTrades.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Closed</div>
            <div className="text-lg font-data font-semibold text-text-heading">{closedTrades.length}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Day P&amp;L</div>
            <div className={`text-lg font-data font-semibold ${
              closedTrades.reduce((s, t) => s + (t.pnl ? Number(t.pnl) : 0), 0) >= 0 ? 'text-profit' : 'text-loss'
            }`}>
              {formatCurrency(closedTrades.reduce((s, t) => s + (t.pnl ? Number(t.pnl) : 0), 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Mood & Discipline Rating */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-4">How Was Your Day?</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-text-muted block mb-2">Mood Rating</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => updateMut.mutate({ mood_rating: n })}
                  className={`w-10 h-10 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    wf.mood_rating === n ? 'bg-accent text-white scale-105' : 'bg-bg-elevated/50 text-text-muted hover:bg-bg-card-h'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-2">Discipline Rating</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => updateMut.mutate({ discipline_rating: n })}
                  className={`w-10 h-10 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                    wf.discipline_rating === n ? 'bg-accent text-white scale-105' : 'bg-bg-elevated/50 text-text-muted hover:bg-bg-card-h'
                  }`}
                >{n}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Post-Market Notes */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Lessons Learned</h4>
        <textarea
          value={wf.post_market_notes ?? ''}
          onChange={(e) => updateMut.mutate({ post_market_notes: e.target.value })}
          placeholder="What worked? What didn't? What will I do differently tomorrow?"
          className="w-full rounded-xl border border-border bg-bg-elevated/50 px-4 py-3 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent/50 resize-y min-h-[100px]"
        />
      </div>

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
  const wf = dashboard.workflow!
  const ds = dashboard.discipline_score
  const journal = dashboard.journal

  return (
    <div className="space-y-5 animate-card-in">
      {/* Discipline Score */}
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

      {/* Journal Summary */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Today's Journal</h4>
        {journal ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
              <div className="text-[10px] text-text-faint uppercase">Mood</div>
              <div className="text-lg font-data font-semibold text-text-heading">{journal.mood_rating ?? '—'}/5</div>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
              <div className="text-[10px] text-text-faint uppercase">Discipline</div>
              <div className="text-lg font-data font-semibold text-text-heading">{journal.discipline_rating ?? '—'}/5</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-muted py-2">Fill in your journal from the Review phase</div>
        )}
      </div>

      {/* Day Complete */}
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
  const today = new Date().toISOString().slice(0, 10)
  const { data: dashboard, isLoading } = useDailyDashboard()
  const resetMut = useResetWorkflow(today)
  const qc = useQueryClient()

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
  }

  const wf = dashboard?.workflow
  const phase = wf?.phase ?? 'pre_market'
  const PhaseComponent = PHASE_COMPONENTS[phase]

  return (
    <div className="space-y-[var(--page-gap)] px-[var(--page-px)] py-[var(--page-py)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold text-text-heading">Performance OS</h1>
          <p className="text-sm text-text-muted mt-0.5">Your daily trading workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetMut.mutate(); qc.invalidateQueries({ queryKey: ['daily-dashboard'] }) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-elevated/50 text-text-muted hover:text-text-heading hover:bg-bg-card-h transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* View tabs */}
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
          {/* Phase Stepper */}
          <PhaseStepper phase={phase} progress={dashboard.phase_progress} />
          {/* Phase Content */}
          <PhaseComponent dashboard={dashboard} dateStr={today} />
        </>
      )}

      {viewTab === 'daily' && !dashboard && (
        <div className="bg-card rounded-2xl border border-border p-5 text-center">
          <div className="text-sm text-text-muted">Loading workflow...</div>
        </div>
      )}

      {viewTab === 'weekly' && <WeeklyReviewSection />}
      {viewTab === 'monthly' && <MonthlyReviewSection />}
    </div>
  )
}

function WeeklyReviewSection() {
  const qc = useQueryClient()
  const { data: review, isLoading } = useQuery({
    queryKey: ['weekly-review', 'current'],
    queryFn: () => getCurrentWeeklyReview(),
  })
  const updateMut = useMutation({
    mutationFn: (data: import('@/types/performanceOs').WeeklyReviewUpdate) => updateWeeklyReview(review?.week_start ?? '', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-review'] }) },
  })

  if (isLoading) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>

  const pnl = review ? Number(review.total_pnl) : 0
  return (
    <div className="space-y-5 animate-card-in">
      {/* Week Header */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-text-heading">
            Week of {review?.week_start ? new Date(review.week_start + 'T00:00:00').toLocaleDateString() : 'This Week'}
          </h3>
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
            <div className="text-[10px] text-text-faint uppercase">Best Setup</div>
            <div className="text-sm font-medium text-text-heading">{review?.top_setup ?? '—'}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 text-center">
            <div className="text-[10px] text-text-faint uppercase">Rules</div>
            <div className="text-sm font-medium text-text-heading">{review?.rules_followed ?? 0} / {(review?.rules_followed ?? 0) + (review?.rules_violated ?? 0)}</div>
          </div>
        </div>
      </div>

      {/* Daily Breakdown */}
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

      {/* Key Lessons */}
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

      {/* Setup Performance */}
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

      {/* Top Emotions */}
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

      {/* Notes */}
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