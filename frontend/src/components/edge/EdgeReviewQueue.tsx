import { useAppStore } from '@/store/appStore'
import type { EdgeReviewQueueItem } from '@/types/edgeCommandCenter'
import { EmptyState } from '@/components/ui'

const SEV_DOT: Record<string, string> = {
  critical: 'bg-loss',
  warning: 'bg-gold',
  info: 'bg-text-muted',
}

export function EdgeReviewQueue({ items }: { items: EdgeReviewQueueItem[] }) {
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)

  if (items.length === 0) {
    return (
      <EmptyState
        title="No trades queued for review"
        message="Low-risk closed trades with solid scores won't appear here."
        compact
      />
    )
  }

  return (
    <ul className="space-y-2 min-w-0">
      {items.map((item) => (
        <li key={item.trade_id}>
          <button
            type="button"
            onClick={() => openDetailTrade(item.trade_id)}
            className="w-full text-left rounded-xl border border-border bg-bg-elevated/30 p-3 min-h-12 hover:border-accent/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${SEV_DOT[item.severity] ?? SEV_DOT.info}`} />
              <span className="font-medium text-text-heading truncate">{item.symbol}</span>
              {item.score != null && (
                <span className="text-[10px] font-data text-text-muted ml-auto shrink-0">{item.score}/100</span>
              )}
            </div>
            <p className="text-[length:var(--text-xs)] text-text-muted mt-1 pl-4 break-words">{item.reason}</p>
            {item.mistake_tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2 pl-4">
                {item.mistake_tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-1.5 py-px rounded-full bg-border text-text-muted">
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
