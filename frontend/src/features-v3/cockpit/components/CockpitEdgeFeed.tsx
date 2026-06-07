import { useState } from 'react'
import { Badge, EmptyState, ErrorState, Panel, Skeleton } from '@/new-ui'
import { useEdgeCommandCenterQuery } from '@/hooks/useEdgeCommandCenterQuery'
import type { EdgePriority } from '@/types/edgeCommandCenter'

const SEVERITY_VARIANT = {
  critical: 'danger',
  warning: 'warning',
  positive: 'success',
  info: 'info',
} as const

function PriorityRow({ item }: { item: EdgePriority }) {
  const variant = SEVERITY_VARIANT[item.severity] ?? 'info'
  return (
    <div className="tjv3-cockpit__signal-row">
      <div className="tjv3-cockpit__row-top">
        <div className="tjv3-cockpit__symbol">{item.title}</div>
        <Badge variant={variant}>{item.category}</Badge>
      </div>
      <div className="tjv3-cockpit__micro">{item.summary}</div>
      {item.action && (
        <div className="tjv3-cockpit__micro" style={{ color: 'var(--color-accent)', marginTop: '0.125rem' }}>
          → {item.action}
        </div>
      )}
    </div>
  )
}

interface CockpitEdgeFeedProps {
  dataEnabled?: boolean
}

export function CockpitEdgeFeed({ dataEnabled = true }: CockpitEdgeFeedProps) {
  const [expanded, setExpanded] = useState(false)
  const { data, isLoading, isError, refetch } = useEdgeCommandCenterQuery()

  if (!dataEnabled) return null

  if (isLoading && !data) {
    return (
      <Panel title="Edge Feed" description="What to focus on now.">
        <div className="space-y-2">
          <Skeleton height="1rem" />
          <Skeleton height="1rem" width="80%" />
          <Skeleton height="1rem" width="60%" />
        </div>
      </Panel>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Edge feed unavailable"
        description="Could not load intelligence feed."
        onRetry={() => void refetch()}
      />
    )
  }

  if (!data) return null

  const topPriorities = expanded ? data.priorities : data.priorities.slice(0, 3)
  const hasMore = data.priorities.length > 3

  return (
    <Panel
      title="Edge Feed"
      description={data.headline || 'What to focus on now.'}
      action={
        data.next_best_action ? (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 600 }}>
            {data.next_best_action}
          </span>
        ) : undefined
      }
    >
      {data.priorities.length === 0 ? (
        <EmptyState
          title="No priorities"
          description="Trade consistently to unlock personalized edge intelligence."
        />
      ) : (
        <div className="tjv3-cockpit__row-list">
          {topPriorities.map((p) => (
            <PriorityRow key={p.id} item={p} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="tjv3-cockpit__micro"
              style={{ color: 'var(--color-accent)', cursor: 'pointer', paddingTop: '0.25rem' }}
            >
              {expanded ? 'Show less ↑' : `Show ${data.priorities.length - 3} more ↓`}
            </button>
          )}
        </div>
      )}
    </Panel>
  )
}
