import { Chip, EmptyState, Grid, MetricCard, Panel, Stack, Value } from '@/new-ui'
import type { SetupReviewInsights } from '../utils/playbookMetrics'

interface SetupReviewInsightsPanelProps {
  insights: SetupReviewInsights
  onOpenReview: (tradeId: number) => void
}

export function SetupReviewInsightsPanel({ insights, onOpenReview }: SetupReviewInsightsPanelProps) {
  const hasAnyContent =
    insights.reviewedCount + insights.pendingCount > 0 ||
    insights.topTags.length > 0 ||
    insights.recentNotes.length > 0

  return (
    <Panel
      title="Review insights"
      description="Real review tags and note excerpts from trades for this setup. Not AI-generated."
    >
      {!hasAnyContent ? (
        <EmptyState
          title="No review data"
          description="No reviewable trades or review notes recorded for this setup yet."
        />
      ) : (
        <Stack gap="md">
          <Grid minColumnWidth="9rem">
            <MetricCard label="Reviewed" value={<Value value={String(insights.reviewedCount)} />} />
            <MetricCard label="Pending review" value={<Value value={String(insights.pendingCount)} />} />
          </Grid>

          {insights.topTags.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.375rem',
                }}
              >
                Top review tags
              </div>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {insights.topTags.map(({ tag, count }) => (
                  <Chip key={tag} variant="accent">
                    {tag} · {count}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {insights.recentNotes.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-text-muted)',
                  marginBottom: '0.375rem',
                }}
              >
                Recent review notes
              </div>
              <Stack gap="sm">
                {insights.recentNotes.map((note) => (
                  <button
                    key={note.tradeId}
                    type="button"
                    onClick={() => onOpenReview(note.tradeId)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-muted)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      lineHeight: 1.5,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '0.5rem',
                        justifyContent: 'space-between',
                        fontSize: '0.6875rem',
                        color: 'var(--color-text-muted)',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{note.symbol}</span>
                      <span>{note.sessionDate ?? '—'}</span>
                    </div>
                    <div>{note.excerpt}</div>
                  </button>
                ))}
              </Stack>
            </div>
          )}

          {insights.topTags.length === 0 && insights.recentNotes.length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', margin: 0 }}>
              Reviewable trades exist but none have review notes or tags yet.
            </p>
          )}
        </Stack>
      )}
    </Panel>
  )
}
