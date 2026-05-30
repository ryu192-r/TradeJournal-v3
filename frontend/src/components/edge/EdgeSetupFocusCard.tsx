import type { EdgeSetupFocus } from '@/types/edgeCommandCenter'

const ACTION_STYLES: Record<string, string> = {
  focus: 'text-profit border-profit/30 bg-profit-muted/10',
  avoid: 'text-loss border-loss/30 bg-loss-muted/10',
  watch: 'text-gold border-gold/30 bg-gold/5',
  develop: 'text-accent border-accent/30 bg-accent/5',
}

export function EdgeSetupFocusCard({ item }: { item: EdgeSetupFocus }) {
  const style = ACTION_STYLES[item.action] ?? ACTION_STYLES.develop
  return (
    <div className={`rounded-xl border p-3 min-w-0 ${style}`}>
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[length:var(--text-sm)] font-medium text-text-heading truncate">{item.setup}</span>
        <span className="text-sm font-bold font-data shrink-0">{item.score}</span>
      </div>
      <p className="text-[10px] uppercase tracking-wider mt-1 opacity-80">{item.action} · {item.label}</p>
      <p className="text-[length:var(--text-xs)] text-text-muted mt-2 break-words">{item.reason}</p>
    </div>
  )
}
