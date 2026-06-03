import { useMemo } from 'react'
import { EmptyState, Panel, Stack } from '@/new-ui'
import { SetupListCard } from './SetupListCard'
import type { PlaybookSetupEntry } from '../utils/playbookGrouping'
import { computeSetupPerformance } from '../utils/playbookMetrics'
import {
  PLAYBOOK_FILTER_OPTIONS,
  applyPlaybookFilters,
  type PlaybookFilter,
  type PlaybookFilterState,
} from '../utils/playbookFilters'

interface SetupLibraryPanelProps {
  entries: PlaybookSetupEntry[]
  filterState: PlaybookFilterState
  onFilterChange: (filter: PlaybookFilter) => void
  onSearchChange: (search: string) => void
  selectedKey: string | null
  onSelect: (key: string) => void
}

export function SetupLibraryPanel({
  entries,
  filterState,
  onFilterChange,
  onSearchChange,
  selectedKey,
  onSelect,
}: SetupLibraryPanelProps) {
  const filtered = useMemo(() => applyPlaybookFilters(entries, filterState), [entries, filterState])

  return (
    <Panel
      title="Setup library"
      description={`${filtered.length} of ${entries.length} setup${entries.length === 1 ? '' : 's'}`}
    >
      <Stack gap="md">
        {/* Search */}
        <input
          type="search"
          value={filterState.search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search setups…"
          aria-label="Search setups"
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-muted)',
            color: 'var(--color-text)',
            fontSize: '0.8125rem',
          }}
        />

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {PLAYBOOK_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '0.4375rem',
                border: `1px solid ${filterState.filter === opt.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background:
                  filterState.filter === opt.value
                    ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                    : 'transparent',
                color: filterState.filter === opt.value ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <EmptyState
            title="No setups match"
            description={
              entries.length === 0
                ? 'No setup playbook records or setup-tagged trades found.'
                : 'Try a different filter or search query.'
            }
          />
        ) : (
          <Stack gap="sm">
            {filtered.map((entry) => (
              <SetupListCard
                key={entry.key}
                entry={entry}
                performance={computeSetupPerformance(entry.trades)}
                active={selectedKey === entry.key}
                onSelect={() => onSelect(entry.key)}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  )
}
