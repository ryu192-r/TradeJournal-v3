import { Badge, EmptyState, ErrorState, Grid, LoadingState, MetricCard, Panel, Stack, Value } from '@/new-ui'
import { useRegimePerformanceQuery } from '@/hooks/useMarketRegimeQuery'
import type { MarketRegimeType, RegimeStatus } from '@/types/marketRegime'

const REGIME_LABELS: Record<MarketRegimeType, string> = {
  TRENDING_BULL: 'Trending Bull',
  TRENDING_BEAR: 'Trending Bear',
  RANGE_BOUND: 'Range Bound',
  HIGH_VOLATILITY: 'High Volatility',
  LOW_VOLATILITY: 'Low Volatility',
  BREAKOUT: 'Breakout',
  REVERSAL: 'Reversal',
  UNKNOWN: 'Unknown',
}

const STATUS_VARIANT: Record<RegimeStatus, 'success' | 'warning' | 'neutral'> = {
  FAVORABLE: 'success',
  UNFAVORABLE: 'warning',
  NEUTRAL: 'neutral',
}

function fmtPct(v: number | null): string {
  return v != null ? `${v.toFixed(0)}%` : '—'
}

function fmtR(v: number | null): string {
  return v != null ? `${v.toFixed(2)}R` : '—'
}

function fmtFactor(v: number | null): string {
  return v != null ? v.toFixed(2) : '—'
}

export function RegimePerformancePanel() {
  const { data, isLoading, isError, refetch } = useRegimePerformanceQuery()

  if (isLoading && !data) {
    return (
      <Panel title="Performance by regime">
        <LoadingState label="Loading regime performance…" />
      </Panel>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load regime performance"
        description="Market regime data is unavailable."
        onRetry={() => void refetch()}
      />
    )
  }

  const regimes = data?.regimes ?? []
  const withSamples = regimes.filter((r) => r.sample_size > 0)

  if (withSamples.length === 0) {
    return (
      <EmptyState
        title="No regime data yet"
        description="Trades need to be matched against market snapshots before per-regime performance can be computed. Sync market context and log more trades to unlock this view."
      />
    )
  }

  return (
    <Stack gap="lg">
      <Panel
        title="Performance by regime"
        description="Is your edge holding across market regimes? Segments use trades matched to the market snapshot on their entry date."
      >
        <Grid minColumnWidth="9rem">
          <MetricCard label="Matched trades" value={<Value value={String(data?.matched_trades ?? 0)} />} />
          <MetricCard label="Regimes with data" value={<Value value={String(withSamples.length)} />} />
          <MetricCard
            label="Favorable"
            value={<Value value={String((data?.favorable_regimes ?? []).length)} />}
          />
          <MetricCard
            label="Unfavorable"
            value={<Value value={String((data?.unfavorable_regimes ?? []).length)} />}
          />
        </Grid>
      </Panel>

      <Panel title="Regime breakdown">
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: '40rem', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '0.375rem 0' }}>Regime</th>
                <th style={{ padding: '0.375rem 0' }}>Sample</th>
                <th style={{ padding: '0.375rem 0' }}>Win rate</th>
                <th style={{ padding: '0.375rem 0' }}>Profit factor</th>
                <th style={{ padding: '0.375rem 0' }}>Expectancy</th>
                <th style={{ padding: '0.375rem 0' }}>Avg R</th>
                <th style={{ padding: '0.375rem 0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {withSamples.map((r) => (
                <tr key={r.regime} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '0.5rem 0', fontWeight: 500 }}>{REGIME_LABELS[r.regime]}</td>
                  <td style={{ padding: '0.5rem 0' }}>{r.sample_size}</td>
                  <td style={{ padding: '0.5rem 0' }}>{fmtPct(r.win_rate)}</td>
                  <td style={{ padding: '0.5rem 0' }}>{fmtFactor(r.profit_factor)}</td>
                  <td
                    style={{
                      padding: '0.5rem 0',
                      color:
                        r.expectancy_r != null
                          ? r.expectancy_r >= 0
                            ? 'var(--color-profit)'
                            : 'var(--color-loss)'
                          : undefined,
                    }}
                  >
                    {fmtR(r.expectancy_r)}
                  </td>
                  <td style={{ padding: '0.5rem 0' }}>{fmtR(r.avg_r)}</td>
                  <td style={{ padding: '0.5rem 0' }}>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status.toLowerCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Stack>
  )
}
