import { Card } from '@/components/ui/Card'
import type { TradeReviewPrompt as TradeReviewPromptType } from '@/types/coachingIntelligence'
import { MessageSquare, Brain, TrendingUp, AlertTriangle, Shield, Target } from 'lucide-react'

const FOCUS_ICONS: Record<string, typeof Brain> = {
  loss_analysis: AlertTriangle,
  risk_management: Shield,
  psychology: Brain,
  execution_quality: Target,
  discipline: Shield,
  position_sizing: TrendingUp,
  positive_reinforcement: TrendingUp,
  general: MessageSquare,
}

const FOCUS_LABELS: Record<string, string> = {
  loss_analysis: 'Loss Analysis',
  risk_management: 'Risk Management',
  psychology: 'Psychology',
  execution_quality: 'Execution Quality',
  discipline: 'Discipline',
  position_sizing: 'Position Sizing',
  positive_reinforcement: 'Positive Reinforcement',
  general: 'Review',
}

export function TradeReviewPromptCard({ prompts }: { prompts: TradeReviewPromptType[] }) {
  if (!prompts.length) return null

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading">Trade Review Prompts</h3>
      </div>

      <div className="space-y-3">
        {prompts.slice(0, 5).map((p) => {
          const Icon = FOCUS_ICONS[p.focus_area] || MessageSquare
          const label = FOCUS_LABELS[p.focus_area] || p.focus_area
          return (
            <div key={p.trade_id} className="rounded-lg border border-border bg-bg-elevated p-3">
              <div className="flex items-start gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-heading">{p.symbol}</span>
                    <span className="text-[10px] text-text-faint font-data">#{p.trade_id}</span>
                    <span className="text-[10px] font-data uppercase text-accent px-1.5 py-0.5 rounded-full bg-accent-muted/10 border border-accent/20">
                      {label}
                    </span>
                  </div>
                  {p.setup && <span className="text-[10px] text-text-muted block">{p.setup}</span>}
                  <p className="text-[11px] text-text-muted mt-1">{p.why_this_trade}</p>
                </div>
              </div>

              {p.questions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <h4 className="text-[10px] uppercase tracking-wider text-text-faint font-medium">Questions</h4>
                  {p.questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-text">
                      <span className="w-1 h-1 rounded-full bg-accent mt-1.5 shrink-0" />
                      {q}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
