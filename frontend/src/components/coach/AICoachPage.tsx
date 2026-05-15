import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  generateDailyReview, generateWeeklyReview,
  askCoach, detectPatterns, checkRuleReminders, listCoachReviews, deleteCoachReview,
} from '@/lib/endpoints'
import { Loader2, Sparkles, MessageSquare, AlertTriangle, CheckCircle2, History, Trash2, Brain, Calendar, Clock, Lightbulb, TrendingUp } from 'lucide-react'
import type { PatternResult, CoachReviewListItem } from '@/types/coach'

type Tab = 'daily' | 'weekly' | 'ask' | 'patterns' | 'rules' | 'history'

const TABS: { id: Tab; label: string; icon: typeof Sparkles }[] = [
  { id: 'daily', label: 'Daily Review', icon: Calendar },
  { id: 'weekly', label: 'Weekly Review', icon: Clock },
  { id: 'ask', label: 'Ask Coach', icon: MessageSquare },
  { id: 'patterns', label: 'Patterns', icon: Brain },
  { id: 'rules', label: 'Rule Check', icon: CheckCircle2 },
  { id: 'history', label: 'Review History', icon: History },
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
        <span className="font-medium text-sm text-text-heading capitalize">{pattern.severity}: {pattern.name}</span>
      </div>
      <p className="text-xs text-text-muted mb-2">{pattern.description}</p>
      <div className="text-xs text-text bg-bg-elevated/50 rounded-lg px-3 py-2 mb-2">
        <span className="text-text-faint">Evidence: </span>{pattern.evidence}
      </div>
      {pattern.suggestion && (
        <p className="text-xs text-accent"><span className="text-text-faint">Suggestion: </span>{pattern.suggestion}</p>
      )}
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
          <p className="text-sm text-text-muted mt-0.5">Personalized trading insights powered by AI</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null) }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
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
      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 min-h-[300px]">
        {error && (
          <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-loss-muted/20 border border-loss/20">
            <AlertTriangle className="w-4 h-4 text-loss shrink-0 mt-0.5" />
            <p className="text-xs text-loss">{error}</p>
          </div>
        )}

        {/* ─── Daily Review ─── */}
        {tab === 'daily' && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Generate a daily review of your trades, covering patterns, risk management, and improvement areas.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-text-muted mb-1">Date</label>
                <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
                  className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button onClick={handleDaily} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
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
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Generate a weekly performance review with setup analysis, patterns, and priorities.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-text-muted mb-1">Week Start</label>
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
                  className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Week End</label>
                <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)}
                  className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button onClick={handleWeekly} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
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
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Ask anything about your trading — get AI-powered analysis based on your actual trade data.</p>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} placeholder="e.g. Why do I tend to lose on reversal setups? or What can I improve about my exit timing?"
              className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all resize-none" />
            <div className="flex justify-end">
              <button onClick={handleAsk} disabled={loading || !question.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
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
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Detect recurring behavioral patterns in your recent trades — both positive and negative.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-text-muted mb-1">Lookback (days)</label>
                <input type="number" min={7} max={365} value={patternsLookback} onChange={(e) => setPatternsLookback(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button onClick={handlePatterns} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Brain className="w-4 h-4" /> Detect</>}
              </button>
            </div>
            {patterns && (
              <div className="mt-4 space-y-3">
                {patterns.map((p, i) => <PatternCard key={i} pattern={p} />)}
              </div>
            )}
          </div>
        )}

        {/* ─── Rule Reminders ─── */}
        {tab === 'rules' && (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Check if your recent trades are following proper trading rules and discipline.</p>
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-text-muted mb-1">Lookback (days)</label>
                <input type="number" min={1} max={90} value={rulesLookback} onChange={(e) => setRulesLookback(Number(e.target.value))}
                  className="w-24 rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
              </div>
              <button onClick={handleRules} disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50 mt-5">
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

        {/* ─── Review History ─── */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}
                className="rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50">
                <option value="">All types</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="insight">Insight</option>
                <option value="answer">Answer</option>
              </select>
            </div>

            {historyLoading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 text-accent animate-spin mx-auto" /></div>
            ) : !historyData?.items?.length ? (
              <div className="py-8 text-center text-sm text-text-muted">No reviews yet.</div>
            ) : (
              <div className="space-y-2">
                {historyData.items.map((review: CoachReviewListItem) => (
                  <div key={review.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border hover:bg-bg-card-h transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wider text-accent">{review.review_type}</span>
                        <span className="text-xs text-text-muted">{new Date(review.created_at).toLocaleDateString()}</span>
                        <span className="text-xs text-text-muted font-data">{review.trades_analyzed} trades</span>
                      </div>
                      <p className="text-sm text-text truncate">{review.content_preview}</p>
                    </div>
                    <button onClick={() => handleDeleteReview(review.id)}
                      className="p-1.5 rounded-md text-text-muted hover:text-loss hover:bg-loss-muted transition-colors cursor-pointer shrink-0">
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