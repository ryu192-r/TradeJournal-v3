import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2, ChevronRight, ChevronLeft,
  Loader2, ArrowRight,
} from 'lucide-react'
import { useDailyDashboard, useAdvancePhase, useUpdateWorkflow, useResetWorkflow } from '@/hooks/usePerformanceOS'
import { getCurrentWeeklyReview, updateWeeklyReview, getCurrentMonthlyReview, updateMonthlyReview } from '@/lib/endpoints'
import { useWeeklyJournalStatsQuery, useWeeklyJournalsQuery } from '@/hooks/useJournalMutation'
import { formatCurrency, formatPrice, formatDate } from '@/utils/format'
import { cn } from '@/lib/utils'
import type { WorkflowPhase, DailyDashboard, ChecklistItem } from '@/types/performanceOs'

type ViewTab = 'daily' | 'weekly' | 'monthly'

const PHASE_ORDER: WorkflowPhase[] = ['pre_market', 'execution', 'review', 'behavior']

const PHASE_LABEL: Record<WorkflowPhase, string> = {
  pre_market: 'Pre-Market',
  execution: 'Execution',
  review: 'Review',
  behavior: 'Behavior',
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function PhaseDots({ phase, progress }: { phase: WorkflowPhase; progress: DailyDashboard['phase_progress'] }) {
  const idx = PHASE_ORDER.indexOf(phase)
  return (
    <div className="flex items-center gap-2">
      {PHASE_ORDER.map((p, i) => {
        const done = progress.completed[i]
        const current = i === idx
        return (
          <div key={p} className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 text-[length:var(--text-xs)] font-medium transition-all',
              current ? 'text-accent' : done ? 'text-profit/70' : 'text-text-faint',
            )}>
              {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className={cn('w-2 h-2 rounded-full', current ? 'bg-accent' : 'bg-text-faint/30')} />}
              <span className={cn(current && 'font-semibold')}>{PHASE_LABEL[p]}</span>
            </div>
            {i < PHASE_ORDER.length - 1 && <div className={cn('w-4 h-px', i < idx ? 'bg-profit/30' : 'bg-text-faint/15')} />}
          </div>
        )
      })}
    </div>
  )
}

function CommandStrip({ dashboard, selectedDate, onDateChange }: { dashboard: DailyDashboard; selectedDate: string; onDateChange: (d: string) => void }) {
  const today = toISODate(new Date())
  const regime = dashboard.market_regime
  const todayPnl = dashboard.today_trades.filter(t => t.exit_price).reduce((s, t) => s + (t.pnl ? Number(t.pnl) : 0), 0)
  const openCount = dashboard.open_positions.length
  const phase = dashboard.workflow?.phase ?? 'pre_market'

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    onDateChange(toISODate(d))
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1">
        <button onClick={() => shiftDate(-1)} className="p-1 rounded text-text-muted hover:text-text-heading cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span className="font-data text-text-heading">{formatDate(new Date(selectedDate + 'T00:00:00'))}</span>
        <button onClick={() => shiftDate(1)} className="p-1 rounded text-text-muted hover:text-text-heading cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
        {selectedDate === today && <span className="text-accent font-medium ml-0.5">today</span>}
      </div>

      <div className="w-px h-3 bg-border" />

      <span className={cn('font-medium', phase === 'pre_market' ? 'text-blue-400' : phase === 'execution' ? 'text-amber-400' : phase === 'review' ? 'text-emerald-400' : 'text-purple-400')}>
        {PHASE_LABEL[phase]}
      </span>

      {todayPnl !== 0 && (
        <>
          <div className="w-px h-3 bg-border" />
          <span className={cn('font-data font-medium', todayPnl >= 0 ? 'text-profit' : 'text-loss')}>
            {todayPnl >= 0 ? '+' : ''}{formatCurrency(todayPnl)}
          </span>
        </>
      )}

      {openCount > 0 && (
        <>
          <div className="w-px h-3 bg-border" />
          <span className="text-text-muted">{openCount} open</span>
        </>
      )}

      {regime && (
        <>
          <div className="w-px h-3 bg-border" />
          <span className={cn('font-data', regime.nifty_trend === 'bullish' ? 'text-profit/70' : regime.nifty_trend === 'bearish' ? 'text-loss/70' : 'text-text-muted')}>
            Nifty {regime.nifty_trend ?? '—'}
          </span>
          {regime.india_vix && <span className="text-text-faint">VIX {regime.india_vix}</span>}
        </>
      )}
    </div>
  )
}

