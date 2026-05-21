import { useState } from 'react'
import { useOvertradingQuery, useEarlyExitQuery, useDisciplineScoreQuery, useBehavioralScoreMutation } from '@/hooks/useBehavioralIntelligenceQuery'
import { formatCurrency } from '@/utils/format'
import { Brain, AlertTriangle, Shield, Activity, LogOut, Zap, TrendingDown, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { EmptyState, CardSkeleton, SectionTitle } from '@/components/ui'
import type { OvertradingDay, EarlyExit, DisciplineInsight, AIAssessment } from '@/types'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

function ScoreGauge({ score, grade }: { score: number | null; grade: string | null }) {
  if (score == null) return <EmptyState icon={Shield} title="No data" message="Score will appear as you trade and log data." compact />
  const color = score >= 85 ? 'text-emerald-400' : score >= 70 ? 'text-emerald-300' : score >= 55 ? 'text-amber-400' : score >= 40 ? 'text-orange-400' : 'text-red-400'
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-3xl font-bold font-data ${color}`}>{score}</span>
      <span className="text-text-muted text-sm">/100</span>
      {grade && <span className={`text-lg font-bold ${color}`}>{grade}</span>}
    </div>
  )
}

function ComponentScore({ label, score }: { label: string; score: number }) {
  const color = score >= 85 ? 'bg-emerald-400' : score >= 70 ? 'bg-emerald-300' : score >= 55 ? 'bg-amber-400' : score >= 40 ? 'bg-orange-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
      <span className="text-xs font-data text-text-muted w-8 text-right">{score}%</span>
      <span className="text-[length:var(--text-xs)] text-text-muted w-28 truncate">{label}</span>
    </div>
  )
}

function DisciplineScoreCard() {
  const { data, isLoading } = useDisciplineScoreQuery()
  if (isLoading) return <CardSkeleton height="h-48" />
  if (!data || data.overall_score == null) return null

  const labels: Record<string, string> = {
    execution_grade: 'Execution Quality',
    stop_discipline: 'Stop Discipline',
    plan_adherence: 'Plan Adherence',
    journal_consistency: 'Journal Habits',
    revenge_resistance: 'Revenge Resistance',
  }

  return (
    <div className={CARD}>
      <SectionTitle icon={Shield} title="Discipline Score" />
      <div className="mb-[var(--page-gap)]">
        <ScoreGauge score={data.overall_score} grade={data.grade} />
      </div>
      <div className="space-y-2 mb-[var(--page-gap)]">
        {Object.entries(data.components).map(([key, val]) => (
          <ComponentScore key={key} label={labels[key] || key} score={val} />
        ))}
      </div>
      {data.insights.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-border">
          {data.insights.map((insight: DisciplineInsight, i: number) => (
            <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${insight.type === 'warning' ? 'bg-loss-muted/20' : 'bg-accent-muted/20'}`}>
              {insight.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 text-loss shrink-0 mt-0.5" /> : <Brain className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />}
              <div className="text-xs text-text-heading">{insight.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function OvertradingCard() {
  const { data, isLoading } = useOvertradingQuery()
  if (isLoading) return <CardSkeleton height="h-48" />
  if (!data || data.summary.total_days === 0) return null

  const hasIssues = data.overtrading_days.length > 0 || data.overtrading_weeks.length > 0

  return (
    <div className={CARD}>
      <SectionTitle icon={Activity} title="Overtrading Detection" />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="text-center">
          <div className={`text-lg font-bold font-data ${data.overtrading_days.length > 0 ? 'text-loss' : 'text-profit'}`}>
            {data.summary.overtrading_days}/{data.summary.total_days}
          </div>
          <div className="text-[10px] text-text-muted">Days over limit</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold font-data ${data.overtrading_weeks.length > 0 ? 'text-loss' : 'text-profit'}`}>
            {data.summary.overtrading_weeks}/{data.summary.total_weeks}
          </div>
          <div className="text-[10px] text-text-muted">Weeks over limit</div>
        </div>
      </div>

      {data.avg_pnl_overtrading != null && data.avg_pnl_normal != null && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center">
            <div className={`text-sm font-data ${data.avg_pnl_overtrading >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(data.avg_pnl_overtrading)}</div>
            <div className="text-[10px] text-text-muted">Avg PnL (overtrading)</div>
          </div>
          <div className="text-center">
            <div className={`text-sm font-data ${data.avg_pnl_normal >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(data.avg_pnl_normal)}</div>
            <div className="text-[10px] text-text-muted">Avg PnL (normal)</div>
          </div>
        </div>
      )}

      {hasIssues ? data.overtrading_days.slice(0, 5).map((day: OvertradingDay) => (
        <div key={day.date} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-data text-text-heading">{day.date}</span>
            <span className="text-[10px] text-text-muted">{day.trade_count} trades</span>
          </div>
          <div className="flex items-center gap-2">
            {day.win_rate != null && <span className={`text-[10px] font-data ${day.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{day.win_rate}% win</span>}
            {day.total_pnl != null && <span className={`text-xs font-data ${day.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(day.total_pnl)}</span>}
          </div>
        </div>
      )) : (
        <EmptyState icon={Activity} title="All Clear" message="No overtrading detected." compact />
      )}
    </div>
  )
}

function EarlyExitCard() {
  const { data, isLoading } = useEarlyExitQuery()
  const [expanded, setExpanded] = useState(false)
  if (isLoading) return <CardSkeleton height="h-48" />
  if (!data || data.total_closed === 0) return null

  const stats = data.capture_stats

  return (
    <div className={CARD}>
      <SectionTitle icon={LogOut} title="Early Exit Analysis" />

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-3">
          {stats.avg_capture_ratio != null && (
            <div className="text-center">
              <div className={`text-lg font-bold font-data ${stats.avg_capture_ratio >= 0.8 ? 'text-profit' : stats.avg_capture_ratio >= 0.5 ? 'text-amber-400' : 'text-loss'}`}>
                {(stats.avg_capture_ratio * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-text-muted">Capture Ratio</div>
            </div>
          )}
          {stats.target_reach_rate != null && (
            <div className="text-center">
              <div className="text-lg font-bold font-data text-text-heading">{stats.target_reach_rate}%</div>
              <div className="text-[10px] text-text-muted">Target Reach</div>
            </div>
          )}
          {data.early_exit_rate != null && (
            <div className="text-center">
              <div className={`text-lg font-bold font-data ${data.early_exit_rate < 30 ? 'text-profit' : data.early_exit_rate < 60 ? 'text-amber-400' : 'text-loss'}`}>
                {data.early_exit_rate}%
              </div>
              <div className="text-[10px] text-text-muted">Early Exit Rate</div>
            </div>
          )}
        </div>
      )}

      {data.exit_reason_breakdown.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {data.exit_reason_breakdown.map((r) => (
            <div key={r.reason} className="flex items-center justify-between text-xs">
              <span className="text-text-heading capitalize">{r.reason.replace('_', ' ')}</span>
              <div className="flex items-center gap-3">
                <span className="text-text-muted font-data">{r.count}x</span>
                {r.win_rate != null && <span className={`font-data ${r.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{r.win_rate}%</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.avg_pnl_early_exit != null && data.avg_pnl_full_exit != null && (
        <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-border">
          <div className="text-center">
            <div className={`text-sm font-data ${data.avg_pnl_early_exit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(data.avg_pnl_early_exit)}</div>
            <div className="text-[10px] text-text-muted">Avg PnL (early exit)</div>
          </div>
          <div className="text-center">
            <div className={`text-sm font-data ${data.avg_pnl_full_exit >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(data.avg_pnl_full_exit)}</div>
            <div className="text-[10px] text-text-muted">Avg PnL (full exit)</div>
          </div>
        </div>
      )}

      {data.early_exits.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-accent hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {data.early_exits.length} early exits (capture &lt; 80%)
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {data.early_exits.slice(0, 8).map((exit: EarlyExit) => (
                <div key={exit.trade_id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-3 h-3 text-purple-400" />
                    <span className="text-xs font-data text-text-heading">{exit.symbol}</span>
                    <span className="text-[10px] text-text-muted">{exit.exit_reason}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted font-data">{(exit.capture_ratio * 100).toFixed(0)}% cap</span>
                    <span className={`text-xs font-data ${parseFloat(exit.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(parseFloat(exit.pnl))}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AIAssessmentCard() {
  const mutation = useBehavioralScoreMutation()
  const [assessment, setAssessment] = useState<AIAssessment | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setError(null)
    try {
      const result = await mutation.mutateAsync(30)
      setAssessment(result.ai_assessment)
    } catch {
      setError('Failed to generate assessment')
    }
  }

  return (
    <div className={CARD}>
      <SectionTitle icon={Brain} title="AI Behavioral Assessment" />

      {!assessment && !mutation.isPending && (
        <button
          onClick={handleGenerate}
          className="w-full py-2.5 px-4 rounded-xl bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors"
        >
          Generate AI Assessment
        </button>
      )}

      {mutation.isPending && (
        <div className="flex items-center justify-center gap-2 py-6">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span className="text-[length:var(--text-sm)] text-text-muted">Analyzing your trading behavior...</span>
        </div>
      )}

      {error && <div className="text-sm text-loss py-2">{error}</div>}

      {assessment && !mutation.isPending && (
        <div className="space-y-[var(--page-gap)]">
          <div>
            <div className="text-[length:var(--text-xs)] text-text-muted mb-1">Summary</div>
            <div className="text-[length:var(--text-sm)] text-text-heading">{assessment.behavioral_summary}</div>
          </div>

          {assessment.risk_level && (
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--text-xs)] text-text-muted">Risk Level:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                assessment.risk_level === 'low' ? 'bg-emerald-400/10 text-emerald-400' :
                assessment.risk_level === 'medium' ? 'bg-amber-400/10 text-amber-400' :
                assessment.risk_level === 'high' ? 'bg-red-400/10 text-red-400' :
                'bg-border/20 text-text-muted'
              }`}>
                {assessment.risk_level.toUpperCase()}
              </span>
              {assessment.composite_score != null && (
                <span className="text-xs font-data text-text-heading ml-auto">Score: {assessment.composite_score}/100</span>
              )}
            </div>
          )}

          {assessment.strengths.length > 0 && (
            <div>
              <div className="text-xs text-profit mb-1">Strengths</div>
              <ul className="space-y-1">
                {assessment.strengths.map((s, i) => (
                  <li key={i} className="text-xs text-text-heading pl-3 relative before:content-['+'] before:absolute before:left-0 before:text-profit">{' '}{s}</li>
                ))}
              </ul>
            </div>
          )}

          {assessment.weaknesses.length > 0 && (
            <div>
              <div className="text-xs text-loss mb-1">Weaknesses</div>
              <ul className="space-y-1">
                {assessment.weaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-text-heading pl-3 relative before:content-['-'] before:absolute before:left-0 before:text-loss">{' '}{w}</li>
                ))}
              </ul>
            </div>
          )}

          {assessment.recommendations.length > 0 && (
            <div>
              <div className="text-xs text-accent mb-1">Recommendations</div>
              <ul className="space-y-1">
                {assessment.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-text-heading pl-3 relative before:content-['→'] before:absolute before:left-0 before:text-accent">{' '}{r}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="w-full py-2 px-4 rounded-xl bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
          >
            Regenerate Assessment
          </button>
        </div>
      )}
    </div>
  )
}

export function BehavioralIntelligence() {
  const { data: overtrading } = useOvertradingQuery()
  const { data: earlyExits } = useEarlyExitQuery()
  const { data: discipline } = useDisciplineScoreQuery()

  const hasAnyData = overtrading || earlyExits || discipline

  if (!hasAnyData && !discipline) {
    return (
      <div className="space-y-[var(--page-gap)]">
        <SectionTitle icon={Brain} title="Behavioral Intelligence" />
        <EmptyState
          icon={Brain}
          title="No behavioral data"
          message="Trade, log emotions, and grade executions to unlock behavioral analytics."
        />
      </div>
    )
  }

  return (
    <div className="space-y-[var(--page-gap)]">
      <SectionTitle icon={Brain} title="Behavioral Intelligence" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DisciplineScoreCard />
        <OvertradingCard />
        <EarlyExitCard />
      </div>

      <AIAssessmentCard />
    </div>
  )
}
