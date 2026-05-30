import type { TradingRecommendation } from '@/types/recommendations'
import {
  TrendingUp, AlertTriangle, Brain, Target,
  Activity, Shield, BookOpen, Clock, Sparkles,
} from 'lucide-react'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

const CATEGORY_ICONS: Record<string, typeof Brain> = {
  setup: Target,
  risk: Shield,
  execution: Activity,
  psychology: Brain,
  timing: Clock,
  review: BookOpen,
  capital: TrendingUp,
  market_context: TrendingUp,
}

const SEVERITY_COLORS: Record<string, { border: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
  critical: { border: 'border-loss/30', bg: 'bg-loss-muted/15', text: 'text-loss', icon: AlertTriangle },
  warning: { border: 'border-gold/30', bg: 'bg-gold-faint', text: 'text-gold', icon: AlertTriangle },
  positive: { border: 'border-profit/30', bg: 'bg-profit-muted/15', text: 'text-profit', icon: TrendingUp },
  info: { border: 'border-accent/20', bg: 'bg-accent-muted/15', text: 'text-accent', icon: Sparkles },
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100)
  const color = pct >= 70 ? 'bg-profit' : pct >= 40 ? 'bg-gold' : 'bg-loss'
  return (
    <div className="flex items-center gap-2 text-[10px] text-text-muted">
      <div className="w-12 h-1.5 bg-border rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-data">{pct}%</span>
    </div>
  )
}

interface RecommendationCardProps {
  recommendation: TradingRecommendation
  onSetupClick?: (setup: string) => void
}

export function RecommendationCard({ recommendation: r, onSetupClick }: RecommendationCardProps) {
  const Icon = CATEGORY_ICONS[r.category] || Brain
  const style = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.info

  return (
    <div className={`${CARD} ${style.border} ${style.bg} border`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style.bg} ${style.text}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`text-xs font-semibold ${style.text}`}>{r.title}</div>
              <div className="mt-1 text-sm text-text-heading leading-relaxed">{r.summary}</div>
            </div>
            <div className="shrink-0">
              <ConfidenceBar confidence={r.confidence} />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`text-[10px] font-data px-1.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
              {r.category}
            </span>
            <span className="text-[10px] font-data px-1.5 py-0.5 rounded-full bg-bg-elevated text-text-muted">
              {r.action_type.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="mt-2 text-xs text-text-muted leading-relaxed">{r.suggested_action}</div>

          {r.evidence.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.evidence.map((e, i) => (
                <span key={i} className="text-[10px] font-data px-1.5 py-0.5 rounded-full bg-bg-elevated/50 text-text-muted border border-border/30">
                  {e.metric}: {e.value}{e.benchmark != null ? ` (goal: ${e.benchmark})` : ''}{e.sample_size != null ? ` n=${e.sample_size}` : ''}
                </span>
              ))}
            </div>
          )}

          {r.related_setup && onSetupClick && (
            <button
              onClick={() => onSetupClick(r.related_setup!)}
              className="mt-2 text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer"
            >
              View setup: {r.related_setup} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
