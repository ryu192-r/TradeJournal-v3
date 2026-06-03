import { useEffect, useMemo, useState } from 'react'
import { Button, ErrorState, LoadingState, Page, Stack } from '@/new-ui'
import { useAppStore } from '@/store/appStore'
import { useSetupsQuery } from '@/hooks/useSetupPlaybookQuery'
import { useTradesV3Data } from '../trades/hooks/useTradesV3Data'
import { PlaybookHeader } from './components/PlaybookHeader'
import { SetupLibraryPanel } from './components/SetupLibraryPanel'
import { SetupDetailPanel } from './components/SetupDetailPanel'
import { combineSetups } from './utils/playbookGrouping'
import { summarizeLibrary } from './utils/playbookMetrics'
import type { PlaybookFilter } from './utils/playbookFilters'

interface PlaybookV3PageProps {
  dataEnabled?: boolean
  /** Optional: render a button to fall back to legacy playbook page. */
  onOpenLegacy?: () => void
}

export function PlaybookV3Page({ dataEnabled = true, onOpenLegacy }: PlaybookV3PageProps) {
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)
  const openReviewTrade = useAppStore((s) => s.openReviewTrade)

  const setupsQuery = useSetupsQuery()
  const { trades, isLoading: tradesLoading, error: tradesError, refresh } = useTradesV3Data(dataEnabled)

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PlaybookFilter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const playbooks = setupsQuery.data?.items
  const entries = useMemo(() => combineSetups(playbooks ?? [], trades), [playbooks, trades])
  const summary = useMemo(() => summarizeLibrary(entries), [entries])

  // Auto-select the first entry when none selected (after first load)
  useEffect(() => {
    if (selectedKey == null && entries.length > 0) {
      setSelectedKey(entries[0].key)
    }
    // If current selection no longer exists, clear it
    if (selectedKey != null && !entries.some((e) => e.key === selectedKey)) {
      setSelectedKey(entries.length > 0 ? entries[0].key : null)
    }
  }, [entries, selectedKey])

  const selected = useMemo(
    () => entries.find((e) => e.key === selectedKey) ?? null,
    [entries, selectedKey],
  )

  const isLoading = (setupsQuery.isLoading && !setupsQuery.data) || tradesLoading
  const error = (setupsQuery.error as Error | null) ?? tradesError

  if (isLoading) {
    return (
      <Page title="Playbook">
        <LoadingState label="Loading playbook…" />
      </Page>
    )
  }

  if (error) {
    return (
      <Page title="Playbook">
        <ErrorState
          title="Could not load playbook"
          description={error.message}
          onRetry={() => {
            void refresh()
            void setupsQuery.refetch()
          }}
        />
      </Page>
    )
  }

  return (
    <Page
      title="Playbook"
      subtitle="Track setups, rules, examples, and performance from real trades."
      actions={
        onOpenLegacy ? (
          <Button size="sm" variant="ghost" onClick={onOpenLegacy}>
            Open legacy playbook
          </Button>
        ) : null
      }
    >
      <Stack gap="lg">
        <PlaybookHeader summary={summary} />

        <div
          style={{
            display: 'grid',
            gap: 'var(--tj-space-section)',
            gridTemplateColumns: 'minmax(0, 22rem) minmax(0, 1fr)',
          }}
          className="tjv3-playbook-layout"
        >
          <div style={{ minWidth: 0 }}>
            <SetupLibraryPanel
              entries={entries}
              filterState={{ search, filter }}
              onSearchChange={setSearch}
              onFilterChange={setFilter}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <SetupDetailPanel
              entry={selected}
              onOpenTrade={openDetailTrade}
              onReviewTrade={openReviewTrade}
            />
          </div>
        </div>
      </Stack>
    </Page>
  )
}
