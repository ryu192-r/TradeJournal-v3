import { Button, Panel } from '@/new-ui'
import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TradesV3AttentionFilter, TradesV3DirectionFilter, TradesV3Filters, TradesV3Period, TradesV3Sort, TradesV3StatusFilter } from '../types'

interface TradesFilterBarProps {
  filters: TradesV3Filters
  setupOptions: string[]
  onChange: <K extends keyof TradesV3Filters>(key: K, value: TradesV3Filters[K]) => void
  onReset: () => void
}

export function TradesFilterBar({ filters, setupOptions, onChange, onReset }: TradesFilterBarProps) {
  return (
    <Panel title="Filters" description="Frontend-only search, filters, and sorting for the preview ledger.">
      <div className="tjv3-trades__filters">
        <label className="tjv3-trades__field tjv3-trades__field--search">
          <span>Search</span>
          <div className="tjv3-trades__search">
            <Search aria-hidden="true" size={15} />
            <input
              value={filters.search}
              onChange={(event) => onChange('search', event.target.value)}
              placeholder="Symbol"
              aria-label="Search trades by symbol"
            />
          </div>
        </label>

        <SelectField label="Status" value={filters.status} onChange={(value) => onChange('status', value as TradesV3StatusFilter)}>
          <option value="active">All active</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="closed">Closed</option>
          <option value="deleted">Deleted</option>
        </SelectField>

        <SelectField label="Period" value={filters.period} onChange={(value) => onChange('period', value as TradesV3Period)}>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </SelectField>

        <SelectField label="Direction" value={filters.direction} onChange={(value) => onChange('direction', value as TradesV3DirectionFilter)}>
          <option value="all">All</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </SelectField>

        <SelectField label="Setup" value={filters.setup} onChange={(value) => onChange('setup', value)}>
          <option value="all">All setups</option>
          <option value="untagged">Untagged</option>
          {setupOptions.map((setup) => (
            <option key={setup} value={setup}>{setup}</option>
          ))}
        </SelectField>

        <SelectField label="Attention" value={filters.attention} onChange={(value) => onChange('attention', value as TradesV3AttentionFilter)}>
          <option value="all">All</option>
          <option value="missing_setup">Missing setup</option>
          <option value="missing_notes">Missing notes</option>
          <option value="missing_sl">Missing SL</option>
          <option value="review_pending">Review pending</option>
          <option value="partial_open">Partial open</option>
        </SelectField>

        <SelectField label="Sort" value={filters.sort} onChange={(value) => onChange('sort', value as TradesV3Sort)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="pnl_high">P&L high to low</option>
          <option value="pnl_low">P&L low to high</option>
          <option value="r_high">R high to low</option>
          <option value="symbol">Symbol A-Z</option>
        </SelectField>

        <Button variant="ghost" onClick={onReset}>
          <X aria-hidden="true" size={14} />
          Reset
        </Button>
      </div>
    </Panel>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

function SelectField({ label, value, onChange, children }: SelectFieldProps) {
  return (
    <label className="tjv3-trades__field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  )
}
