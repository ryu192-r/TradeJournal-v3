import { Badge, Card, EmptyState, Panel, Stack } from '@/new-ui'
import { Download } from 'lucide-react'
import type { BrokerInfo } from '@/types'
import { brokerMapsMetadata, describeBroker } from '../utils/importStatusFormatters'

interface ImportSourceCardsProps {
  brokers: BrokerInfo[]
  isLoading: boolean
  onDownloadTemplate: (brokerId: string) => void
  onStartImport: (brokerId: string) => void
}

export function ImportSourceCards({
  brokers,
  isLoading,
  onDownloadTemplate,
  onStartImport,
}: ImportSourceCardsProps) {
  return (
    <Panel
      title="Import sources"
      description="Live list of broker formats supported by the backend."
    >
      {isLoading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem', margin: 0 }}>
          Loading supported brokers…
        </p>
      ) : brokers.length === 0 ? (
        <EmptyState
          title="No sources available"
          description="Backend returned no supported brokers. Try again later or use the legacy import."
        />
      ) : (
        <Stack gap="sm">
          {brokers.map((b) => (
            <Card key={b.id}>
              <div
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
                      {b.name}
                    </span>
                    {brokerMapsMetadata(b.id) ? (
                      <Badge variant="success">Auto market metadata</Badge>
                    ) : (
                      <Badge variant="neutral">No metadata mapping</Badge>
                    )}
                  </div>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                    {describeBroker(b.id)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => onDownloadTemplate(b.id)}
                    aria-label={`Download ${b.name} template`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 0.625rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      background: 'transparent',
                      color: 'var(--color-text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={14} aria-hidden="true" />
                    Template
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartImport(b.id)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-accent)',
                      background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                      color: 'var(--color-accent)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Start import
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </Panel>
  )
}
