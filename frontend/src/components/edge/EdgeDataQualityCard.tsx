import type { EdgeDataQuality } from '@/types/edgeCommandCenter'

export function EdgeDataQualityCard({ quality }: { quality: EdgeDataQuality }) {
  if (quality.notes.length === 0 && quality.closed_trades >= 5) return null

  return (
    <div className="rounded-xl border border-border/80 bg-bg-elevated/20 p-3 text-[length:var(--text-xs)] text-text-muted min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-text-faint mb-2">Data quality</p>
      <p>
        {quality.closed_trades} closed / {quality.total_trades} total trades in period.
        {quality.has_recommendations ? ' Recommendations loaded.' : ''}
        {quality.has_coaching ? ' Coaching loaded.' : ''}
        {quality.has_trade_reviews ? ' Trade reviews loaded.' : ''}
      </p>
      {quality.notes.length > 0 && (
        <ul className="mt-2 list-disc pl-4 space-y-0.5">
          {quality.notes.map((n, i) => (
            <li key={i} className="break-words">{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
