import { useState, type ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useCoachingIntelligenceDashboardQuery } from '@/hooks/useCoachingIntelligenceQuery'
import {
  generateDailyReview, generateWeeklyReview,
  askCoach, detectPatterns, checkRuleReminders, listCoachReviews, deleteCoachReview,
} from '@/lib/endpoints'
import { useTradeReviewMutation } from '@/hooks/useTradeReviewMutation'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { Loader2, Sparkles, MessageSquare, AlertTriangle, CheckCircle2, History, Trash2, Brain, Calendar, Clock, Lightbulb, TrendingUp, Target } from 'lucide-react'
import type { PatternResult, CoachReviewListItem, TradeReviewResponse } from '@/types/coach'
import { formatCurrency } from '@/utils/format'


type Tab = 'daily' | 'weekly' | 'ask' | 'patterns' | 'rules' | 'review' | 'history'

const TAB_ITEMS = [
  { id: 'daily' as Tab, label: 'Daily Review', icon: Calendar },
  { id: 'weekly' as Tab, label: 'Weekly Review', icon: Clock },
  { id: 'ask' as Tab, label: 'Ask Coach', icon: MessageSquare },
  { id: 'patterns' as Tab, label: 'Patterns', icon: Brain },
  { id: 'rules' as Tab, label: 'Rule Check', icon: CheckCircle2 },
  { id: 'review' as Tab, label: 'Trade Review', icon: Target },
  { id: 'history' as Tab, label: 'History', icon: History },
]

function Markdown({ text }: { text: string }) {
  // Simple markdown rendering: bold (**text**), line breaks, bullet points
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 class="font-display text-sm text-accent mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-display text-base text-text-heading mt-4 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-text list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-text leading-relaxed mb-3">')
    .replace(/\n/g, '<br />')
  return <div className="text-sm text-text leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
}

