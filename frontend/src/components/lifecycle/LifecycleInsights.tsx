import { useEmotionSummaryQuery, useGradeSummaryQuery, useBehavioralAnalyticsQuery, useRevengeTradesQuery } from '@/hooks/useLifecycleAnalyticsQuery'
import { formatCurrency } from '@/utils/format'
import { Brain, AlertTriangle, Target, Shield, Zap, TrendingDown } from 'lucide-react'
import type { EmotionSummaryEntry, GradePnlEntry, BehavioralInsight, RevengeTrade } from '@/types'

const CARD = 'bg-card rounded-2xl border border-border p-5 animate-card-in'

const EMOTION_COLORS: Record<string, string> = {
  calm: 'text-blue-400',
  disciplined: 'text-emerald-400',
  fomo: 'text-amber-400',
  fearful: 'text-red-400',
  hesitant: 'text-orange-400',
  euphoric: 'text-purple-400',
  revenge: 'text-red-500',
}

const EMOTION_BG: Record<string, string> = {
  calm: 'bg-blue-400/10',
  disciplined: 'bg-emerald-400/10',
  fomo: 'bg-amber-400/10',
  fearful: 'bg-red-400/10',
  hesitant: 'bg-orange-400/10',
  euphoric: 'bg-purple-400/10',
  revenge: 'bg-red-500/10',
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-400/10',
  B: 'text-emerald-300 bg-emerald-300/10',
  C: 'text-amber-400 bg-amber-400/10',
  D: 'text-orange-400 bg-orange-400/10',
  F: 'text-red-400 bg-red-400/10',
}

