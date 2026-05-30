import type { ReviewDimensionScore, ScoreLabel } from '@/types/tradeReviewV2'

const LABEL_COLORS: Record<ScoreLabel, string> = {
  excellent: 'text-profit',
  good: 'text-profit',
  average: 'text-text-heading',
  weak: 'text-gold',
  critical: 'text-loss',
}

const BAR_COLORS: Record<ScoreLabel, string> = {
  excellent: 'bg-profit',
  good: 'bg-profit/70',
  average: 'bg-accent/60',
  weak: 'bg-gold',
  critical: 'bg-loss',
}

function formatDimension(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function DimensionScoreCard({ dimension }: { dimension: ReviewDimensionScore }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[length:var(--text-xs)] font-medium text-text-heading truncate">
          {formatDimension(dimension.dimension)}
        </span>
        <span className={`text-sm font-bold font-data shrink-0 ${LABEL_COLORS[dimension.label]}`}>
          {dimension.score}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${BAR_COLORS[dimension.label]}`}
          style={{ width: `${Math.min(100, Math.max(0, dimension.score))}%` }}
        />
      </div>
      <p className="text-[10px] text-text-muted leading-snug">{dimension.reason}</p>
      {dimension.evidence.length > 0 && (
        <ul className="text-[10px] text-text-faint space-y-0.5 list-disc pl-3">
          {dimension.evidence.slice(0, 3).map((e, i) => (
            <li key={i} className="break-words">{e}</li>
          ))}
        </ul>
      )}
      {dimension.improvement && (
        <p className="text-[10px] text-accent leading-snug">{dimension.improvement}</p>
      )}
    </div>
  )
}
