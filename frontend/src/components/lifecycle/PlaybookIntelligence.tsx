import { useState } from 'react'
import { usePlaybookOverviewQuery, useSetupIntelligenceQuery } from '@/hooks/usePlaybookIntelligenceQuery'
import { formatCurrency } from '@/utils/format'
import { BookOpen, ChevronRight, Clock, TrendingUp, TrendingDown, AlertTriangle, Target, Brain, Shield, X } from 'lucide-react'
import { EmptyState, CardSkeleton, SectionTitle, SectionHeader } from '@/components/ui'
import type { PlaybookOverviewSetup, SetupIntelligenceResponse, TacticPerformance, RecentTrade } from '@/types'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function ScoreChip({ label, value, suffix }: { label: string; value: string | number | null; suffix?: string }) {
  if (value == null) return null
  const numeric = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(numeric)) return null
  const color = label.includes('Win') || label.includes('PF')
    ? numeric >= 50 ? 'text-profit' : 'text-loss'
    : numeric >= 0 ? 'text-profit' : 'text-loss'
  return (
    <div className="text-center">
      <div className={`text-sm font-bold font-data ${color}`}>
        {typeof value === 'number' ? (suffix === '₹' ? formatCurrency(value) : value.toFixed(suffix === '%' ? 1 : 2)) : value}{suffix ?? ''}
      </div>
      <div className="text-[10px] text-text-muted">{label}</div>
    </div>
  )
}

