import { useEffect, useMemo, useState } from 'react'
import { Button, Cluster, ErrorState, LoadingState, Page, Stack } from '@/new-ui'
import { Plus, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { useSetupsQuery, useSeedSetupsMutation } from '@/hooks/useSetupPlaybookQuery'
import { useToastStore } from '@/store/toastStore'
import { useTradesV3Data } from '../trades/hooks/useTradesV3Data'
import { PlaybookHeader } from './components/PlaybookHeader'
import { SetupLibraryPanel } from './components/SetupLibraryPanel'
import { SetupDetailPanel } from './components/SetupDetailPanel'
import { SetupFormDrawer } from './components/SetupFormDrawer'
import { combineSetups, type PlaybookSetupEntry } from './utils/playbookGrouping'
import { summarizeLibrary } from './utils/playbookMetrics'
import type { PlaybookFilter } from './utils/playbookFilters'
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import { PlaybookIntelligenceFull } from '@/components/playbook/PlaybookIntelligenceFull'

type PlaybookTab = 'library' | 'intelligence'

interface PlaybookV3PageProps {
  dataEnabled?: boolean
}

export function PlaybookV3Page({ dataEnabled = true }: PlaybookV3PageProps) {
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)
  const openReviewTrade = useAppStore((s) => s.openReviewTrade)
  const addToast = useToastStore((s) => s.addToast)

  const setupsQuery = useSetupsQuery()
  const seedMut = useSeedSetupsMutation()
  const { trades, isLoading: tradesLoading, error: tradesError, refresh } = useTradesV3Data(dataEnabled)

  const [activeTab, setActiveTab] = useState<PlaybookTab>('library')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PlaybookFilter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [formState, setFormState] = useState<{ setup: SetupPlaybookItem | null } | null>(null)

  const playbooks = setupsQuery.data?.items
  const entries = useMemo(() => combineSetups(playbooks ?? [], trades), [playbooks, trades])
  const summary = useMemo(() => summarizeLibrary(entries), [entries])

  useEffect(() => {
    if (selectedKey == null && entries.length > 0) setSelectedKey(entries[0].key)
    if (selectedKey != null && !entries.some((e) => e.key === selectedKey)) {
      setSelectedKey(entries.length > 0 ? entries[0].key : null)
    }
  }, [entries, selectedKey])

  const selected = useMemo(
    () => entries.find((e) => e.key === selectedKey) ?? null,
    [entries, selectedKey],
  )

  const handleEditSetup = (entry: PlaybookSetupEntry) => {
    if (entry.playbook) setFormState({ setup: entry.playbook })
  }

  const handleSeed = async () => {
    try {
      await seedMut.mutateAsync()
      addToast({ title: 'Defaults seeded', message: 'Canonical setups added to your playbook.', variant: 'success' })
    } catch (e: unknown) {
      addToast({ title: 'Seed failed', message: e instanceof Error ? e.message : 'Try again.', variant: 'error' })
    }
  }

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
        activeTab === 'library' ? (
          <Cluster gap="sm">
            <Button size="sm" variant="primary" onClick={() => setFormState({ setup: null })}>
              <Plus aria-hidden="true" size={14} />
              New setup
            </Button>
            <Button size="sm" variant="secondary" onClick={handleSeed} disabled={seedMut.isPending}>
              <RefreshCw aria-hidden="true" size={14} />
              {seedMut.isPending ? 'Seeding…' : 'Seed defaults'}
            </Button>
          </Cluster>
        ) : undefined
      }
    >
      <Stack gap="lg">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0' }}>
          {(['library', 'intelligence'] as PlaybookTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: activeTab === tab ? 'var(--color-accent)' : 'var(--color-text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'library' && (
          <>
            <PlaybookHeader summary={summary} />
            <div
              style={{
                display: 'grid',
                gap: 'var(--tj-space-section)',
                gridTemplateColumns: 'minmax(0, 22rem) minmax(0, 1fr)',
              }}
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
                  onEditSetup={handleEditSetup}
                />
              </div>
            </div>
          </>
        )}

        {activeTab === 'intelligence' && <PlaybookIntelligenceFull />}
      </Stack>

      <SetupFormDrawer
        open={formState != null}
        onClose={() => setFormState(null)}
        setup={formState?.setup ?? null}
      />
    </Page>
  )
}
