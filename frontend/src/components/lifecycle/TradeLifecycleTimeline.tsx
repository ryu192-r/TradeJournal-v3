import { useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Shield, Target, Layers, MessageSquare,
  Activity, Flame, CheckCircle2, BarChart3,
} from 'lucide-react'
import { useTimelineQuery } from '@/hooks/useTimelineQuery'
import { useStopHistoryQuery } from '@/hooks/useStopHistoryQuery'
import { useEmotionLogsQuery } from '@/hooks/useEmotionLogQuery'
import { usePartialExitsQuery } from '@/hooks/usePartialExitQuery'
import { useExecutionGradeQuery } from '@/hooks/useExecutionGradeQuery'
import { formatPrice, formatDate } from '@/utils/format'
import type { TimelineEvent } from '@/types'

interface UnifiedTimelineProps {
  tradeId: number
}

interface TimelineItem {
  id: string
  type: string
  timestamp: string
  icon: React.ReactNode
  label: string
  detail: string
  badge?: string
  badgeClass?: string
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  trade_opened: { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Opened', color: 'text-accent' },
  trade_closed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Closed', color: 'text-profit' },
  stop_updated: { icon: <Shield className="w-3.5 h-3.5" />, label: 'Stop Updated', color: 'text-loss' },
  target_updated: { icon: <Target className="w-3.5 h-3.5" />, label: 'Target Updated', color: 'text-profit' },
  pyramided: { icon: <Layers className="w-3.5 h-3.5" />, label: 'Pyramided', color: 'text-accent' },
  partial_exit: { icon: <TrendingDown className="w-3.5 h-3.5" />, label: 'Partial Exit', color: 'text-text-muted' },
  note_added: { icon: <MessageSquare className="w-3.5 h-3.5" />, label: 'Note', color: 'text-text-muted' },
  conviction_changed: { icon: <Activity className="w-3.5 h-3.5" />, label: 'Conviction', color: 'text-accent' },
  emotion_logged: { icon: <Flame className="w-3.5 h-3.5" />, label: 'Emotion', color: 'text-amber-400' },
  review_added: { icon: <BarChart3 className="w-3.5 h-3.5" />, label: 'Review', color: 'text-text-muted' },
}

function formatDetail(event: TimelineEvent): string {
  if (event.new_value && event.old_value) {
    return `${event.old_value} → ${event.new_value}`
  }
  if (event.new_value) return event.new_value
  if (event.note) return event.note
  return ''
}

const EMOTION_META: Record<string, { label: string; color: string }> = {
  calm: { label: 'Calm', color: 'text-emerald-400' },
  fearful: { label: 'Fearful', color: 'text-red-400' },
  euphoric: { label: 'Euphoric', color: 'text-amber-400' },
  revenge: { label: 'Revenge', color: 'text-red-500' },
  fomo: { label: 'FOMO', color: 'text-orange-400' },
  hesitant: { label: 'Hesitant', color: 'text-yellow-400' },
  disciplined: { label: 'Disciplined', color: 'text-emerald-500' },
}

export function TradeLifecycleTimeline({ tradeId }: UnifiedTimelineProps) {
  const { data: timelineData } = useTimelineQuery(tradeId)
  const { data: stopData } = useStopHistoryQuery(tradeId)
  const { data: emotionData } = useEmotionLogsQuery(tradeId)
  const { data: partialData } = usePartialExitsQuery(tradeId)
  const { data: gradeData } = useExecutionGradeQuery(tradeId)

  const items = useMemo(() => {
    const all: TimelineItem[] = []

    if (timelineData?.items) {
      for (const e of timelineData.items) {
        const cfg = EVENT_CONFIG[e.event_type] || EVENT_CONFIG.note_added
        all.push({
          id: `tl-${e.id}`,
          type: e.event_type,
          timestamp: e.timestamp,
          icon: cfg.icon,
          label: cfg.label,
          detail: formatDetail(e),
          badge: e.emotion || undefined,
          badgeClass: EMOTION_META[e.emotion || '']?.color,
        })
      }
    }

    if (stopData?.items) {
      for (const s of stopData.items) {
        all.push({
          id: `sh-${s.id}`,
          type: 'stop_updated',
          timestamp: s.timestamp,
          icon: EVENT_CONFIG.stop_updated.icon,
          label: `Stop: ${s.stop_type}`,
          detail: formatPrice(Number(s.price)),
          badge: s.stop_type,
          badgeClass: 'text-text-muted',
        })
      }
    }

    if (partialData?.items) {
      for (const p of partialData.items) {
        all.push({
          id: `pe-${p.id}`,
          type: 'partial_exit',
          timestamp: p.exit_time,
          icon: EVENT_CONFIG.partial_exit.icon,
          label: 'Partial Exit',
          detail: `${p.qty} @ ${formatPrice(Number(p.exit_price))}`,
          badge: p.exit_reason || undefined,
        })
      }
    }

    if (emotionData?.items) {
      for (const em of emotionData.items) {
        const meta = EMOTION_META[em.emotion] || { label: em.emotion, color: 'text-text-muted' }
        all.push({
          id: `em-${em.id}`,
          type: 'emotion_logged',
          timestamp: em.timestamp,
          icon: EVENT_CONFIG.emotion_logged.icon,
          label: meta.label,
          detail: [em.confidence != null ? `Confidence: ${em.confidence}/10` : '', em.stress != null ? `Stress: ${em.stress}/10` : '', em.note || ''].filter(Boolean).join(' · '),
          badge: em.emotion,
          badgeClass: meta.color,
        })
      }
    }

    if (gradeData) {
      all.push({
        id: `eg-${gradeData.id}`,
        type: 'review_added',
        timestamp: gradeData.updated_at || gradeData.created_at || '',
        icon: EVENT_CONFIG.review_added.icon,
        label: `Execution Grade: ${gradeData.overall_grade || 'N/A'}`,
        detail: [gradeData.entry_quality && `Entry: ${gradeData.entry_quality}`, gradeData.exit_quality && `Exit: ${gradeData.exit_quality}`, gradeData.rule_adherence && `Rules: ${gradeData.rule_adherence}`, gradeData.notes || ''].filter(Boolean).join(' · '),
      })
    }

    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return all
  }, [timelineData, stopData, emotionData, partialData, gradeData])

  if (items.length === 0) {
    return (
      <div className="border-t border-border pt-4 mt-4">
        <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Lifecycle</div>
        <p className="text-xs text-text-muted text-center py-4">No lifecycle events recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="border-t border-border pt-4 mt-4">
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-3">Lifecycle</div>
      <div className="relative pl-4">
        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="relative flex gap-2.5 items-start">
              <div className={`relative z-10 w-3 h-3 rounded-full border-2 border-bg-card flex items-center justify-center mt-0.5 ${item.type === 'trade_opened' ? 'bg-accent' : item.type === 'trade_closed' ? 'bg-profit' : item.type === 'stop_updated' ? 'bg-red-400' : item.type === 'partial_exit' ? 'bg-amber-400' : 'bg-border'}`}>
                <span className="sr-only">{item.label}</span>
              </div>
              <div className="flex-1 min-w-0 pb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-text-heading">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-px rounded-full bg-bg-elevated ${item.badgeClass || 'text-text-muted'}`}>{item.badge}</span>
                  )}
                  <span className="text-[10px] text-text-muted ml-auto font-data">{formatDate(item.timestamp)}</span>
                </div>
                {item.detail && (
                  <p className="text-[11px] text-text-muted mt-0.5 truncate">{item.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}