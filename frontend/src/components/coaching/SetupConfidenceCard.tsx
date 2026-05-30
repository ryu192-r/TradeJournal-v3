import { Card } from '@/components/ui/Card'
import type { SetupConfidenceScore } from '@/types/coachingIntelligence'
import { BookOpen, AlertTriangle } from 'lucide-react'

const LABEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  avoid: { bg: 'bg-loss-muted/10', text: 'text-loss', border: 'border-loss/20' },
  watch: { bg: 'bg-gold-faint', text: 'text-gold', border: 'border-gold/20' },
  developing: { bg: 'bg-accent-muted/10', text: 'text-accent', border: 'border-accent/20' },
  trusted: { bg: 'bg-profit-muted/10', text: 'text-profit', border: 'border-profit/20' },
  priority: { bg: 'bg-profit-muted/20', text: 'text-profit', border: 'border-profit/30' },
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-profit' : score >= 65 ? 'bg-profit' : score >= 50 ? 'bg-accent' : score >= 30 ? 'bg-gold' : 'bg-loss'
  return (
    <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  )
}

export function SetupConfidenceCard({ scores }: { scores: SetupConfidenceScore[] }) {
  if (!scores.length) return null

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <BookOpen className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium text-text-heading">Setup Confidence</h3>
      </div>

      <div className="space-y-3">
        {scores.slice(0, 8).map((s) => {
          const colors = LABEL_COLORS[s.label] || LABEL_COLORS.developing
          return (
            <div key={s.setup} className={`rounded-lg border p-3 ${colors.border} ${colors.bg}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-text-heading truncate">{s.setup}</span>
                  <span className={`text-[10px] font-data uppercase px-1.5 py-0.5 rounded-full ${colors.text} ${colors.bg} border ${colors.border}`}>
                    {s.label}
                  </span>
                </div>
                <span className={`text-sm font-bold font-data ${colors.text}`}>{s.score}/100</span>
              </div>
              <ScoreBar score={s.score} />
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted font-data">
                <span>{s.sample_size} closed</span>
                {s.win_rate != null && <span>{s.win_rate}% WR</span>}
                {s.avg_r != null && <span>{s.avg_r}R avg</span>}
                {s.total_pnl != null && <span>₹{s.total_pnl.toLocaleString('en-IN')}</span>}
              </div>
              {s.notes && (
                <div className="mt-1.5 flex items-start gap-1 text-[10px] text-text-faint">
                  <AlertTriangle className="w-2.5 h-2.5 shrink-0 mt-0.5" />
                  {s.notes}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
