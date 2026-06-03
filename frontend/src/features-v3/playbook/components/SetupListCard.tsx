import { Badge, Card, MoneyValue, PercentValue, RMultipleValue, Value, cn } from '@/new-ui'
import type { PlaybookSetupEntry } from '../utils/playbookGrouping'
import type { SetupPerformance } from '../utils/playbookMetrics'

interface SetupListCardProps {
  entry: PlaybookSetupEntry
  performance: SetupPerformance
  active: boolean
  onSelect: () => void
}

function statusBadge(entry: PlaybookSetupEntry, perf: SetupPerformance) {
  if (entry.origin === 'untagged') {
    return <Badge variant="warning">Untagged</Badge>
  }
  if (entry.origin === 'trade-derived') {
    return <Badge variant="info">Not in playbook</Badge>
  }
  if (entry.playbook?.is_active === 'archived') {
    return <Badge variant="neutral">Archived</Badge>
  }
  if (perf.totalTrades === 0) {
    return <Badge variant="pending">No trades yet</Badge>
  }
  if (perf.closedTrades < 3) {
    return <Badge variant="pending">Not enough data</Badge>
  }
  return <Badge variant="success" dot>Active</Badge>
}

export function SetupListCard({ entry, performance, active, onSelect }: SetupListCardProps) {
  const tone = performance.grossPnl > 0 ? 'profit' : performance.grossPnl < 0 ? 'loss' : 'neutral'

  return (
    <Card
      interactive
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-pressed={active}
      className={cn('tjv3-playbook-card', active && 'tjv3-playbook-card--active')}
      style={{
        cursor: 'pointer',
        borderColor: active ? 'var(--color-accent)' : undefined,
        background: active ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : undefined,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.name}
          </div>
          {entry.playbook?.description && (
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--color-text-muted)',
                marginTop: '0.125rem',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                overflow: 'hidden',
              }}
            >
              {entry.playbook.description}
            </div>
          )}
        </div>
        {statusBadge(entry, performance)}
      </div>

      <div
        style={{
          marginTop: '0.75rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.5rem 1rem',
          fontSize: '0.75rem',
        }}
      >
        <CellLabel label="Trades">
          <Value value={String(performance.totalTrades)} />
        </CellLabel>
        <CellLabel label="Gross P&L">
          {performance.closedTrades > 0 ? (
            <MoneyValue value={performance.grossPnl} tone={tone} />
          ) : (
            <Value value="—" />
          )}
        </CellLabel>
        <CellLabel label="Win rate">
          <PercentValue value={performance.winRate} />
        </CellLabel>
        <CellLabel label="Avg R">
          <RMultipleValue value={performance.avgR} tone="auto" />
        </CellLabel>
      </div>

      <div
        style={{
          marginTop: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.6875rem',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>
          Reviewed {performance.reviewedCount}/{performance.closedTrades}
        </span>
        <span>{performance.lastTradedDate ? `Last: ${performance.lastTradedDate}` : 'No trades'}</span>
      </div>
    </Card>
  )
}

function CellLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{children}</span>
    </div>
  )
}
