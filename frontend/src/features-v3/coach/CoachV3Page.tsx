import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, History, Loader2, MessageSquare, Sparkles, Target, Trash2 } from 'lucide-react'
import { EmptyState, ErrorState, Page, Panel, Skeleton, Stack } from '@/new-ui'
import {
  generateDailyReview, generateWeeklyReview,
  askCoach, listCoachReviews, deleteCoachReview, generateTradeReview,
} from '@/lib/endpoints'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { formatCurrency } from '@/utils/format'
import type { TradeReviewResponse, CoachReviewListItem } from '@/types/coach'

// ─── Types ──────────────────────────────────────────────────────────

type Tab = 'daily' | 'weekly' | 'ask' | 'review' | 'history'

const TABS: { id: Tab; label: string; icon: typeof Calendar }[] = [
  { id: 'daily', label: 'Daily Briefing', icon: Calendar },
  { id: 'weekly', label: 'Weekly Review', icon: Clock },
  { id: 'ask', label: 'Ask Coach', icon: MessageSquare },
  { id: 'review', label: 'Trade Review', icon: Target },
  { id: 'history', label: 'History', icon: History },
]

// ─── Helpers ─────────────────────────────────────────────────────────

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 class="font-display text-sm text-accent mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-display text-base text-text-heading mt-4 mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-text list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="text-sm text-text leading-relaxed mb-3">')
    .replace(/\n/g, '<br />')
  return <div className="text-sm text-text leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
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
    <Stack gap="md">
      <div className={`rounded-2xl border p-4 ${style.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-lg font-bold font-display ${style.text}`}>{style.label}</span>
          <span className={`text-2xl font-bold font-data ${style.text}`}>{review.discipline_score}/100</span>
        </div>
        <p className="text-sm text-text">{review.summary}</p>
      </div>

      <Panel title="Execution Scores">
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
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Strengths">
          {review.strengths.length === 0 ? <p className="text-[length:var(--text-xs)] text-text-muted">None identified</p> : (
            <ul className="space-y-1.5">
              {review.strengths.map((s, i) => (
                <li key={i} className="text-xs text-text flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-profit mt-1.5 shrink-0" />{s}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Weaknesses">
          {review.weaknesses.length === 0 ? <p className="text-[length:var(--text-xs)] text-text-muted">None identified</p> : (
            <ul className="space-y-1.5">
              {review.weaknesses.map((w, i) => (
                <li key={i} className="text-xs text-text flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-loss mt-1.5 shrink-0" />{w}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {review.rule_violations.length > 0 && (
        <Panel title="Rule Violations">
          <ul className="space-y-1.5">
            {review.rule_violations.map((v, i) => (
              <li key={i} className="text-xs text-text bg-loss-muted/10 rounded-lg px-3 py-2">{v}</li>
            ))}
          </ul>
        </Panel>
      )}

      {review.missed_opportunity && (
        <Panel title="Missed Opportunity">
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
        </Panel>
      )}

      <Panel title="Coaching Notes">
        <div className="text-sm text-text leading-relaxed whitespace-pre-line">{review.coaching_notes}</div>
      </Panel>
    </Stack>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────

export function CoachV3Page() {
  const [tab, setTab] = useState<Tab>('daily')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Daily
  const [dailyDate, setDailyDate] = useState(new Date().toISOString().slice(0, 10))
  const [dailyResult, setDailyResult] = useState<string | null>(null)

  // Weekly
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() - 6); return d.toISOString().slice(0, 10)
  })
  const [weekEnd, setWeekEnd] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10)
  })
  const [weeklyResult, setWeeklyResult] = useState<string | null>(null)

  // Ask
  const [question, setQuestion] = useState('')
  const [askResult, setAskResult] = useState<string | null>(null)

  // Trade Review
  const [reviewTradeId, setReviewTradeId] = useState<number | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewResult, setReviewResult] = useState<TradeReviewResponse | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const { data: tradesData } = useTradesQuery({ limit: 100 })

  // History
  const [historyFilter, setHistoryFilter] = useState('')
  const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ['coach-reviews', historyFilter],
    queryFn: () => listCoachReviews(historyFilter || undefined, 0, 50),
  })

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); setError(null)
    try { await fn() }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  const handleDaily = () => wrap(async () => {
    const d = new Date(dailyDate)
    const end = new Date(d); end.setDate(end.getDate() + 1)
    const res = await generateDailyReview(d.toISOString(), end.toISOString())
    setDailyResult(res.insight)
  })

  const handleWeekly = () => wrap(async () => {
    const res = await generateWeeklyReview(new Date(weekStart).toISOString(), new Date(weekEnd).toISOString())
    setWeeklyResult(res.insight)
  })

  const handleAsk = () => {
    if (!question.trim()) return
    wrap(async () => {
      const res = await askCoach({ question: question.trim() })
      setAskResult(res.insight)
    })
  }

  const handleTradeReview = async () => {
    if (!reviewTradeId) return
    setReviewLoading(true); setReviewError(null); setReviewResult(null)
    try {
      const res = await generateTradeReview(reviewTradeId)
      setReviewResult(res)
    } catch (e: unknown) {
      setReviewError(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setReviewLoading(false)
    }
  }

  const handleDeleteReview = async (id: number) => {
    await deleteCoachReview(id)
    refetchHistory()
  }

  const renderTabContent = () => {
    switch (tab) {
      case 'daily':
        return (
          <Panel title="Daily Briefing" description="Daily review of your trades — patterns, risk management, and improvement areas.">
            <Stack gap="md">
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Date</label>
                  <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)}
                    className="rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
                </div>
                <button type="button" onClick={handleDaily} disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                </button>
              </div>
              {dailyResult && <div className="p-4 rounded-xl border border-border bg-bg-elevated/20"><Markdown text={dailyResult} /></div>}
            </Stack>
          </Panel>
        )

      case 'weekly':
        return (
          <Panel title="Weekly Review" description="Weekly performance review with setup analysis, patterns, and priorities.">
            <Stack gap="md">
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Week Start</label>
                  <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)}
                    className="rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
                </div>
                <div>
                  <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Week End</label>
                  <input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)}
                    className="rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50" />
                </div>
                <button type="button" onClick={handleWeekly} disabled={loading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
                </button>
              </div>
              {weeklyResult && <div className="p-4 rounded-xl border border-border bg-bg-elevated/20"><Markdown text={weeklyResult} /></div>}
            </Stack>
          </Panel>
        )

      case 'ask':
        return (
          <Panel title="Ask Coach" description="Ask anything about your trading — AI-powered analysis based on your actual trade data.">
            <Stack gap="md">
              <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
                placeholder="e.g. Why do I tend to lose on reversal setups? or What can I improve about my exit timing?"
                className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-[length:var(--text-sm)] text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all resize-none" />
              <div className="flex justify-end">
                <button type="button" onClick={handleAsk} disabled={loading || !question.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Thinking...</> : <><MessageSquare className="w-4 h-4" /> Ask Coach</>}
                </button>
              </div>
              {askResult && <div className="p-4 rounded-xl border border-border bg-bg-elevated/20"><Markdown text={askResult} /></div>}
            </Stack>
          </Panel>
        )

      case 'review':
        return (
          <Panel title="Trade Review" description="Structured AI review — execution critique, discipline analysis, missed opportunity assessment, and coaching notes.">
            <Stack gap="md">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-[length:var(--text-xs)] text-text-muted mb-1">Select Trade</label>
                  <select
                    value={reviewTradeId ?? ''}
                    onChange={(e) => { setReviewTradeId(e.target.value ? Number(e.target.value) : null); setReviewResult(null) }}
                    className="w-full rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-[length:var(--text-sm)] text-text-heading focus:outline-none focus:border-accent/50">
                    <option value="">Choose a trade...</option>
                    {(tradesData?.items ?? [])
                      .filter(t => t.exit_price != null)
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          #{t.id} {t.symbol} — {formatCurrency(Number(t.pnl ?? 0))} ({t.setup ?? 'No setup'})
                        </option>
                      ))}
                  </select>
                </div>
                <button type="button" onClick={handleTradeReview}
                  disabled={!reviewTradeId || reviewLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                  {reviewLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Target className="w-4 h-4" /> Review Trade</>}
                </button>
              </div>
              {reviewLoading && (
                <div className="flex items-center gap-2 py-6 justify-center">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  <span className="text-[length:var(--text-sm)] text-text-muted">Analyzing trade execution, emotions, and playbook...</span>
                </div>
              )}
              {reviewError && (
                <div className="p-4 rounded-xl border border-loss/30 bg-loss-muted/10 text-[length:var(--text-xs)] text-loss">
                  {reviewError}
                </div>
              )}
              {reviewResult && <TradeReviewResult review={reviewResult} />}
            </Stack>
          </Panel>
        )

      case 'history':
        return (
          <Panel title="Review History">
            <Stack gap="md">
              <select value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}
                className="rounded-lg border border-border bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 w-40">
                <option value="">All types</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="answer">Answer</option>
                <option value="trade_review">Trade Review</option>
              </select>
              {historyLoading ? (
                <Skeleton height="3rem" />
              ) : !historyData?.items?.length ? (
                <EmptyState title="No reviews yet" description="Generate a review to see history." />
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
                        aria-label={`Delete review ${review.review_type}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Stack>
          </Panel>
        )
    }
  }

  return (
    <Page title="AI Coach" subtitle="Personalized trading insights powered by AI">
      <Stack gap="lg">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto scrollbar-thin pb-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setError(null) }}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-lg text-[length:var(--text-xs)] font-medium transition-colors cursor-pointer ${
                  tab === t.id ? 'bg-accent text-white' : 'bg-bg-elevated/50 text-text-muted hover:text-text-heading hover:bg-bg-card-h'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Error banner */}
        {error && (
          <ErrorState title="Request failed" description={error} onRetry={() => setError(null)} />
        )}

        {/* Tab content */}
        {renderTabContent()}
      </Stack>
    </Page>
  )
}
