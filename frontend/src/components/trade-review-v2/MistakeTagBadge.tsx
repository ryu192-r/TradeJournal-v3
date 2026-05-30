import type { MistakeTag, MistakeSeverity } from '@/types/tradeReviewV2'

const SEVERITY_STYLES: Record<MistakeSeverity, string> = {
  info: 'bg-bg-elevated text-text-muted border-border',
  warning: 'bg-gold/10 text-gold border-gold/30',
  critical: 'bg-loss-muted/20 text-loss border-loss/30',
}

export function MistakeTagBadge({ tag }: { tag: MistakeTag }) {
  return (
    <span
      title={`${tag.explanation} — ${tag.suggested_fix}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${SEVERITY_STYLES[tag.severity]}`}
    >
      <span className="truncate">{tag.tag.replace(/_/g, ' ')}</span>
    </span>
  )
}
