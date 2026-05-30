import { ClipboardCheck } from 'lucide-react'
import type { TradeReviewV2Response, ScoreLabel } from '@/types/tradeReviewV2'
import { DimensionScoreCard } from './DimensionScoreCard'
import { MistakeTagBadge } from './MistakeTagBadge'

const VERDICT_LABELS: Record<string, string> = {
  excellent_execution: 'Excellent execution',
  good_execution: 'Good execution',
  flawed_but_profitable: 'Flawed but profitable',
  poor_execution: 'Poor execution',
  rule_break_trade: 'Rule break',
  risk_violation_trade: 'Risk violation',
  incomplete_open_trade: 'Incomplete — still open',
}

const OVERALL_COLORS: Record<ScoreLabel, string> = {
  excellent: 'border-profit/40 bg-profit-muted/10',
  good: 'border-profit/30 bg-profit-muted/5',
  average: 'border-border bg-bg-elevated/30',
  weak: 'border-gold/30 bg-gold/5',
  critical: 'border-loss/30 bg-loss-muted/10',
}

export function TradeReviewV2Card({ review }: { review: TradeReviewV2Response }) {
  const verdictLabel = VERDICT_LABELS[review.verdict] ?? review.verdict.replace(/_/g, ' ')
  const coreDimensions = review.dimension_scores.filter((d) => d.dimension !== 'playbook_alignment')
  const playbookDim = review.dimension_scores.find((d) => d.dimension === 'playbook_alignment')

  return (
    <div className="space-y-[var(--page-gap)] min-w-0">
      <div className={`rounded-2xl border p-[var(--page-px)] ${OVERALL_COLORS[review.overall_label]}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="text-[length:var(--text-sm)] font-medium text-text-heading truncate">
                {verdictLabel}
              </p>
              <p className="text-[10px] text-text-muted">
                Deterministic review · {review.source}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold font-data text-text-heading">{review.overall_score}</span>
            <span className="text-[length:var(--text-xs)] text-text-muted">/100</span>
            <p className="text-[10px] uppercase tracking-wider text-text-faint">{review.overall_label}</p>
          </div>
        </div>
      </div>

      {review.mistake_tags.length > 0 && (
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Mistake tags</p>
          <div className="flex flex-wrap gap-1.5">
            {review.mistake_tags.map((t) => (
              <MistakeTagBadge key={t.tag} tag={t} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
        {coreDimensions.map((d) => (
          <DimensionScoreCard key={d.dimension} dimension={d} />
        ))}
      </div>

      {playbookDim && (
        <DimensionScoreCard dimension={playbookDim} />
      )}

      {(review.strengths.length > 0 || review.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
          {review.strengths.length > 0 && (
            <div className="rounded-xl border border-profit/20 bg-profit-muted/5 p-3 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-profit mb-2">Strengths</p>
              <ul className="text-[length:var(--text-xs)] text-text space-y-1 list-disc pl-4">
                {review.strengths.map((s, i) => (
                  <li key={i} className="break-words">{s}</li>
                ))}
              </ul>
            </div>
          )}
          {review.weaknesses.length > 0 && (
            <div className="rounded-xl border border-loss/20 bg-loss-muted/5 p-3 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-loss mb-2">Weaknesses</p>
              <ul className="text-[length:var(--text-xs)] text-text space-y-1 list-disc pl-4">
                {review.weaknesses.map((w, i) => (
                  <li key={i} className="break-words">{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {review.what_should_have_happened.length > 0 && (
        <div className="rounded-xl border border-border p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">What should have happened</p>
          <ul className="text-[length:var(--text-xs)] text-text-heading space-y-1 list-disc pl-4">
            {review.what_should_have_happened.map((item, i) => (
              <li key={i} className="break-words">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {review.next_time_rules.length > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-accent mb-2">Next-time rules</p>
          <ul className="text-[length:var(--text-xs)] text-text space-y-1 list-disc pl-4">
            {review.next_time_rules.map((rule, i) => (
              <li key={i} className="break-words">{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {review.review_questions.length > 0 && (
        <div className="rounded-xl border border-border p-3 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Review questions</p>
          <ul className="text-[length:var(--text-xs)] text-text-muted space-y-1.5">
            {review.review_questions.map((q, i) => (
              <li key={i} className="break-words">• {q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
