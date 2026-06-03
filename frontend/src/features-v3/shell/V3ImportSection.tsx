import { Button, Page, Panel, Stack } from '@/new-ui'
import { BrokerImportModal } from '@/components/trades/BrokerImportModal'
import { Import } from 'lucide-react'
import { useState } from 'react'

export function V3ImportSection() {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <Page
        title="Import"
        subtitle="Broker CSV import remains on the existing stable flow for now."
      >
        <Stack gap="lg">
          <Panel
            title="Legacy import flow"
            description="V3 import surface is not rebuilt yet. Use the proven broker import modal from the legacy Trades workflow."
            action={
              <Button variant="primary" onClick={() => setImportOpen(true)}>
                Open import
              </Button>
            }
          >
            <div className="tjv3-legacy-embed__note">
              Supported brokers: Zerodha, Dhan, and generic CSV. No fake preview data is shown here.
            </div>
          </Panel>

          <EmptyStateImportHint onOpen={() => setImportOpen(true)} />
        </Stack>
      </Page>

      <BrokerImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}

function EmptyStateImportHint({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="tjv3-import-hint">
      <Import aria-hidden="true" size={18} />
      <div>
        <div className="tjv3-import-hint__title">Import remains on the existing stable flow for now.</div>
        <Button variant="secondary" size="sm" onClick={onOpen}>
          Open legacy import
        </Button>
      </div>
    </div>
  )
}
