import { useState } from 'react'
import { Flame, BarChart3, ArrowDownToLine } from 'lucide-react'
import { TradeLifecycleTimeline } from './TradeLifecycleTimeline'
import { EmotionLogger } from './EmotionLogger'
import { ExecutionGrader } from './ExecutionGrader'
import { PartialExitForm } from './PartialExitForm'
import { useExecutionGradeQuery } from '@/hooks/useExecutionGradeQuery'
import type { ApiTrade } from '@/types'

interface LifecycleReviewPanelProps {
  trade: ApiTrade
}

type ActivePanel = 'emotion' | 'grade' | 'partial_exit' | null

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const colors: Record<string, string> = {
    A: 'bg-[var(--profit)]/20 text-[var(--profit)] border-[var(--profit)]/30',
    B: 'bg-[var(--profit)]/15 text-[var(--profit)] border-[var(--profit)]/25',
    C: 'bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/25',
    D: 'bg-[var(--loss)]/15 text-[var(--loss)]/20 border-[var(--loss)]/25',
    F: 'bg-[var(--loss)]/20 text-[var(--loss)] border-[var(--loss)]/30',
  }
  return (
    <span className={`text-[9px] font-bold px-1 py-px rounded border ${colors[grade] || 'bg-border text-text-muted border-border'}`}>
      {grade}
    </span>
  )
}

export function LifecycleReviewPanel({ trade }: LifecycleReviewPanelProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const { data: gradeData } = useExecutionGradeQuery(trade.id)

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel(activePanel === panel ? null : panel)
  }

  return (
    <div className="pt-[var(--page-gap)]">
      <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider mb-3">Lifecycle Intelligence</div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => togglePanel('emotion')}
          className={`flex items-center gap-1 text-[length:var(--text-xs)] px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${activePanel === 'emotion' ? 'border-amber-400/50 bg-amber-400/10 text-amber-400' : 'border-border text-text-muted hover:text-text-heading hover:border-text-muted'}`}
        >
          <Flame className="w-3.5 h-3.5" />
          Emotion
        </button>

        <button
          onClick={() => togglePanel('partial_exit')}
          className={`flex items-center gap-1 text-[length:var(--text-xs)] px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${activePanel === 'partial_exit' ? 'border-accent/50 bg-accent-faint text-accent' : 'border-border text-text-muted hover:text-text-heading hover:border-text-muted'}`}
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Partial Exit
        </button>

        <button
          onClick={() => togglePanel('grade')}
          className={`flex items-center gap-1 text-[length:var(--text-xs)] px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer ${activePanel === 'grade' ? 'border-accent/50 bg-accent-faint text-accent' : 'border-border text-text-muted hover:text-text-heading hover:border-text-muted'}`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Grade
          {gradeData?.overall_grade && <GradeBadge grade={gradeData.overall_grade} />}
        </button>
      </div>

      {activePanel === 'emotion' && (
        <div className="border border-amber-400/20 rounded-xl p-[var(--page-px)] bg-bg-elevated/30 mb-3">
          <EmotionLogger tradeId={trade.id} onClose={() => setActivePanel(null)} />
        </div>
      )}

      {trade.exit_price == null && activePanel === 'partial_exit' && (
        <div className="border border-accent/20 rounded-xl p-[var(--page-px)] bg-bg-elevated/30 mb-3">
          <PartialExitForm
            tradeId={trade.id}
            entryPrice={Number(trade.entry_price)}
            currentQty={Number(trade.quantity)}
            remainingQty={trade.remaining_qty != null ? Number(trade.remaining_qty) : undefined}
            onClose={() => setActivePanel(null)}
          />
        </div>
      )}

      {activePanel === 'grade' && (
        <div className="border border-accent/20 rounded-xl p-[var(--page-px)] bg-bg-elevated/30 mb-3">
          <ExecutionGrader tradeId={trade.id} />
        </div>
      )}

      <TradeLifecycleTimeline tradeId={trade.id} />
    </div>
  )
}