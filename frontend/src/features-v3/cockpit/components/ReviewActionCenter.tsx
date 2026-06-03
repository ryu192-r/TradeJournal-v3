import { Badge, EmptyState, Panel } from '@/new-ui'
import type { CockpitActionItem } from '../types'

interface ReviewActionCenterProps {
  items: CockpitActionItem[]
  onSelectItem: (item: CockpitActionItem) => void
}

export function ReviewActionCenter({ items, onSelectItem }: ReviewActionCenterProps) {
  return (
    <Panel title="Review Action Center" description="Conservative, data-backed actions only.">
      {items.length === 0 ? (
        <EmptyState title="Desk clear" description="No review items pending." />
      ) : (
        <div className="tjv3-cockpit__row-list">
          {items.map((item) => (
            <button key={item.id} type="button" className="tjv3-cockpit__signal-row" onClick={() => onSelectItem(item)}>
              <div className="tjv3-cockpit__row-top">
                <div className="tjv3-cockpit__symbol">{item.title}</div>
                <Badge variant={item.tone === 'loss' ? 'danger' : item.tone === 'warning' ? 'warning' : item.tone === 'accent' ? 'accent' : 'info'}>
                  {item.type}
                </Badge>
              </div>
              <div className="tjv3-cockpit__micro">{item.reason}</div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}
