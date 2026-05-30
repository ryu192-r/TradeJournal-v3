import type { EdgePriority, EdgePrioritySeverity } from '@/types/edgeCommandCenter'

const SEVERITY_STYLES: Record<EdgePrioritySeverity, string> = {
  positive: 'border-profit/30 bg-profit-muted/10',
  info: 'border-border bg-bg-elevated/30',
  warning: 'border-gold/30 bg-gold/5',
  critical: 'border-loss/30 bg-loss-muted/10',
}

const SEVERITY_TEXT: Record<EdgePrioritySeverity, string> = {
  positive: 'text-profit',
  info: 'text-text-muted',
  warning: 'text-gold',
  critical: 'text-loss',
}

export function EdgePriorityCard({ priority }: { priority: EdgePriority }) {
  return (
    <div className={`rounded-xl border p-3 min-w-0 ${SEVERITY_STYLES[priority.severity]}`}>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-[length:var(--text-sm)] font-medium text-text-heading break-words">{priority.title}</p>
          <p className="text-[10px] uppercase tracking-wider text-text-faint mt-0.5">
            {priority.category} · {priority.source.replace(/_/g, ' ')}
          </p>
        </div>
        <span className={`text-[10px] font-medium uppercase shrink-0 ${SEVERITY_TEXT[priority.severity]}`}>
          {priority.severity}
        </span>
      </div>
      <p className="text-[length:var(--text-xs)] text-text-muted mt-2 break-words">{priority.summary}</p>
      <p className={`text-[length:var(--text-xs)] font-medium mt-2 break-words ${SEVERITY_TEXT[priority.severity]}`}>
        → {priority.action}
      </p>
      {priority.evidence.length > 0 && (
        <ul className="mt-2 text-[10px] text-text-faint list-disc pl-4 space-y-0.5">
          {priority.evidence.slice(0, 3).map((e, i) => (
            <li key={i} className="break-words">{e}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
