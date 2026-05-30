import { useState } from 'react'
import { usePlaybookOverviewQuery, useSetupIntelligenceQuery } from '@/hooks/usePlaybookIntelligenceQuery'
import {
  usePlaybookEdgeListQuery,
  usePlaybookEdgeQuery,
  usePlaybookEdgeTopQuery,
  usePlaybookEdgeWeakestQuery,
} from '@/hooks/usePlaybookEdgeQuery'
import {
  PlaybookEdgeCard,
  PlaybookConditionBreakdown,
  PlaybookFocusCard,
  PlaybookPauseCard,
} from './PlaybookEdgePanels'
import { SetupRegimePerformanceSection } from './SetupRegimePerformanceSection'
import { formatCurrency } from '@/utils/format'
import {
  BookOpen, ChevronRight, Clock, TrendingUp, TrendingDown,
  AlertTriangle, Target, Brain, Shield, X, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, Activity,
} from 'lucide-react'
import type {
  PlaybookOverviewSetup, SetupIntelligenceResponse, TacticPerformance, RecentTrade,
} from '@/types'

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
      <div className={`text-sm font-bold font-data ${color}`}>{typeof value === 'number' ? (suffix === '₹' ? formatCurrency(value) : value.toFixed(suffix === '%' ? 1 : 2)) : value}{suffix ?? ''}</div>
      <div className="text-[10px] text-text-muted">{label}</div>
    </div>
  )
}