function PreMarketPhase({ dashboard, dateStr }: { dashboard: DailyDashboard; dateStr: string }) {
  const updateMut = useUpdateWorkflow(dateStr)
  const advanceMut = useAdvancePhase(dateStr)
  const wf = dashboard.workflow!
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>(wf.checklist_items)
  const initialized = useRef(false)
  if (!initialized.current) { initialized.current = true }
  if (initialized.current && localChecklist !== wf.checklist_items && wf.checklist_items.length > 0 && localChecklist.length === 0) {
    setLocalChecklist(wf.checklist_items)
  }

  const checkedCount = localChecklist.filter(c => c.checked).length
  const allChecked = localChecklist.every(c => c.checked)

  const toggleItem = (id: string) => {
    setLocalChecklist(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  }

  const handleAdvance = () => {
    updateMut.mutate({ checklist_items: localChecklist }, {
      onSuccess: () => advanceMut.mutate(),
    })
  }

  return (
    <div className="space-y-6 animate-card-in">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Checklist</span>
          <span className="text-[length:var(--text-xs)] font-data text-text-faint">{checkedCount}/{localChecklist.length}</span>
        </div>
        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden mb-3">
          <div className="h-full bg-profit/60 rounded-full transition-all" style={{ width: `${localChecklist.length ? (checkedCount / localChecklist.length) * 100 : 0}%` }} />
        </div>
        <div className="space-y-0.5">
          {localChecklist.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className="w-full flex items-center gap-3 py-2.5 px-1 text-left cursor-pointer group transition-all"
            >
              <div className={cn(
                'w-4 h-4 rounded-full border transition-all shrink-0 flex items-center justify-center',
                item.checked ? 'border-profit/40 bg-profit/15' : 'border-text-faint/20 group-hover:border-text-muted/40',
              )}>
                {item.checked && <div className="w-1.5 h-1.5 rounded-full bg-profit" />}
              </div>
              <span className={cn('text-sm transition-all', item.checked ? 'text-text-muted line-through' : 'text-text-heading')}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Notes</label>
        <textarea
          value={wf.pre_market_notes ?? ''}
          onChange={(e) => updateMut.mutate({ pre_market_notes: e.target.value })}
          placeholder="Market context, key levels, setups to watch, risk plan..."
          rows={5}
          className="w-full rounded-xl border border-border bg-bg-elevated/30 px-4 py-3 text-sm text-text placeholder:text-text-faint/50 focus:outline-none focus:border-accent/30 resize-y"
        />
      </div>

      <button
        onClick={handleAdvance}
        disabled={!allChecked || advanceMut.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-accent/10 text-accent hover:bg-accent/15 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Start Trading
      </button>
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
    <div className="space-y-6 animate-card-in">
      {positions.length > 0 && (
        <div>
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Open Positions</span>
          <div className="mt-2 divide-y divide-border/50">
            {positions.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-[length:var(--text-sm)] font-medium text-text-heading">{p.symbol}</span>
                  {p.setup && <span className="text-[length:var(--text-xs)] text-text-muted ml-2">{p.setup}</span>}
                </div>
                <div className="text-right font-data text-[length:var(--text-xs)] text-text-muted">
                  {formatPrice(Number(p.entry_price))} x {p.quantity}
                  {p.stop_price && <span className="text-loss ml-2">SL {formatPrice(Number(p.stop_price))}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Today's Trades</span>
        {todayTrades.length === 0 ? (
          <div className="mt-3 text-sm text-text-faint py-4 text-center">No trades yet today</div>
        ) : (
          <div className="mt-2 divide-y divide-border/50">
            {todayTrades.map(t => {
              const pnl = t.pnl ? Number(t.pnl) : null
              return (
                <div key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-[length:var(--text-sm)] font-medium text-text-heading">{t.symbol}</span>
                    {t.setup && <span className="text-[length:var(--text-xs)] text-text-muted ml-2">{t.setup}</span>}
                  </div>
                  <div className="text-right">
                    {pnl !== null && <div className={cn('text-sm font-data', pnl >= 0 ? 'text-profit' : 'text-loss')}>{pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}</div>}
                    <div className="text-[length:var(--text-xs)] text-text-faint">{t.exit_price ? 'Closed' : 'Open'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Intraday Notes</label>
        <textarea
          value={wf.intraday_notes ?? ''}
          onChange={(e) => updateMut.mutate({ intraday_notes: e.target.value })}
          placeholder="Observations, emotion check-ins..."
          rows={3}
          className="w-full rounded-xl border border-border bg-bg-elevated/30 px-4 py-3 text-sm text-text placeholder:text-text-faint/50 focus:outline-none focus:border-accent/30 resize-y"
        />
      </div>

      <button
        onClick={() => advanceMut.mutate()}
        disabled={advanceMut.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-accent/10 text-accent hover:bg-accent/15 transition-all cursor-pointer disabled:opacity-30"
      >
        {advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Move to Review
      </button>
    </div>
  )
}

function ReviewPhase({ dashboard, dateStr }: { dashboard: DailyDashboard; dateStr: string }) {
  const advanceMut = useAdvancePhase(dateStr)
  const updateMut = useUpdateWorkflow(dateStr)
  const wf = dashboard.workflow!
  const todayPnl = dashboard.today_trades.filter(t => t.exit_price).reduce((s, t) => s + (t.pnl ? Number(t.pnl) : 0), 0)

  return (
    <div className="space-y-6 animate-card-in">
      <div className="flex items-center justify-between font-data text-[length:var(--text-xs)] text-text-muted">
        <span>{dashboard.today_trades.length} trades</span>
        <span>{dashboard.today_trades.filter(t => t.exit_price).length} closed</span>
        <span className={cn('font-medium', todayPnl >= 0 ? 'text-profit' : 'text-loss')}>
          {todayPnl >= 0 ? '+' : ''}{formatCurrency(todayPnl)}
        </span>
      </div>

      <div>
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Mood</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => updateMut.mutate({ mood_rating: n })}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-medium cursor-pointer transition-all',
                wf.mood_rating === n ? 'bg-accent/15 text-accent' : 'bg-bg-elevated/30 text-text-muted hover:bg-bg-elevated/50',
              )}
            >{n}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Discipline</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => updateMut.mutate({ discipline_rating: n })}
              className={cn(
                'w-9 h-9 rounded-lg text-sm font-medium cursor-pointer transition-all',
                wf.discipline_rating === n ? 'bg-accent/15 text-accent' : 'bg-bg-elevated/30 text-text-muted hover:bg-bg-elevated/50',
              )}
            >{n}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Lessons</label>
        <textarea
          value={wf.post_market_notes ?? ''}
          onChange={(e) => updateMut.mutate({ post_market_notes: e.target.value })}
          placeholder="What worked? What will you do differently?"
          rows={4}
          className="w-full rounded-xl border border-border bg-bg-elevated/30 px-4 py-3 text-sm text-text placeholder:text-text-faint/50 focus:outline-none focus:border-accent/30 resize-y"
        />
      </div>

      <button
        onClick={() => advanceMut.mutate()}
        disabled={advanceMut.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-accent/10 text-accent hover:bg-accent/15 transition-all cursor-pointer disabled:opacity-30"
      >
        {advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        Move to Behavior
      </button>
    </div>
  )
}

function BehaviorPhase({ dashboard }: { dashboard: DailyDashboard }) {
  const ds = dashboard.discipline_score
  const wf = dashboard.workflow!

  return (
    <div className="space-y-6 animate-card-in">
      {ds && (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-data font-bold text-accent">{ds.avg_execution_grade.toFixed(1)}</span>
          <span className="text-[length:var(--text-xs)] text-text-muted">avg execution grade — {ds.total_graded} trades (30d)</span>
        </div>
      )}

      {wf.mood_rating && (
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-[length:var(--text-xs)] text-text-muted block">Mood</span>
            <span className="font-data font-medium text-text-heading">{wf.mood_rating}/5</span>
          </div>
          {wf.discipline_rating && (
            <div>
              <span className="text-[length:var(--text-xs)] text-text-muted block">Discipline</span>
              <span className="font-data font-medium text-text-heading">{wf.discipline_rating}/5</span>
            </div>
          )}
        </div>
      )}

      {wf.behavior_done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-profit/60 mx-auto mb-2" />
          <div className="text-sm text-profit/80 font-medium">Day complete</div>
        </div>
      ) : (
        <div className="text-[length:var(--text-xs)] text-text-faint text-center py-4">
          Review your emotional state and rule compliance.
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
  const today = toISODate(new Date())
  const isToday = selectedDate === today

  const { data: dashboard, isLoading } = useDailyDashboard(isToday ? undefined : selectedDate)
  const resetMut = useResetWorkflow(today)
  const qc = useQueryClient()

  const wf = dashboard?.workflow
  const phase = wf?.phase ?? 'pre_market'
  const PhaseComponent = PHASE_COMPONENTS[phase]

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)]">
      {/* Header */}
      <div className="mb-1">
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading tracking-tight">Performance OS</h1>
      </div>

      {/* Command strip */}
      {dashboard && <CommandStrip dashboard={dashboard} selectedDate={selectedDate} onDateChange={setSelectedDate} />}

      {/* View range selector */}
      <div className="flex items-center gap-1 mt-4 mb-5">
        {([
          { id: 'daily' as ViewTab, label: 'Daily' },
          { id: 'weekly' as ViewTab, label: 'Weekly' },
          { id: 'monthly' as ViewTab, label: 'Monthly' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setViewTab(t.id)}
            className={cn(
              'px-3 py-1 rounded-lg text-[length:var(--text-xs)] font-medium transition-all cursor-pointer',
              viewTab === t.id ? 'bg-bg-elevated/80 text-text-heading' : 'text-text-faint hover:text-text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
        {isToday && viewTab === 'daily' && (
          <button
            onClick={() => { resetMut.mutate(); qc.invalidateQueries({ queryKey: ['daily-dashboard'] }) }}
            className="ml-auto text-[10px] text-text-faint hover:text-text-muted cursor-pointer"
          >
            reset
          </button>
        )}
      </div>

      {/* Daily: Phase content */}
      {viewTab === 'daily' && isLoading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
      )}
      {viewTab === 'daily' && dashboard && (
        <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
          <PhaseDots phase={phase} progress={dashboard.phase_progress} />
          <div className="mt-5 border-t border-border/50 pt-5">
            <PhaseComponent dashboard={dashboard} dateStr={selectedDate} />
          </div>
        </div>
      )}
      {viewTab === 'daily' && !dashboard && !isLoading && (
        <div className="text-sm text-text-faint text-center py-12">No workflow data.</div>
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
  const weekDays = Array.from({ length: 5 }, (_, i) => { const cd = new Date(monday); cd.setDate(monday.getDate() + i); return cd })

  const { data: stats } = useWeeklyJournalStatsQuery(mondayISO)
  const { data: weekJournals } = useWeeklyJournalsQuery(mondayISO)

  if (reviewLoading && !review) return <div className="flex items-center justify-center h-32"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>

  const pnl = review ? Number(review.total_pnl) : 0

  return (
    <div className="space-y-5 animate-card-in">
      <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[length:var(--text-sm)] font-medium text-text-heading">Week of {review?.week_start ? new Date(review.week_start + 'T00:00:00').toLocaleDateString() : formatDate(monday)}</span>
          <span className={cn('text-lg font-data font-semibold', pnl >= 0 ? 'text-profit' : 'text-loss')}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
          </span>
        </div>

        <div className="flex items-center gap-6 mb-4 text-sm font-data">
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Trades</span><span className="text-text-heading font-medium">{review?.total_trades ?? stats?.trade_count ?? 0}</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Win Rate</span><span className="text-text-heading font-medium">{review?.win_rate ?? (stats ? `${parseFloat(stats.win_rate).toFixed(1)}%` : '—')}</span></div>
          {review?.top_setup && <div><span className="text-[length:var(--text-xs)] text-text-muted block">Best Setup</span><span className="text-text-heading font-medium">{review.top_setup}</span></div>}
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {weekDays.map(wd => {
            const iso = toISODate(wd)
            const isToday = iso === toISODate(new Date())
            const isSelected = iso === selectedDate
            return (
              <button
                key={iso}
                onClick={() => onSelectDate(iso)}
                className={cn(
                  'rounded-lg p-2 text-center transition-all cursor-pointer',
                  isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-bg-elevated/50 text-text-muted',
                )}
              >
                <div className="text-[10px] uppercase tracking-wider mb-0.5">{wd.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                <div className={cn('text-sm font-semibold', isToday ? 'text-accent' : 'text-text-heading')}>{wd.getDate()}</div>
              </button>
            )
          })}
        </div>
      </div>

      {review?.daily_breakdown && review.daily_breakdown.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Daily Breakdown</span>
          <div className="mt-3 divide-y divide-border/50">
            {review.daily_breakdown.map(d => (
              <div key={d.date} className="flex items-center justify-between py-2">
                <span className="text-[length:var(--text-xs)] text-text-muted">{new Date(d.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <span className="text-[length:var(--text-xs)] text-text-faint">{d.trades}</span>
                <span className={cn('text-[length:var(--text-xs)] font-data', Number(d.pnl) >= 0 ? 'text-profit/70' : 'text-loss/70')}>{Number(d.pnl) >= 0 ? '+' : ''}{formatCurrency(Number(d.pnl))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {weekJournals && weekJournals.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Journal Entries</span>
          <div className="mt-3 divide-y divide-border/50">
            {weekJournals.map(j => (
              <button key={j.id} onClick={() => onSelectDate(j.date)} className="w-full text-left py-2.5 cursor-pointer group">
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

      <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Key Lessons</label>
        <textarea
          value={review?.key_lessons ?? ''}
          onChange={(e) => updateMut.mutate({ key_lessons: e.target.value })}
          placeholder="What did you learn this week?"
          rows={3}
          className="w-full rounded-xl border border-border bg-bg-elevated/30 px-4 py-3 text-sm text-text placeholder:text-text-faint/50 focus:outline-none focus:border-accent/30 resize-y"
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
      <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[length:var(--text-sm)] font-medium text-text-heading">{review?.month ?? 'Current Month'}</span>
          <span className={cn('text-lg font-data font-semibold', pnl >= 0 ? 'text-profit' : 'text-loss')}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm font-data">
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Trades</span><span className="text-text-heading font-medium">{review?.total_trades ?? 0}</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Win Rate</span><span className="text-text-heading font-medium">{review?.win_rate ?? '—'}</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">PF</span><span className="text-text-heading font-medium">{review?.profit_factor ?? '—'}</span></div>
          <div><span className="text-[length:var(--text-xs)] text-text-muted block">Avg R</span><span className="text-text-heading font-medium">{review?.avg_r ?? '—'}</span></div>
        </div>
      </div>

      {review?.setup_performance && review.setup_performance.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider">Setup Performance</span>
          <div className="mt-3 divide-y divide-border/50">
            {review.setup_performance.map(s => (
              <div key={s.setup} className="flex items-center justify-between py-2">
                <span className="text-sm text-text-heading">{s.setup}</span>
                <span className="text-[length:var(--text-xs)] text-text-faint">{s.count}</span>
                <span className={cn('text-[length:var(--text-xs)] font-data', Number(s.pnl) >= 0 ? 'text-profit/70' : 'text-loss/70')}>{Number(s.pnl) >= 0 ? '+' : ''}{formatCurrency(Number(s.pnl))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {review?.top_emotions && review.top_emotions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
          <span className="text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-2 block">Emotional Landscape</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {review.top_emotions.map(e => (
              <span key={e.emotion} className="text-[10px] px-2.5 py-0.5 rounded-full bg-accent/8 text-accent/70 capitalize">{e.emotion} {e.count}</span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-[var(--page-px)]">
        <label className="block text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-wider mb-1.5">Notes</label>
        <textarea
          value={review?.notes ?? ''}
          onChange={(e) => updateMut.mutate({ notes: e.target.value })}
          placeholder="Reflections, goals, next month targets..."
          rows={3}
          className="w-full rounded-xl border border-border bg-bg-elevated/30 px-4 py-3 text-sm text-text placeholder:text-text-faint/50 focus:outline-none focus:border-accent/30 resize-y"
        />
      </div>
    </div>
  )
}