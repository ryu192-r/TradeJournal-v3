import { Badge, EmptyState, Grid, MetricCard, Panel, Stack, Value } from '@/new-ui'
import type { BrokerImportResult } from '@/types'
import { summarizeImportResult } from '../utils/importStatusFormatters'

interface ImportResultSummaryProps {
  brokerName: string | null
  result: BrokerImportResult | null
  ranAt: string | null
}

const MAX_ERRORS_SHOWN = 8

export function ImportResultSummary({ brokerName, result, ranAt }: ImportResultSummaryProps) {
  const summary = summarizeImportResult(result)

  if (!summary || !result) {
    return (
      <Panel title="Last import">
        <EmptyState title="No import run yet" description="Run an import above to see the result here." />
      </Panel>
    )
  }

  const isError = result.status === 'error'

  return (
    <Panel
      title="Last import"
      description={brokerName ? `${brokerName}${ranAt ? ` · ${ranAt}` : ''}` : ranAt ?? undefined}
      action={
        <Badge variant={isError ? 'danger' : 'success'}>{isError ? 'Failed' : 'Success'}</Badge>
      }
    >
      <Stack gap="md">
        <Grid minColumnWidth="9rem">
          <MetricCard label="Added" value={<Value value={String(summary.added)} />} />
          <MetricCard label="Updated" value={<Value value={String(summary.updated)} />} />
          <MetricCard label="Skipped" value={<Value value={String(summary.skipped)} />} />
          <MetricCard label="Total rows" value={<Value value={String(summary.total)} />} />
          <MetricCard label="Issues" value={<Value value={String(summary.errorCount)} />} />
        </Grid>

        {summary.errorCount > 0 && (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                marginBottom: '0.375rem',
              }}
            >
              Issues ({summary.errorCount})
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: '1.25rem',
                color: 'var(--color-loss)',
                fontSize: '0.75rem',
                lineHeight: 1.5,
                maxHeight: '12rem',
                overflowY: 'auto',
              }}
            >
              {result.errors.slice(0, MAX_ERRORS_SHOWN).map((err, i) => (
                <li key={i} style={{ wordBreak: 'break-word' }}>
                  {err}
                </li>
              ))}
              {result.errors.length > MAX_ERRORS_SHOWN && (
                <li style={{ color: 'var(--color-text-muted)', listStyle: 'none', marginLeft: '-1.25rem' }}>
                  …and {result.errors.length - MAX_ERRORS_SHOWN} more.
                </li>
              )}
            </ul>
          </div>
        )}

        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
          Result fields come directly from the backend response. Counts shown are exactly what the parser reported — no inferred values.
        </p>
      </Stack>
    </Panel>
  )
}
