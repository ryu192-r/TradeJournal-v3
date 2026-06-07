import { useState } from 'react'
import { Radar } from 'lucide-react'
import { useEdgeCommandCenterQuery } from '@/hooks/useEdgeCommandCenterQuery'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

export function EdgeCommandCenterCompact() {
  const [expanded, setExpanded] = useState(false)
  const { data, isError, isLoading } = useEdgeCommandCenterQuery()

  if (isError) {
    return (
      <div className={CARD}>
        <p className="text-[length:var(--text-xs)] text-text-muted">Edge summary unavailable.</p>
      </div>
    )
  }

  if (isLoading && !data) {
    return (
      <div className={CARD}>
        <div className="h-16 animate-pulse rounded-lg bg-border/40" />
      </div>
    )
  }

  if (!data) return null

  const topRisk = data.summary.risk_warnings[0] ?? data.priorities.find((p) => p.severity === 'critical')?.summary
  const extraPriorities = data.priorities.slice(1)

  return (
    <div className={`${CARD} border-accent/20`}>
      <div className="flex items-center gap-2 mb-2">
        <Radar className="w-4 h-4 text-accent shrink-0" />
        <span className="text-[length:var(--text-sm)] font-medium text-text-heading">Edge Command</span>
      </div>
      <p className="text-[length:var(--text-xs)] text-text-muted break-words line-clamp-2">{data.primary_focus}</p>
      <p className="text-[length:var(--text-xs)] font-medium text-accent mt-1 break-words line-clamp-2">
        {data.next_best_action}
      </p>
      {topRisk && (
        <p className="text-[10px] text-loss mt-2 break-words line-clamp-2">⚠ {topRisk}</p>
      )}
      {expanded && extraPriorities.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {extraPriorities.slice(0, 4).map((p) => (
            <div key={p.id}>
              <p className="text-[length:var(--text-xs)] font-medium text-text-heading">{p.title}</p>
              <p className="text-[10px] text-text-muted">{p.summary}</p>
            </div>
          ))}
        </div>
      )}
      {data.priorities.length > 1 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-[length:var(--text-xs)] font-medium text-accent hover:underline cursor-pointer"
        >
          {expanded ? 'Show less ↑' : `${data.priorities.length - 1} more priorities ↓`}
        </button>
      )}
    </div>
  )
}
