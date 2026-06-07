import type { EdgeWorkflowStatus } from '@/types/edgeCommandCenter'
import { useAppStore } from '@/store/appStore'

export function EdgeWorkflowCard({ workflow }: { workflow: EdgeWorkflowStatus }) {
  const setActiveView = useAppStore((s) => s.setActiveView)

  return (
    <div className="rounded-xl border border-border bg-bg-elevated/30 p-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-faint">Today&apos;s workflow</span>
        <span className="text-[10px] font-data text-text-muted">{workflow.progress_percent}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-border mt-2 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full"
          style={{ width: `${workflow.progress_percent}%` }}
        />
      </div>
      <p className="text-[length:var(--text-sm)] text-text-heading mt-2 break-words">{workflow.next_step}</p>
      {workflow.phase && (
        <p className="text-[10px] text-text-muted mt-1">Phase: {workflow.phase.replace(/_/g, ' ')}</p>
      )}
      {workflow.missing_items.length > 0 && (
        <ul className="mt-2 text-[10px] text-text-faint list-disc pl-4 space-y-0.5">
          {workflow.missing_items.slice(0, 4).map((m, i) => (
            <li key={i} className="break-words">{m}</li>
          ))}
        </ul>
      )}
      {!workflow.is_complete && (
        <button
          type="button"
          onClick={() => setActiveView('journal')}
          className="mt-3 text-[length:var(--text-xs)] font-medium text-accent hover:underline cursor-pointer"
        >
          Open Performance OS →
        </button>
      )}
    </div>
  )
}