function OverviewCard({ setup, onClick }: { setup: PlaybookOverviewSetup; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`${CARD} w-full text-left hover:border-accent/40 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">{setup.setup_name}</h3>
        <ChevronRight className="w-4 h-4 text-text-muted" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <ScoreChip label="Win%" value={setup.win_rate} suffix="%" />
        <ScoreChip label="Expectancy" value={setup.expectancy} suffix="₹" />
        <ScoreChip label="PF" value={setup.profit_factor} />
        <ScoreChip label="Avg R" value={setup.avg_r} />
      </div>
      <div className="mt-2 text-[10px] text-text-muted">{setup.closed_count} closed / {setup.trade_count} total</div>
    </button>
  )
}

function PerformanceSection({ perf }: { perf: SetupIntelligenceResponse['performance'] }) {
  if (perf.closed_count === 0) return <EmptyState icon={Target} title="No data" message="No closed trades yet." compact />
  return (
    <div className="grid grid-cols-3 gap-3">
      <ScoreChip label="Win Rate" value={perf.win_rate} suffix="%" />
      <ScoreChip label="Expectancy" value={perf.expectancy} suffix="₹" />
      <ScoreChip label="Profit Factor" value={perf.profit_factor} />
      <ScoreChip label="Total PnL" value={perf.total_pnl} suffix="₹" />
      <ScoreChip label="Avg R" value={perf.avg_r} suffix="R" />
      <ScoreChip label="R Std" value={perf.r_std} />
    </div>
  )
}

function HoldTimeSection({ holdTime }: { holdTime: SetupIntelligenceResponse['hold_time'] }) {
  if (holdTime.sample_size === 0) return <EmptyState icon={Clock} title="No data" message="No holding data yet." compact />
  return (
    <div className="space-y-[var(--cell-py)]">
      <div className="grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{holdTime.avg_hours?.toFixed(1)}h</div>
          <div className="text-[10px] text-text-muted">Avg Hold</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{holdTime.median_hours?.toFixed(1)}h</div>
          <div className="text-[10px] text-text-muted">Median Hold</div>
        </div>
      </div>
      {Object.entries(holdTime.hold_performance).length > 0 && (
        <div className="space-y-1">
          {Object.entries(holdTime.hold_performance).map(([bucket, data]) => (
            <div key={bucket} className="flex items-center justify-between text-xs">
              <span className="text-text-heading">{bucket}</span>
              <div className="flex items-center gap-3">
                <span className="text-text-muted font-data">{data.count}x</span>
                {data.win_rate != null && <span className={`font-data ${data.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{data.win_rate}%</span>}
                {data.avg_pnl != null && <span className={`font-data ${data.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(data.avg_pnl)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {holdTime.best_hold_bucket && (
        <div className="text-xs text-accent">Best hold window: <span className="font-data">{holdTime.best_hold_bucket}</span></div>
      )}
    </div>
  )
}

function MarketConditionsSection({ conditions }: { conditions: SetupIntelligenceResponse['market_conditions'] }) {
  return (
    <div className="space-y-[var(--cell-py)]">
      {conditions.best_time && (
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-profit" />
          <span className="text-text-muted">Best time:</span>
          <span className="text-text-heading font-data">{conditions.best_time.label}</span>
          <span className={`font-data ${conditions.best_time.avg_pnl != null && conditions.best_time.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {conditions.best_time.avg_pnl != null ? formatCurrency(conditions.best_time.avg_pnl) : '—'}
          </span>
        </div>
      )}
      {conditions.best_day && (
        <div className="flex items-center gap-2 text-xs">
          <TrendingUp className="w-3.5 h-3.5 text-profit" />
          <span className="text-text-muted">Best day:</span>
          <span className="text-text-heading font-data">{conditions.best_day.day_name}</span>
          <span className={`font-data ${conditions.best_day.avg_pnl != null && conditions.best_day.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {conditions.best_day.avg_pnl != null ? formatCurrency(conditions.best_day.avg_pnl) : '—'}
          </span>
        </div>
      )}
      {conditions.worst_time && (
        <div className="flex items-center gap-2 text-xs">
          <Clock className="w-3.5 h-3.5 text-loss" />
          <span className="text-text-muted">Worst time:</span>
          <span className="text-text-heading font-data">{conditions.worst_time.label}</span>
          <span className={`font-data ${conditions.worst_time.avg_pnl != null && conditions.worst_time.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {conditions.worst_time.avg_pnl != null ? formatCurrency(conditions.worst_time.avg_pnl) : '—'}
          </span>
        </div>
      )}
      {conditions.worst_day && (
        <div className="flex items-center gap-2 text-xs">
          <TrendingDown className="w-3.5 h-3.5 text-loss" />
          <span className="text-text-muted">Worst day:</span>
          <span className="text-text-heading font-data">{conditions.worst_day.day_name}</span>
          <span className={`font-data ${conditions.worst_day.avg_pnl != null && conditions.worst_day.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {conditions.worst_day.avg_pnl != null ? formatCurrency(conditions.worst_day.avg_pnl) : '—'}
          </span>
        </div>
      )}
      {(!conditions.best_time && !conditions.best_day) && (
        <EmptyState icon={TrendingUp} title="No data" message="No market condition data yet." compact />
      )}
    </div>
  )
}

function FailurePatternsSection({ patterns }: { patterns: SetupIntelligenceResponse['failure_patterns'] }) {
  if (patterns.loss_count === 0) return <EmptyState icon={AlertTriangle} title="No losses" message="No losses recorded yet." compact />
  return (
    <div className="space-y-[var(--cell-py)]">
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-lg font-bold font-data text-loss">{patterns.loss_count}</div>
          <div className="text-[10px] text-text-muted">Losses</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{patterns.max_consecutive_losses}</div>
          <div className="text-[10px] text-text-muted">Max Streak</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-data text-loss">{patterns.avg_loss != null ? formatCurrency(patterns.avg_loss) : '—'}</div>
          <div className="text-[10px] text-text-muted">Avg Loss</div>
        </div>
      </div>
      {patterns.exit_reasons_on_losses.length > 0 && (
        <div className="space-y-1">
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">Exit reasons on losses:</div>
          {patterns.exit_reasons_on_losses.map((r) => (
            <div key={r.reason} className="flex items-center justify-between text-xs">
              <span className="text-text-heading capitalize">{r.reason.replace('_', ' ')}</span>
              <span className="text-text-muted font-data">{r.count}x</span>
            </div>
          ))}
        </div>
      )}
      {patterns.insights.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          {patterns.insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-1.5 p-2 rounded-lg bg-loss-muted/20">
              <AlertTriangle className="w-3 h-3 text-loss shrink-0 mt-0.5" />
              <span className="text-xs text-text-heading">{ins.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BehaviorCrossoverSection({ behavior }: { behavior: SetupIntelligenceResponse['behavior_crossover'] }) {
  if (!behavior.emotion_breakdown.length && !behavior.grade_breakdown.length) {
    return <EmptyState icon={Brain} title="No data" message="No emotion/grade data for this setup." compact />
  }
  return (
    <div className="space-y-[var(--cell-py)]">
      {behavior.emotion_breakdown.length > 0 && (
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">Emotion performance:</div>
          {behavior.emotion_breakdown.map((e) => (
            <div key={e.emotion} className="flex items-center justify-between text-xs py-0.5">
              <span className="text-text-heading">{e.emotion}</span>
              <div className="flex items-center gap-2">
                <span className="text-text-muted font-data">{e.count}x</span>
                {e.win_rate != null && <span className={`font-data ${e.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{e.win_rate}%</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {behavior.grade_breakdown.length > 0 && (
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">Grade performance:</div>
          {behavior.grade_breakdown.map((g) => (
            <div key={g.grade} className="flex items-center justify-between text-xs py-0.5">
              <span className={`font-bold ${g.grade === 'A' || g.grade === 'B' ? 'text-profit' : g.grade === 'F' ? 'text-loss' : 'text-amber-400'}`}>{g.grade}</span>
              <div className="flex items-center gap-2">
                <span className="text-text-muted font-data">{g.count}x</span>
                {g.win_rate != null && <span className={`font-data ${g.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{g.win_rate}%</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TacticsSection({ tactics }: { tactics: TacticPerformance[] }) {
  if (!tactics.length) return <EmptyState icon={BookOpen} title="No data" message="No tactic data for this setup." compact />
  return (
    <div className="space-y-1">
      {tactics.map((t) => (
        <div key={t.tactic} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
          <span className="text-text-heading">{t.tactic}</span>
          <div className="flex items-center gap-3">
            <span className="text-text-muted font-data">{t.closed_count}/{t.trade_count}</span>
            {t.win_rate != null && <span className={`font-data ${t.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{t.win_rate}%</span>}
            {t.avg_pnl != null && <span className={`font-data ${t.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(t.avg_pnl)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function RecentTradesSection({ trades }: { trades: RecentTrade[] }) {
  if (!trades.length) return null
  return (
    <div className="space-y-1">
      {trades.map((t) => (
        <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
          <div className="flex items-center gap-2">
            <span className="font-data text-text-heading">{t.symbol}</span>
            {t.tactic && <span className="text-[10px] text-text-muted">{t.tactic}</span>}
          </div>
          <div className="flex items-center gap-2">
            {t.exit_reason && <span className="text-[10px] text-text-muted">{t.exit_reason}</span>}
            {t.pnl != null && <span className={`font-data ${parseFloat(t.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(parseFloat(t.pnl))}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function SetupDetailPanel({ setupName, onClose }: { setupName: string; onClose: () => void }) {
  const { data, isLoading } = useSetupIntelligenceQuery(setupName)

  if (isLoading) return <div className="space-y-[var(--page-gap)]"><CardSkeleton height="h-48" /><CardSkeleton height="h-48" /></div>
  if (!data) return <EmptyState icon={BookOpen} title="No data" message={`No data available for ${setupName}.`} />

  return (
    <div className="space-y-[var(--page-gap)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">{data.setup_name}</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-border/20 transition-colors"><X className="w-4 h-4 text-text-muted" /></button>
      </div>

      {data.description && <div className="text-[length:var(--text-xs)] text-text-muted italic">{data.description}</div>}

      <div className={CARD}>
        <SectionHeader icon={Target} title="Performance" />
        <PerformanceSection perf={data.performance} />
      </div>

      <div className={CARD}>
        <SectionHeader icon={Clock} title="Ideal Hold Time" />
        <HoldTimeSection holdTime={data.hold_time} />
      </div>

      <div className={CARD}>
        <SectionHeader icon={TrendingUp} title="Market Conditions" />
        <MarketConditionsSection conditions={data.market_conditions} />
      </div>

      <div className={CARD}>
        <SectionHeader icon={AlertTriangle} title="Failure Patterns" />
        <FailurePatternsSection patterns={data.failure_patterns} />
      </div>

      {data.tactic_breakdown.length > 0 && (
        <div className={CARD}>
          <SectionHeader icon={BookOpen} title="Tactic Breakdown" />
          <TacticsSection tactics={data.tactic_breakdown} />
        </div>
      )}

      <div className={CARD}>
        <SectionHeader icon={Brain} title="Setup × Behavior" />
        <BehaviorCrossoverSection behavior={data.behavior_crossover} />
      </div>

      {data.recent_trades.length > 0 && (
        <div className={CARD}>
          <SectionHeader icon={Shield} title="Recent Trades" />
          <RecentTradesSection trades={data.recent_trades} />
        </div>
      )}
    </div>
  )
}

export function PlaybookIntelligence() {
  const { data, isLoading } = usePlaybookOverviewQuery()
  const [selectedSetup, setSelectedSetup] = useState<string | null>(null)

  if (isLoading) return <div className="space-y-[var(--page-gap)]"><SectionTitle icon={BookOpen} title="Playbook Intelligence" /><CardSkeleton height="h-32" /></div>
  if (!data || data.setups.length === 0) return (
    <div className="space-y-[var(--page-gap)]">
      <SectionTitle icon={BookOpen} title="Playbook Intelligence" />
      <EmptyState icon={BookOpen} title="No setups" message="Create setups in your playbook to see performance analytics." />
    </div>
  )

  const setupsWithData = data.setups.filter(s => s.closed_count > 0)
  if (setupsWithData.length === 0 && !selectedSetup) return (
    <div className="space-y-[var(--page-gap)]">
      <SectionTitle icon={BookOpen} title="Playbook Intelligence" />
      <EmptyState icon={BookOpen} title="No data" message="Close some trades to see setup performance." />
    </div>
  )

  return (
    <div className="space-y-[var(--page-gap)]">
      <SectionTitle icon={BookOpen} title="Playbook Intelligence" />

      {selectedSetup ? (
        <SetupDetailPanel setupName={selectedSetup} onClose={() => setSelectedSetup(null)} />
      ) : (
        <div className="space-y-[var(--cell-py)]">
          {(data.best_by_expectancy || data.best_by_win_rate || data.best_by_pnl) && (
            <div className={CARD}>
              <SectionHeader icon={TrendingUp} title="Top Performing" />
              <div className="grid grid-cols-3 gap-3">
                {data.best_by_expectancy && data.best_by_expectancy.closed_count > 0 && (
                  <button onClick={() => setSelectedSetup(data.best_by_expectancy!.setup_name)} className="text-center hover:bg-accent/5 rounded-lg p-2 transition-colors">
                    <div className="text-[10px] text-text-muted">Best Expectancy</div>
                    <div className="text-sm font-bold text-text-heading">{data.best_by_expectancy.setup_name}</div>
                    {data.best_by_expectancy.expectancy != null && <div className="text-xs font-data text-profit">{formatCurrency(data.best_by_expectancy.expectancy)}</div>}
                  </button>
                )}
                {data.best_by_win_rate && data.best_by_win_rate.closed_count > 0 && (
                  <button onClick={() => setSelectedSetup(data.best_by_win_rate!.setup_name)} className="text-center hover:bg-accent/5 rounded-lg p-2 transition-colors">
                    <div className="text-[10px] text-text-muted">Best Win Rate</div>
                    <div className="text-sm font-bold text-text-heading">{data.best_by_win_rate.setup_name}</div>
                    {data.best_by_win_rate.win_rate != null && <div className="text-xs font-data text-profit">{data.best_by_win_rate.win_rate}%</div>}
                  </button>
                )}
                {data.best_by_pnl && data.best_by_pnl.closed_count > 0 && (
                  <button onClick={() => setSelectedSetup(data.best_by_pnl!.setup_name)} className="text-center hover:bg-accent/5 rounded-lg p-2 transition-colors">
                    <div className="text-[10px] text-text-muted">Best PnL</div>
                    <div className="text-sm font-bold text-text-heading">{data.best_by_pnl.setup_name}</div>
                    {data.best_by_pnl.total_pnl != null && <div className="text-xs font-data text-profit">{formatCurrency(data.best_by_pnl.total_pnl)}</div>}
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.setups.map((setup) => (
              <OverviewCard key={setup.setup_name} setup={setup} onClick={() => setSelectedSetup(setup.setup_name)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
