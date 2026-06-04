import { useState } from 'react'
import { ChevronDown, ChevronUp, Shield } from 'lucide-react'
import {
  Badge, Button, EmptyState, Grid, LoadingState, MetricCard,
  MoneyValue, Panel, Stack, Value,
} from '@/new-ui'
import { useRiskDashboardQuery } from '@/hooks/useRiskDashboardQuery'
import type { RiskBucket, RiskDashboardPayload, RiskTrade } from '@/types/riskDashboard'

function heatTone(pct: number | null): 'profit' | 'warning' | 'loss' | 'neutral' {
  if (pct == null) return 'neutral'
  if (pct > 6) return 'loss'
  if (pct > 4) return 'warning'
  return 'profit'
}

function heatBadgeVariant(pct: number | null): 'profit' | 'warning' | 'loss' | 'neutral' {
  return heatTone(pct)
}

export function RiskIntelligencePanel() {
  const [expanded, setExpanded] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const query = useRiskDashboardQuery(expanded)
  // Lazy: query only fires once expanded.

  const data = expanded ? query.data : undefined

  return (
    <Panel
      title={
        <span className="tjv3-risk__title">
          <Shield aria-hidden="true" size={15} /> Risk Intelligence
        </span>
      }
      action={
        <div className="tjv3-risk__title-actions">
          {expanded && query.data && (
            <>
              <Badge variant={heatBadgeVariant(query.data.portfolio_heat_pct)}>
                Heat {query.data.portfolio_heat_pct != null ? `${query.data.portfolio_heat_pct}%` : '—'}
              </Badge>
              <Badge variant={query.data.warnings.length > 0 ? 'warning' : 'neutral'}>
                {query.data.warnings.length} warning{query.data.warnings.length === 1 ? '' : 's'}
              </Badge>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </div>
      }
    >
      {!expanded ? (
        <div className="tjv3-risk__collapsed">
          Portfolio heat, stop coverage, and concentration. Open to load live data.
        </div>
      ) : query.isLoading ? (
        <LoadingState label="Loading risk…" lines={4} />
      ) : query.error ? (
        <EmptyState title="Risk unavailable" description={(query.error as Error).message} />
      ) : data == null ? (
        <EmptyState
          title="No risk data"
          description="Create an account and open trades to see portfolio heat and exposure."
        />
      ) : (
        <RiskExpandedBody data={data} showFull={showFull} onToggleFull={() => setShowFull((s) => !s)} />
      )}
    </Panel>
  )
}

function RiskExpandedBody({
  data,
  showFull,
  onToggleFull,
}: {
  data: RiskDashboardPayload
  showFull: boolean
  onToggleFull: () => void
}) {
  const heatPct = data.portfolio_heat_pct ?? 0
  const tone = heatTone(data.portfolio_heat_pct)

  return (
    <Stack gap="md">
      {/* Heat gauge */}
      <div className="tjv3-risk__gauge">
        <div className="tjv3-risk__gauge-head">
          <span>Portfolio heat</span>
          <span className={`tjv3-tone-${tone}`}>
            {data.portfolio_heat_pct != null ? `${data.portfolio_heat_pct}%` : '—'}
          </span>
        </div>
        <div className="tjv3-risk__gauge-track">
          <div
            className={`tjv3-risk__gauge-fill tjv3-risk__gauge-fill--${tone}`}
            style={{ width: `${Math.min(Math.max(heatPct, 0), 10) * 10}%` }}
          />
        </div>
        <div className="tjv3-risk__gauge-scale">
          <span>0%</span>
          <span>4%</span>
          <span>6%</span>
          <span>10%+</span>
        </div>
      </div>

      {/* Key metrics */}
      <Grid minColumnWidth="8.5rem">
        <MetricCard label="Net equity" value={<MoneyValue value={data.net_equity} tone="neutral" />} />
        <MetricCard
          label="Deployed"
          value={<MoneyValue value={data.deployed_capital} tone="neutral" />}
          description={data.deployed_capital_pct != null ? `${data.deployed_capital_pct}%` : undefined}
        />
        <MetricCard label="Available" value={<MoneyValue value={data.available_capital} tone="profit" />} />
        <MetricCard label="Open risk" value={<MoneyValue value={data.open_risk} tone="neutral" />} />
        <MetricCard
          label="Without stop"
          value={<Value value={String(data.positions_without_stop)} tone={data.positions_without_stop > 0 ? 'loss' : 'neutral'} />}
        />
        <MetricCard label="Open positions" value={<Value value={String(data.open_positions)} />} />
      </Grid>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="tjv3-risk__warnings">
          {data.warnings.map((w, i) => (
            <div key={`${w.code}-${i}`} className="tjv3-risk__warning">
              <Badge variant={w.severity === 'high' ? 'loss' : w.severity === 'medium' ? 'warning' : 'neutral'}>
                {w.severity}
              </Badge>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={onToggleFull}>
        {showFull ? 'Hide positions & exposure' : 'View positions & exposure'}
      </Button>

      {showFull && (
        <Stack gap="md">
          <Grid minColumnWidth="14rem">
            <RiskPositionCard title="Largest position" trade={data.largest_position} />
            <RiskPositionCard title="Largest risk" trade={data.largest_risk_position} />
          </Grid>
          <Grid minColumnWidth="16rem">
            <ExposureTable title="Setup exposure" buckets={data.risk_by_setup} />
            <ExposureTable title="Symbol exposure" buckets={data.risk_by_symbol} />
          </Grid>
        </Stack>
      )}
    </Stack>
  )
}

function RiskPositionCard({ title, trade }: { title: string; trade: RiskTrade | null }) {
  if (!trade) {
    return (
      <Panel title={title} variant="muted">
        <div className="tjv3-risk__empty-pos">No open positions</div>
      </Panel>
    )
  }
  return (
    <Panel title={title} variant="muted">
      <div className="tjv3-risk__pos">
        <div className="tjv3-risk__pos-head">
          <span className="tjv3-risk__pos-symbol">{trade.symbol}</span>
          <span className="tjv3-risk__pos-pct">{trade.risk_pct != null ? `${trade.risk_pct}%` : '—'}</span>
        </div>
        <div className="tjv3-risk__pos-grid">
          <div><span>Entry</span><MoneyValue value={trade.entry_price} tone="neutral" /></div>
          <div><span>Stop</span>{trade.stop_price ? <MoneyValue value={trade.stop_price} tone="neutral" /> : <Value value="Missing" tone="loss" />}</div>
          <div><span>Qty</span><Value value={trade.quantity} /></div>
          <div><span>Risk</span><MoneyValue value={trade.open_risk} tone="neutral" /></div>
        </div>
      </div>
    </Panel>
  )
}

function ExposureTable({ title, buckets }: { title: string; buckets: RiskBucket[] }) {
  return (
    <Panel title={title} variant="muted">
      {buckets.length === 0 ? (
        <div className="tjv3-risk__empty-pos">No exposure</div>
      ) : (
        <table className="tjv3-risk__table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Pos</th>
              <th>Deployed</th>
              <th>Risk</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td>{b.position_count}</td>
                <td><MoneyValue value={b.deployed_capital} tone="neutral" compact /></td>
                <td><MoneyValue value={b.open_risk} tone="neutral" compact /></td>
                <td>{b.exposure_pct != null ? `${b.exposure_pct}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}
