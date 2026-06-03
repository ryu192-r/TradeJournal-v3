import { Badge, EmptyState, Panel } from '@/new-ui'
import type { CockpitSignal } from '../types'

function toneVariant(tone: CockpitSignal['tone']) {
  if (tone === 'loss') return 'danger'
  if (tone === 'warning') return 'warning'
  if (tone === 'profit') return 'success'
  if (tone === 'accent') return 'accent'
  if (tone === 'info') return 'info'
  return 'neutral'
}

export function AttentionSignals({ signals }: { signals: CockpitSignal[] }) {
  return (
    <Panel title="Attention Signals" description="Concise signals derived from current period data.">
      {signals.length === 0 ? (
        <EmptyState title="No attention signals" description="No data-backed alerts for this period." />
      ) : (
        <div className="tjv3-cockpit__row-list">
          {signals.map((signal) => (
            <div key={signal.id} className="tjv3-cockpit__signal-row">
              <div className="tjv3-cockpit__row-top">
                <div className="tjv3-cockpit__symbol">{signal.title}</div>
                <Badge variant={toneVariant(signal.tone)}>{signal.tone}</Badge>
              </div>
              <div className="tjv3-cockpit__micro">{signal.detail}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