function EmotionBreakdown({ emotions, mostFrequent }: { emotions: EmotionSummaryEntry[]; mostFrequent: string | null }) {
  if (!emotions.length) {
    return <div className="text-sm text-text-muted text-center py-6">No emotion data yet. Log emotions on your trades to see patterns.</div>
  }
  const total = emotions.reduce((s, e) => s + e.count, 0)
  return (
    <div className="space-y-2">
      {emotions.map((e) => {
        const pct = total > 0 ? (e.count / total) * 100 : 0
        return (
          <div key={e.emotion} className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full shrink-0 ${EMOTION_COLORS[e.emotion]?.replace('text-', 'bg-') ?? 'bg-border'}`} />
            <span className={`text-sm w-28 ${EMOTION_COLORS[e.emotion] ?? 'text-text-heading'}`}>{e.emotion}</span>
            <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${EMOTION_BG[e.emotion] ?? 'bg-accent/20'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-text-muted font-data w-8 text-right">{e.count}</span>
            {e.win_rate != null && <span className={`text-xs font-data w-14 text-right ${e.win_rate >= 50 ? 'text-profit' : 'text-loss'}`}>{e.win_rate}%</span>}
          </div>
        )
      })}
      {mostFrequent && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-text-muted">
          Most frequent: <span className="font-medium text-text-heading">{mostFrequent}</span>
        </div>
      )}
    </div>
  )
}

function GradeDistribution({ gradePnl, avgOverall }: { gradePnl: GradePnlEntry[]; avgOverall: number | null }) {
  if (!gradePnl.length) {
    return <div className="text-sm text-text-muted text-center py-6">No execution grades yet. Grade your trades to see distribution.</div>
  }
  return (
    <div className="space-y-2">
      {gradePnl.map((g) => (
        <div key={g.grade} className="flex items-center justify-between text-sm">
          <span className={`font-bold w-8 ${GRADE_COLORS[g.grade]?.split(' ')[0] ?? 'text-text-heading'}`}>{g.grade}</span>
          <span className="text-text-muted font-data">{g.count} trades</span>
          <span className={`font-data ${Decimal(g.avg_pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(parseFloat(g.avg_pnl))}</span>
          <span className="text-text-muted font-data w-14 text-right">{g.win_rate ?? '—'}%</span>
        </div>
      ))}
      {avgOverall != null && (
        <div className="mt-3 pt-3 border-t border-border text-xs text-text-muted">
          Average grade: <span className="font-medium text-text-heading">{avgOverall}/5</span>
        </div>
      )}
    </div>
  )
}

function Decimal(v: string): number { return parseFloat(v) }

function BehavioralInsights({ insights, disciplineScore }: { insights: BehavioralInsight[]; disciplineScore: number | null }) {
  return (
    <div className="space-y-3">
      {disciplineScore != null && (
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-4 h-4 text-accent" />
          <span className="text-sm text-text-muted">Discipline Score</span>
          <span className="font-data text-lg font-bold text-text-heading">{disciplineScore}%</span>
        </div>
      )}
      {insights.length === 0 && disciplineScore == null && (
        <div className="text-sm text-text-muted text-center py-4">No behavioral patterns detected yet.</div>
      )}
      {insights.map((insight, i) => (
        <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${insight.type === 'warning' ? 'bg-loss-muted/20' : 'bg-accent-muted/20'}`}>
          {insight.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-loss shrink-0 mt-0.5" /> : <Brain className="w-4 h-4 text-accent shrink-0 mt-0.5" />}
          <div className="text-sm text-text-heading">{insight.message}</div>
        </div>
      ))}
    </div>
  )
}

function RevengeTradesSection({ revengeTrades, totalFlagged, avgPnlFlagged, avgPnlUnflagged }: {
  revengeTrades: RevengeTrade[]; totalFlagged: number; avgPnlFlagged: number | null; avgPnlUnflagged: number | null
}) {
  if (!totalFlagged) {
    return <div className="text-sm text-text-muted text-center py-4">No revenge trade patterns detected.</div>
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold font-data text-loss">{totalFlagged}</div>
          <div className="text-[11px] text-text-muted">Flagged</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold font-data ${avgPnlFlagged != null && avgPnlFlagged >= 0 ? 'text-profit' : 'text-loss'}`}>{avgPnlFlagged != null ? formatCurrency(avgPnlFlagged) : '—'}</div>
          <div className="text-[11px] text-text-muted">Avg PnL (flagged)</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold font-data ${avgPnlUnflagged != null && avgPnlUnflagged >= 0 ? 'text-profit' : 'text-loss'}`}>{avgPnlUnflagged != null ? formatCurrency(avgPnlUnflagged) : '—'}</div>
          <div className="text-[11px] text-text-muted">Avg PnL (others)</div>
        </div>
      </div>
      {revengeTrades.slice(0, 5).map((rt) => (
        <div key={rt.trade_id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-loss" />
            <span className="text-sm font-data text-text-heading">{rt.symbol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${rt.flagged_reason === 'emotion' ? 'bg-red-400/10 text-red-400' : rt.flagged_reason === 'both' ? 'bg-red-500/10 text-red-500' : 'bg-amber-400/10 text-amber-400'}`}>
              {rt.flagged_reason}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {rt.hours_after_loss != null && <span className="text-[10px] text-text-muted">+{rt.hours_after_loss}h</span>}
            {rt.pnl != null && <span className={`text-xs font-data ${parseFloat(rt.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(parseFloat(rt.pnl))}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function LifecycleInsights() {
  const { data: emotionData } = useEmotionSummaryQuery()
  const { data: gradeData } = useGradeSummaryQuery()
  const { data: behavioralData } = useBehavioralAnalyticsQuery()
  const { data: revengeData } = useRevengeTradesQuery()

  const hasEmotionData = emotionData && emotionData.total_logs > 0
  const hasGradeData = gradeData && Object.keys(gradeData.grade_distribution).length > 0

  if (!hasEmotionData && !hasGradeData) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="w-[15px] h-[15px] text-accent" />
        <h2 className="font-display text-[length:var(--heading-size)] text-text-heading">Lifecycle Insights</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hasEmotionData && (
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-medium text-text-heading">Emotion Breakdown</h3>
            </div>
            <EmotionBreakdown emotions={emotionData.emotions} mostFrequent={emotionData.most_frequent} />
          </div>
        )}

        {hasGradeData && (
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-medium text-text-heading">Execution Grades</h3>
            </div>
            <GradeDistribution gradePnl={gradeData.grade_pnl} avgOverall={gradeData.avg_overall} />
          </div>
        )}

        {behavioralData && (behavioralData.insights.length > 0 || behavioralData.discipline_score != null) && (
          <div className={CARD}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-medium text-text-heading">Behavioral Patterns</h3>
            </div>
            <BehavioralInsights insights={behavioralData.insights} disciplineScore={behavioralData.discipline_score} />
          </div>
        )}
      </div>

      {revengeData && revengeData.total_flagged > 0 && (
        <div className={CARD}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-loss" />
            <h3 className="text-sm font-medium text-text-heading">Revenge Trade Detection</h3>
          </div>
          <RevengeTradesSection
            revengeTrades={revengeData.revenge_trades}
            totalFlagged={revengeData.total_flagged}
            avgPnlFlagged={revengeData.avg_pnl_flagged}
            avgPnlUnflagged={revengeData.avg_pnl_unflagged}
          />
        </div>
      )}
    </div>
  )
}