function PatternCard({ pattern }: { pattern: PatternResult }) {
  const colors = { positive: 'border-profit/30 bg-profit-muted/10', negative: 'border-loss/30 bg-loss-muted/10', neutral: 'border-accent/30 bg-accent-muted/10' }
  const icons = { positive: <TrendingUp className="w-4 h-4 text-profit" />, negative: <AlertTriangle className="w-4 h-4 text-loss" />, neutral: <Lightbulb className="w-4 h-4 text-accent" /> }
  return (
    <div className={`rounded-xl border p-4 ${colors[pattern.severity]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icons[pattern.severity]}
        <span className="font-medium text-[length:var(--text-sm)] text-text-heading capitalize">{pattern.severity}: {pattern.name}</span>
      </div>
      <p className="text-[length:var(--text-xs)] text-text-muted mb-2">{pattern.description}</p>
      <div className="text-xs text-text bg-bg-elevated/50 rounded-lg px-3 py-2 mb-2">
        <span className="text-text-faint">Evidence: </span>{pattern.evidence}
      </div>
      {pattern.suggestion && (
        <p className="text-xs text-accent"><span className="text-text-faint">Suggestion: </span>{pattern.suggestion}</p>
      )}
    </div>
  )
}

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  excellent_execution: { bg: 'bg-profit-muted/20 border-profit/30', text: 'text-profit', label: 'Excellent Execution' },
  good_execution: { bg: 'bg-profit-muted/10 border-profit/20', text: 'text-profit', label: 'Good Execution' },
  flawed_but_profitable: { bg: 'bg-amber-500/10 border-amber-400/30', text: 'text-amber-400', label: 'Flawed but Profitable' },
  poor_execution: { bg: 'bg-loss-muted/10 border-loss/20', text: 'text-loss', label: 'Poor Execution' },
  disaster: { bg: 'bg-loss-muted/20 border-loss/40', text: 'text-loss', label: 'Disaster' },
}

function TradeReviewResult({ review }: { review: TradeReviewResponse }) {
  const style = VERDICT_STYLES[review.overall_verdict] ?? VERDICT_STYLES.poor_execution
  const maxScore = 10
  return (
    <div className="space-y-[var(--page-gap)] animate-card-in">
      {/* Verdict banner */}
      <div className={`rounded-2xl border p-4 ${style.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-lg font-bold font-display ${style.text}`}>{style.label}</span>
          <span className={`text-2xl font-bold font-data ${style.text}`}>{review.discipline_score}/100</span>
        </div>
        <p className="text-sm text-text">{review.summary}</p>
      </div>

      {/* Score radar */}
      <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
        <h4 className="text-[length:var(--text-xs)] font-medium text-text-heading mb-3">Execution Scores</h4>
        <div className="space-y-2">
          {([
            ['Entry Timing', review.scores.entry_timing],
            ['Exit Timing', review.scores.exit_timing],
            ['Risk Management', review.scores.risk_management],
            ['Plan Adherence', review.scores.plan_adherence],
            ['Psychology', review.scores.psychology],
          ] as [string, number][]).map(([label, score]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-[length:var(--text-xs)] text-text-muted w-32 min-w-[8rem]">{label}</span>
              <div className="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${score >= 7 ? 'bg-profit' : score >= 4 ? 'bg-amber-400' : 'bg-loss'}`}
                  style={{ width: `${(score / maxScore) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-data w-6 text-right ${score >= 7 ? 'text-profit' : score >= 4 ? 'text-amber-400' : 'text-loss'}`}>{score}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <span className="text-[length:var(--text-xs)] font-medium text-text-heading w-32 min-w-[8rem]">Overall</span>
            <div className="flex-1 h-2.5 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${review.scores.overall >= 7 ? 'bg-profit' : review.scores.overall >= 4 ? 'bg-amber-400' : 'bg-loss'}`}
                style={{ width: `${(review.scores.overall / maxScore) * 100}%` }}
              />
            </div>
            <span className={`text-sm font-bold font-data w-6 text-right ${review.scores.overall >= 7 ? 'text-profit' : review.scores.overall >= 4 ? 'text-amber-400' : 'text-loss'}`}>{review.scores.overall}</span>
          </div>
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
          <h4 className="text-[length:var(--text-xs)] font-medium text-profit mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Strengths
          </h4>
          {review.strengths.length === 0 ? <p className="text-[length:var(--text-xs)] text-text-muted">None identified</p> : (
            <ul className="space-y-1.5">
              {review.strengths.map((s, i) => (
                <li key={i} className="text-xs text-text flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-profit mt-1.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
          <h4 className="text-[length:var(--text-xs)] font-medium text-loss mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Weaknesses
          </h4>
          {review.weaknesses.length === 0 ? <p className="text-[length:var(--text-xs)] text-text-muted">None identified</p> : (
            <ul className="space-y-1.5">
              {review.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-text flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-loss mt-1.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Rule Violations */}
      {review.rule_violations.length > 0 && (
        <div className="bg-card rounded-2xl border border-loss/20 p-[var(--page-px)]">
          <h4 className="text-[length:var(--text-xs)] font-medium text-loss mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Rule Violations
          </h4>
          <ul className="space-y-1.5">
            {review.rule_violations.map((v, i) => (
              <li key={i} className="text-xs text-text bg-loss-muted/10 rounded-lg px-3 py-2">{v}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Missed Opportunity */}
      {review.missed_opportunity && (
        <div className="bg-card rounded-2xl border border-amber-400/20 p-[var(--page-px)]">
          <h4 className="text-[length:var(--text-xs)] font-medium text-amber-400 mb-3 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5" /> Missed Opportunity
          </h4>
          <div className="grid grid-cols-2 gap-3 mb-2">
            {review.missed_opportunity.better_exit_price != null && (
              <div>
                <div className="text-[10px] text-text-muted">Better Exit Price</div>
                <div className="text-sm font-data text-text-heading">{formatCurrency(review.missed_opportunity.better_exit_price)}</div>
              </div>
            )}
            {review.missed_opportunity.potential_r != null && (
              <div>
                <div className="text-[10px] text-text-muted">Potential R</div>
                <div className="text-sm font-data text-text-heading">{review.missed_opportunity.potential_r.toFixed(1)}R</div>
              </div>
            )}
          </div>
          <p className="text-xs text-text">{review.missed_opportunity.note}</p>
        </div>
      )}

      {/* Coaching Notes */}
      <div className="bg-card rounded-2xl border border-accent/20 p-[var(--page-px)]">
        <h4 className="text-[length:var(--text-xs)] font-medium text-accent mb-3 flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" /> Coaching Notes
        </h4>
        <div className="text-sm text-text leading-relaxed whitespace-pre-line">{review.coaching_notes}</div>
      </div>
    </div>
  )
}

export function AICoachPage() {
  const [tab, setTab] = useState<Tab>('daily')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Daily review state
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10))
  const [dailyResult, setDailyResult] = useState<string | null>(null)

  // Weekly review state
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() - 6); return d.toISOString().slice(0, 10)
  })
  const [weekEnd, setWeekEnd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10)
  })
  const [weeklyResult, setWeeklyResult] = useState<string | null>(null)

  // Ask coach state
  const [question, setQuestion] = useState('')
  const [askResult, setAskResult] = useState<string | null>(null)

  // Patterns state
  const [patternsLookback, setPatternsLookback] = useState(30)
  const [patterns, setPatterns] = useState<PatternResult[] | null>(null)

  // Rules state
  const [rulesLookback, setRulesLookback] = useState(7)
  const [ruleResult, setRuleResult] = useState<string | null>(null)

  // Trade Review state
  const [reviewTradeId, setReviewTradeId] = useState<number | null>(null)
  const reviewMutation = useTradeReviewMutation()
  const { data: tradesData } = useTradesQuery({ limit: 100 })
  const { data: coachingData } = useCoachingIntelligenceDashboardQuery()

  // History
  const [historyFilter, setHistoryFilter] = useState('')
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['coach-reviews', historyFilter],
    queryFn: () => listCoachReviews(historyFilter || undefined, 0, 50),
  })

  const handleDaily = async () => {
    setLoading(true); setError(null); setDailyResult(null)
    try {
      const d = new Date(dailyDate)
      const end = new Date(d); end.setDate(end.getDate() + 1)
      const res = await generateDailyReview(d.toISOString(), end.toISOString())
      setDailyResult(res.insight)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleWeekly = async () => {
    setLoading(true); setError(null); setWeeklyResult(null)
    try {
      const res = await generateWeeklyReview(new Date(weekStart).toISOString(), new Date(weekEnd).toISOString())
      setWeeklyResult(res.insight)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setLoading(true); setError(null); setAskResult(null)
    try {
      const res = await askCoach({ question: question.trim() })
      setAskResult(res.insight)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handlePatterns = async () => {
    setLoading(true); setError(null); setPatterns(null)
    try {
      const res = await detectPatterns(patternsLookback)
      setPatterns(res.patterns)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleRules = async () => {
    setLoading(true); setError(null); setRuleResult(null)
    try {
      const res = await checkRuleReminders(rulesLookback)
      setRuleResult(res.reminder)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleDeleteReview = async (id: number) => {
    await deleteCoachReview(id)
    refetchHistory()
  }

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">AI Coach</h1>
          <p className="text-[length:var(--text-sm)] text-text-muted mt-0.5">Personalized trading insights powered by AI</p>
        </div>
      </div>

      {coachingData?.weekly_plan && (
        <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-medium text-text-heading">Current Coaching Context</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Primary focus</div>
              <div className="text-sm text-text-heading">{coachingData.weekly_plan.primary_focus}</div>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Top setup</div>
              <div className="text-sm text-text-heading">
                {coachingData.setup_scores[0]
                  ? `${coachingData.setup_scores[0].setup} (${coachingData.setup_scores[0].label}, ${coachingData.setup_scores[0].score}/100)`
                  : 'No setup score yet'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Top drift</div>
              <div className="text-sm text-text-heading">
                {coachingData.behavioral_drift[0]?.title ?? 'No drift signal'}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-elevated/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-text-faint mb-1">Top review</div>
              <div className="text-sm text-text-heading">
                {coachingData.top_trade_review_prompts[0]
                  ? `${coachingData.top_trade_review_prompts[0].symbol} · ${coachingData.top_trade_review_prompts[0].focus_area}`
                  : 'No review prompts yet'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
        {TAB_ITEMS.map((t: { id: Tab; label: string; icon: ComponentType<{ className?: string }> }) => {
          const Icon = t.icon
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => { setTab(t.id); setError(null) }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[length:var(--text-xs)] font-medium whitespace-nowrap transition-all cursor-pointer ${
                tab === t.id ? 'bg-accent text-white' : 'bg-bg-elevated/50 text-text-muted hover:text-text-heading hover:bg-bg-card-h'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="bg-card rounded-2xl border border-border p-[var(--page-px)] sm:p-6 min-h-[300px]">
        {error && (
          <div className="flex items-start gap-2 mb-[var(--page-gap)] p-3 rounded-lg bg-loss-muted/20 border border-loss/20">
            <AlertTriangle className="w-4 h-4 text-loss shrink-0 mt-0.5" />
            <p className="text-[length:var(--text-xs)] text-loss">{error}</p>
          </div>
        )}

        {/* ─── Daily Review ─── */}
        {tab === 'daily' && (
          <div className="space-y-[var(--page-gap)]">
            <p className="text-[length:var(--text-sm)] text-text-muted">Generate a daily review of your trades, covering patterns, risk management, and improvement areas.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Date</label>
                <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
                  className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button type="button" onClick={handleDaily} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
              </button>
            </div>
            {dailyResult && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-bg-elevated/20">
                <Markdown text={dailyResult} />
              </div>
            )}
          </div>
        )}

        {/* ─── Weekly Review ─── */}
        {tab === 'weekly' && (
          <div className="space-y-[var(--page-gap)]">
            <p className="text-[length:var(--text-sm)] text-text-muted">Generate a weekly performance review with setup analysis, patterns, and priorities.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Week Start</label>
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
                  className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Week End</label>
                <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)}
                  className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button type="button" onClick={handleWeekly} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
              </button>
            </div>
            {weeklyResult && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-bg-elevated/20">
                <Markdown text={weeklyResult} />
              </div>
            )}
          </div>
        )}

        {/* ─── Ask the Coach ─── */}
        {tab === 'ask' && (
          <div className="space-y-[var(--page-gap)]">
            <p className="text-[length:var(--text-sm)] text-text-muted">Ask anything about your trading — get AI-powered analysis based on your actual trade data.</p>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="e.g. Why do I tend to lose on reversal setups? or What can I improve about my exit timing?"
              className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-[length:var(--text-sm)] text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all resize-none" />
            <div className="flex justify-end">
              <button type="button" onClick={handleAsk} disabled={loading || !question.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</> : <><MessageSquare className="w-4 h-4" /> Ask Coach</>}
              </button>
            </div>
            {askResult && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-bg-elevated/20">
                <Markdown text={askResult} />
              </div>
            )}
          </div>
        )}

        {/* ─── Pattern Detection ─── */}
        {tab === 'patterns' && (
          <div className="space-y-[var(--page-gap)]">
            <p className="text-[length:var(--text-sm)] text-text-muted">Detect recurring behavioral patterns in your recent trades — both positive and negative.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Lookback (days)</label>
                <input type="number" min={7} max={365} value={patternsLookback} onChange={(e) => setPatternsLookback(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button type="button" onClick={handlePatterns} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Brain className="w-4 h-4" /> Detect</>}
              </button>
            </div>
            {patterns && (
              <div className="mt-4 space-y-[var(--cell-py)]">
                {patterns.map((p, i) => <PatternCard key={i} pattern={p} />)}
              </div>
            )}
          </div>
        )}

        {/* ─── Rule Reminders ─── */}
        {tab === 'rules' && (
          <div className="space-y-[var(--page-gap)]">
            <p className="text-[length:var(--text-sm)] text-text-muted">Check if your recent trades are following proper trading rules and discipline.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Lookback (days)</label>
                <input type="number" min={1} max={90} value={rulesLookback} onChange={(e) => setRulesLookback(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button type="button" onClick={handleRules} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</> : <><CheckCircle2 className="w-4 h-4" /> Check</>}
              </button>
            </div>
            {ruleResult && (
              <div className="mt-4 p-4 rounded-xl border border-border bg-bg-elevated/20">
                <Markdown text={ruleResult} />
              </div>
            )}
          </div>
        )}

        {/* ─── Trade Review ─── */}
        {tab === 'review' && (
          <div className="space-y-[var(--page-gap)]">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-accent" />
              <h3 className="text-[length:var(--text-sm)] font-medium text-text-heading">Trade Review Engine</h3>
            </div>
            <p className="text-[length:var(--text-xs)] text-text-muted">Select a closed trade for a structured AI review — execution critique, discipline analysis, missed opportunity assessment, and coaching notes.</p>

            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Select Trade</label>
                <select
                  value={reviewTradeId ?? ''}
                  onChange={(e) => setReviewTradeId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-[length:var(--text-sm)] text-text-heading focus:outline-none focus:border-accent/50"
                >
                  <option value="">Choose a trade...</option>
                  {(tradesData?.items ?? [])
                    .filter(t => t.exit_price)
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        #{t.id} {t.symbol} — {formatCurrency(Number(t.pnl ?? 0))} ({t.setup ?? 'No setup'})
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => reviewTradeId && reviewMutation.mutate(reviewTradeId)}
                disabled={!reviewTradeId || reviewMutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50"
              >
                {reviewMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Target className="w-4 h-4" /> Review Trade</>}
              </button>
            </div>

            {reviewMutation.isPending && (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="text-[length:var(--text-sm)] text-text-muted">Analyzing trade execution, emotions, and playbook...</span>
              </div>
            )}

            {reviewMutation.error && (
              <div className="p-4 rounded-xl border border-loss/30 bg-loss-muted/10 text-[length:var(--text-xs)] text-loss">
                {reviewMutation.error.message || 'Review generation failed. Try again.'}
              </div>
            )}

            {reviewMutation.data && <TradeReviewResult review={reviewMutation.data} />}
          </div>
        )}

        {/* ─── Review History ─── */}
        {tab === 'history' && (
          <div className="space-y-[var(--page-gap)]">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}
                className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50">
                <option value="">All types</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="insight">Insight</option>
                <option value="answer">Answer</option>
                <option value="trade_review">Trade Review</option>
              </select>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 text-accent animate-spin mx-auto" /></div>
            ) : !historyData?.items?.length ? (
              <div className="py-8 text-center text-[length:var(--text-sm)] text-text-muted">No reviews yet.</div>
            ) : (
              <div className="space-y-2">
                {historyData.items.map((review: CoachReviewListItem) => (
                  <div key={review.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border hover:bg-bg-card-h transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-wider text-accent">{review.review_type}</span>
                        <span className="text-[length:var(--text-xs)] text-text-muted">{new Date(review.created_at).toLocaleDateString()}</span>
                        <span className="text-[length:var(--text-xs)] text-text-muted font-data">{review.trades_analyzed} trades</span>
                      </div>
                      <p className="text-sm text-text truncate">{review.content_preview}</p>
                    </div>
                    <button onClick={() => handleDeleteReview(review.id)}
                      className="p-1.5 rounded-md text-text-muted hover:text-loss hover:bg-loss-muted transition-colors cursor-pointer shrink-0"
                      aria-label={`Delete review ${review.review_type}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
