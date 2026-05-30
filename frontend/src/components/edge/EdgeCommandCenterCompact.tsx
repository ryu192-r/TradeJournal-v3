import { ArrowRight, Radar } from 'lucide-react'
import { useEdgeCommandCenterQuery } from '@/hooks/useEdgeCommandCenterQuery'
import { useAppStore } from '@/store/appStore'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

export function EdgeCommandCenterCompact() {
  const { data, isError, isLoading } = useEdgeCommandCenterQuery()
  const setActiveView = useAppStore((s) => s.setActiveView)

  if (isError) {
    return (
      <div className={CARD}>
        <p className="text-[length:var(--text-xs)] text-text-muted">Edge summary unavailable.</p>
        <button
          type="button"
          onClick={() => setActiveView('edge-center')}
          className="mt-2 text-[length:var(--text-xs)] text-accent cursor-pointer"
        >
          Open Edge Center →
        </button>
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
      <button
        type="button"
        onClick={() => setActiveView('edge-center')}
        className="mt-3 inline-flex items-center gap-1 text-[length:var(--text-xs)] font-medium text-accent hover:underline cursor-pointer"
      >
        Open Edge Center <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  )
}