function OverviewCard({ setup, onClick }: { setup: PlaybookOverviewSetup; onClick: () => void }) {
  const isPositive = (setup.total_pnl ?? 0) >= 0
  return (
    <button onClick={onClick} className={`${CARD} w-full text-left hover:border-accent/40 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">{setup.setup_name}</h3>
          {setup.closed_count > 0 && (
            <span className={`text-[10px] font-data px-1.5 py-0.5 rounded-full ${isPositive ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'}`}>
              {isPositive ? '+' : ''}{formatCurrency(setup.total_pnl ?? 0)}
            </span>
          )}
        </div>
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
  if (perf.closed_count === 0) return <div className="text-[length:var(--text-sm)] text-text-muted py-4">No closed trades yet.</div>
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
  if (holdTime.sample_size === 0) return <div className="text-[length:var(--text-sm)] text-text-muted py-2">No holding data yet.</div>
  return (
    <div className="space-y-[var(--cell-py)]">
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{holdTime.avg_hours?.toFixed(1)}h</div>
          <div className="text-[10px] text-text-muted">Avg Hold</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{holdTime.median_hours?.toFixed(1)}h</div>
          <div className="text-[10px] text-text-muted">Median Hold</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{holdTime.min_hours?.toFixed(1)}h</div>
          <div className="text-[10px] text-text-muted">Min</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-data text-text-heading">{holdTime.max_hours?.toFixed(1)}h</div>
          <div className="text-[10px] text-text-muted">Max</div>
        </div>
      </div>
      {Object.keys(holdTime.hold_performance).length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          {Object.entries(holdTime.hold_performance).map(([bucket, data]) => (
            <div key={bucket} className="flex items-center justify-between text-xs">
              <span className="text-text-heading font-medium">{bucket}</span>
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
        <div className="text-xs text-accent flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Best hold window: <span className="font-data font-medium">{holdTime.best_hold_bucket}</span>
        </div>
      )}
    </div>
  )
}

function MarketConditionsSection({ conditions }: { conditions: SetupIntelligenceResponse['market_conditions'] }) {
  const hasData = conditions.best_time || conditions.best_day || conditions.worst_time || conditions.worst_day
  if (!hasData && conditions.time_of_day.length === 0) return <div className="text-[length:var(--text-sm)] text-text-muted py-2">No market condition data yet.</div>
  return (
    <div className="space-y-[var(--page-gap)]">
      {(conditions.best_time || conditions.worst_time) && (
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-2 font-medium">Time of Day</div>
          <div className="space-y-1.5">
            {conditions.best_time && (
              <div className="flex items-center gap-2 text-xs">
                <ArrowUpRight className="w-3.5 h-3.5 text-profit" />
                <span className="text-text-muted">Best:</span>
                <span className="text-text-heading font-data">{conditions.best_time.label}</span>
                <span className={`font-data ${conditions.best_time.avg_pnl != null && conditions.best_time.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {conditions.best_time.avg_pnl != null ? formatCurrency(conditions.best_time.avg_pnl) : '—'}
                </span>
                <span className="text-text-muted font-data">({conditions.best_time.count}x)</span>
              </div>
            )}
            {conditions.worst_time && (
              <div className="flex items-center gap-2 text-xs">
                <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                <span className="text-text-muted">Worst:</span>
                <span className="text-text-heading font-data">{conditions.worst_time.label}</span>
                <span className={`font-data ${conditions.worst_time.avg_pnl != null && conditions.worst_time.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {conditions.worst_time.avg_pnl != null ? formatCurrency(conditions.worst_time.avg_pnl) : '—'}
                </span>
                <span className="text-text-muted font-data">({conditions.worst_time.count}x)</span>
              </div>
            )}
          </div>
        </div>
      )}
      {(conditions.best_day || conditions.worst_day) && (
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-2 font-medium">Day of Week</div>
          <div className="space-y-1.5">
            {conditions.best_day && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-profit" />
                <span className="text-text-muted">Best:</span>
                <span className="text-text-heading font-data">{conditions.best_day.day_name}</span>
                <span className={`font-data ${conditions.best_day.avg_pnl != null && conditions.best_day.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {conditions.best_day.avg_pnl != null ? formatCurrency(conditions.best_day.avg_pnl) : '—'}
                </span>
              </div>
            )}
            {conditions.worst_day && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingDown className="w-3.5 h-3.5 text-loss" />
                <span className="text-text-muted">Worst:</span>
                <span className="text-text-heading font-data">{conditions.worst_day.day_name}</span>
                <span className={`font-data ${conditions.worst_day.avg_pnl != null && conditions.worst_day.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {conditions.worst_day.avg_pnl != null ? formatCurrency(conditions.worst_day.avg_pnl) : '—'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
      {conditions.time_of_day.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1">All time slots:</div>
          <div className="flex flex-wrap gap-1.5">
            {conditions.time_of_day.map((t) => (
              <span key={t.hour} className={`text-[10px] font-data px-1.5 py-0.5 rounded ${t.avg_pnl != null && t.avg_pnl >= 0 ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'}`}>
                {t.label} {t.count}x
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FailurePatternsSection({ patterns }: { patterns: SetupIntelligenceResponse['failure_patterns'] }) {
  if (patterns.loss_count === 0) return <div className="text-[length:var(--text-sm)] text-text-muted py-2">No losses recorded yet. Great discipline!</div>
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
          <div className="text-[length:var(--text-xs)] text-text-muted mb-1 font-medium">Exit reasons on losses:</div>
          {patterns.exit_reasons_on_losses.map((r) => (
            <div key={r.reason} className="flex items-center justify-between text-xs">
              <span className="text-text-heading capitalize">{r.reason.replace('_', ' ')}</span>
              <div className="flex items-center gap-1">
                <span className="text-text-muted font-data">{r.count}x</span>
                <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-loss rounded-full" style={{ width: `${(r.count / patterns.loss_count) * 100}%` }} />
                </div>
              </div>
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
    return <div className="text-[length:var(--text-sm)] text-text-muted py-2">No emotion/grade data for this setup.</div>
  }
  return (
    <div className="space-y-[var(--page-gap)]">
      {behavior.emotion_breakdown.length > 0 && (
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-2 font-medium">Emotion performance</div>
          <div className="space-y-1">
            {behavior.emotion_breakdown.map((e) => {
              const isPos = (e.avg_pnl ?? 0) >= 0
              return (
                <div key={e.emotion} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2">
                    {isPos ? <ArrowUpRight className="w-3 h-3 text-profit" /> : <ArrowDownRight className="w-3 h-3 text-loss" />}
                    <span className="text-text-heading">{e.emotion}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted font-data">{e.count}x</span>
                    {e.win_rate != null && <span className={`font-data ${e.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{e.win_rate}%</span>}
                    {e.avg_pnl != null && <span className={`font-data ${e.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(e.avg_pnl)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {behavior.grade_breakdown.length > 0 && (
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted mb-2 font-medium">Grade performance</div>
          <div className="space-y-1">
            {behavior.grade_breakdown.map((g) => {
              const gradeColor = g.grade === 'A' || g.grade === 'B' ? 'text-profit' : g.grade === 'F' ? 'text-loss' : 'text-amber-400'
              return (
                <div key={g.grade} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                  <span className={`font-bold font-data text-base ${gradeColor}`}>{g.grade}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted font-data">{g.count}x</span>
                    {g.win_rate != null && <span className={`font-data ${g.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{g.win_rate}%</span>}
                    {g.avg_pnl != null && <span className={`font-data ${g.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(g.avg_pnl)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TacticsSection({ tactics }: { tactics: TacticPerformance[] }) {
  if (!tactics.length) return <div className="text-[length:var(--text-sm)] text-text-muted py-2">No tactic data for this setup.</div>
  return (
    <div className="space-y-1.5">
      {tactics.map((t) => {
        const isPos = (t.avg_pnl ?? 0) >= 0
        return (
          <div key={t.tactic} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              {isPos ? <ArrowUpRight className="w-3 h-3 text-profit" /> : <Minus className="w-3 h-3 text-text-muted" />}
              <span className="text-text-heading font-medium">{t.tactic}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-muted font-data">{t.closed_count}/{t.trade_count}</span>
              {t.win_rate != null && <span className={`font-data ${t.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{t.win_rate}%</span>}
              {t.avg_pnl != null && <span className={`font-data ${t.avg_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(t.avg_pnl)}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecentTradesSection({ trades }: { trades: RecentTrade[] }) {
  if (!trades.length) return null
  return (
    <div className="space-y-1.5">
      {trades.map((t) => {
        const pnl = t.pnl != null ? parseFloat(t.pnl) : null
        const isPos = (pnl ?? 0) >= 0
        return (
          <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              {isPos ? <ArrowUpRight className="w-3 h-3 text-profit" /> : <ArrowDownRight className="w-3 h-3 text-loss" />}
              <span className="font-data font-medium text-text-heading">{t.symbol}</span>
              {t.tactic && <span className="text-[10px] text-text-muted bg-bg-elevated px-1 py-0.5 rounded">{t.tactic}</span>}
            </div>
            <div className="flex items-center gap-2">
              {t.exit_reason && <span className="text-[10px] text-text-muted">{t.exit_reason}</span>}
              {pnl != null && <span className={`font-data ${isPos ? 'text-profit' : 'text-loss'}`}>{formatCurrency(pnl)}</span>}
              {t.r_multiple != null && <span className="text-[10px] text-text-muted font-data">{parseFloat(t.r_multiple).toFixed(1)}R</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SetupDetailPanel({ setupName, onClose }: { setupName: string; onClose: () => void }) {
  const { data, isLoading } = useSetupIntelligenceQuery(setupName)
  const { data: edgeData } = usePlaybookEdgeQuery(setupName)

  if (isLoading) {
    return (
      <div className="space-y-[var(--page-gap)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent" />
            <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">{setupName}</h3>
          </div>
          <button onClick={onClose} className="p-2 min-h-10 min-w-10 rounded-lg hover:bg-border/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg" aria-label="Close setup detail">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        {[1, 2, 3].map(i => <div key={i} className={`${CARD} h-32 animate-pulse`} />)}
      </div>
    )
  }

  if (!data) return <div className={CARD}><div className="text-[length:var(--text-sm)] text-text-muted">No data for {setupName}</div></div>

  return (
    <div className="space-y-[var(--page-gap)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-accent" />
          <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">{data.setup_name}</h3>
          <span className="text-[10px] text-text-muted font-data">{data.performance.closed_count} closed</span>
        </div>
        <button onClick={onClose} className="p-2 min-h-10 min-w-10 rounded-lg hover:bg-border/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg" aria-label="Close setup detail">
          <X className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {data.description && <div className="text-[length:var(--text-xs)] text-text-muted italic">{data.description}</div>}

      {data.ideal_conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.ideal_conditions.map((c, i) => (
            <span key={i} className="text-[10px] text-accent bg-accent-muted/30 px-2 py-0.5 rounded-full">{c}</span>
          ))}
        </div>
      )}

      {edgeData && edgeData.metrics.sample_size > 0 && (
        <>
          <PlaybookEdgeCard metrics={edgeData.metrics} />
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-medium text-text-heading">Condition Breakdown (R expectancy)</h4>
            </div>
            <PlaybookConditionBreakdown conditions={edgeData.conditions} />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-medium text-text-heading">Performance</h4>
          </div>
          <PerformanceSection perf={data.performance} />
        </div>

        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-400" />
            <h4 className="text-xs font-medium text-text-heading">Ideal Hold Time</h4>
          </div>
          <HoldTimeSection holdTime={data.hold_time} />
        </div>

        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-medium text-text-heading">Market Conditions</h4>
          </div>
          <MarketConditionsSection conditions={data.market_conditions} />
        </div>

        {data.regime_performance && (
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-medium text-text-heading">Setup × Regime</h4>
            </div>
            <SetupRegimePerformanceSection regimePerf={data.regime_performance} />
          </div>
        )}

        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <h4 className="text-xs font-medium text-text-heading">Failure Patterns</h4>
          </div>
          <FailurePatternsSection patterns={data.failure_patterns} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.tactic_breakdown.length > 0 && (
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-accent" />
              <h4 className="text-xs font-medium text-text-heading">Tactic Breakdown</h4>
            </div>
            <TacticsSection tactics={data.tactic_breakdown} />
          </div>
        )}

        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-medium text-text-heading">Setup × Behavior</h4>
          </div>
          <BehaviorCrossoverSection behavior={data.behavior_crossover} />
        </div>

        {data.recent_trades.length > 0 && (
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-text-muted" />
              <h4 className="text-xs font-medium text-text-heading">Recent Trades</h4>
            </div>
            <RecentTradesSection trades={data.recent_trades} />
          </div>
        )}
      </div>

      {data.rules.length > 0 && (
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-accent" />
            <h4 className="text-xs font-medium text-text-heading">Rules</h4>
          </div>
          <div className="space-y-1">
            {data.rules.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/50 mt-1 shrink-0" />
                <span className="text-text-muted">{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PlaybookIntelligenceFull() {
  const { data, isLoading } = usePlaybookOverviewQuery()
  const { data: edgeList } = usePlaybookEdgeListQuery()
  const { data: topEdge } = usePlaybookEdgeTopQuery()
  const { data: weakestEdge } = usePlaybookEdgeWeakestQuery()
  const [selectedSetup, setSelectedSetup] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-[var(--page-gap)]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-[length:var(--text-sm)] text-text-muted">Loading playbook intelligence...</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className={`${CARD} h-32 animate-pulse`} />)}
        </div>
      </div>
    )
  }

  if (!data || data.setups.length === 0) {
    return (
      <div className="py-12 text-center">
        <BarChart3 className="w-8 h-8 text-text-muted mx-auto mb-3" />
        <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading mb-1">No playbook data</h3>
        <p className="text-[length:var(--text-xs)] text-text-muted">Create setups and close some trades to unlock intelligence.</p>
      </div>
    )
  }

  if (selectedSetup) {
    return <SetupDetailPanel setupName={selectedSetup} onClose={() => setSelectedSetup(null)} />
  }

  const setupsWithData = data.setups.filter(s => s.closed_count > 0)
  const allSetups = data.setups.filter(s => s.trade_count > 0)

  return (
    <div className="space-y-6">
      {edgeList && edgeList.setups.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={CARD}>
              <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Best setup (R expectancy)</p>
              {topEdge ? (
                <button onClick={() => setSelectedSetup(topEdge.setup_name)} className="text-left w-full">
                  <div className="text-sm font-bold text-text-heading">{topEdge.setup_name}</div>
                  <div className="text-xs font-data text-profit">
                    {topEdge.expectancy_r != null ? `${topEdge.expectancy_r >= 0 ? '+' : ''}${topEdge.expectancy_r.toFixed(2)}R` : '—'}
                  </div>
                </button>
              ) : (
                <p className="text-[length:var(--text-sm)] text-text-muted">Not enough data</p>
              )}
            </div>
            <div className={CARD}>
              <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Weakest setup</p>
              {weakestEdge ? (
                <button onClick={() => setSelectedSetup(weakestEdge.setup_name)} className="text-left w-full">
                  <div className="text-sm font-bold text-text-heading">{weakestEdge.setup_name}</div>
                  <div className="text-xs font-data text-loss">
                    {weakestEdge.expectancy_r != null ? `${weakestEdge.expectancy_r.toFixed(2)}R` : '—'}
                  </div>
                </button>
              ) : (
                <p className="text-[length:var(--text-sm)] text-text-muted">Not enough data</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PlaybookFocusCard setups={edgeList.setups} />
            <PlaybookPauseCard setups={edgeList.setups} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h3 className="text-xs font-medium text-text-heading">Setup Rankings (edge score)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {edgeList.setups.map((metrics) => (
                <button key={metrics.setup_name} onClick={() => setSelectedSetup(metrics.setup_name)} className="text-left">
                  <PlaybookEdgeCard metrics={metrics} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Top performers banner — legacy ₹ expectancy view */}
      {setupsWithData.length > 0 && (data.best_by_expectancy || data.best_by_win_rate || data.best_by_pnl) && (
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-profit" />
            <h3 className="text-xs font-medium text-text-heading">Top Performing Setups</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {data.best_by_expectancy && data.best_by_expectancy.closed_count > 0 && (
              <button onClick={() => setSelectedSetup(data.best_by_expectancy!.setup_name)} className="text-center p-3 rounded-xl bg-profit-muted/10 hover:bg-profit-muted/20 transition-colors">
                <div className="text-[10px] text-text-muted mb-1">Best Expectancy</div>
                <div className="text-sm font-bold text-text-heading">{data.best_by_expectancy.setup_name}</div>
                {data.best_by_expectancy.expectancy != null && <div className="text-xs font-data text-profit">{formatCurrency(data.best_by_expectancy.expectancy)}</div>}
              </button>
            )}
            {data.best_by_win_rate && data.best_by_win_rate.closed_count > 0 && (
              <button onClick={() => setSelectedSetup(data.best_by_win_rate!.setup_name)} className="text-center p-3 rounded-xl bg-profit-muted/10 hover:bg-profit-muted/20 transition-colors">
                <div className="text-[10px] text-text-muted mb-1">Best Win Rate</div>
                <div className="text-sm font-bold text-text-heading">{data.best_by_win_rate.setup_name}</div>
                {data.best_by_win_rate.win_rate != null && <div className="text-xs font-data text-profit">{data.best_by_win_rate.win_rate}%</div>}
              </button>
            )}
            {data.best_by_pnl && data.best_by_pnl.closed_count > 0 && (
              <button onClick={() => setSelectedSetup(data.best_by_pnl!.setup_name)} className="text-center p-3 rounded-xl bg-profit-muted/10 hover:bg-profit-muted/20 transition-colors">
                <div className="text-[10px] text-text-muted mb-1">Best PnL</div>
                <div className="text-sm font-bold text-text-heading">{data.best_by_pnl.setup_name}</div>
                {data.best_by_pnl.total_pnl != null && <div className="text-xs font-data text-profit">{formatCurrency(data.best_by_pnl.total_pnl)}</div>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Setup cards grid — click to drill into per-setup intelligence */}
      {allSetups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allSetups.map((setup) => (
            <OverviewCard key={setup.setup_name} setup={setup} onClick={() => setSelectedSetup(setup.setup_name)} />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-[length:var(--text-sm)] text-text-muted">No trades linked to any setup yet.</p>
          <p className="text-[length:var(--text-xs)] text-text-muted mt-1">Assign setups to your trades to unlock intelligence.</p>
        </div>
      )}
    </div>
  )
}
