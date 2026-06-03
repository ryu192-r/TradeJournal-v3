import { Badge, Button } from '@/new-ui'
import { Plus, Search } from 'lucide-react'
import type { V3PreviewSectionId, V3ShellMode } from './V3Shell.types'
import { getV3NavigationItem } from './v3Navigation'

interface V3TopBarProps {
  activeSection: V3PreviewSectionId
  mode?: V3ShellMode
  onAddTrade?: () => void
}

export function V3TopBar({ activeSection, mode = 'preview', onAddTrade }: V3TopBarProps) {
  const current = getV3NavigationItem(activeSection)
  const isLive = mode === 'live'

  return (
    <header className="tjv3-topbar">
      <div className="tjv3-topbar__context">
        <div className="tjv3-topbar__section">
          <div className="tjv3-topbar__eyebrow">{isLive ? 'TradeJournal' : 'V3 shell preview'}</div>
          <div className="tjv3-topbar__label">{current.label}</div>
        </div>
        {!isLive && <Badge variant="accent">Isolated</Badge>}
      </div>

      <div className="tjv3-topbar__actions">
        <div
          className="tjv3-topbar__command"
          role="search"
          aria-label={isLive ? 'Command search' : 'Preview command search'}
          aria-disabled={!isLive ? 'true' : undefined}
        >
          <Search aria-hidden="true" />
          <span>{isLive ? 'Search coming soon' : 'Command/search preview'}</span>
          <kbd className="tjv3-topbar__kbd">/</kbd>
        </div>
        {!isLive && <Badge variant="neutral">No live data</Badge>}
        <Button
          variant="primary"
          size="sm"
          disabled={!isLive}
          onClick={isLive ? onAddTrade : undefined}
        >
          <Plus aria-hidden="true" size={14} />
          Add trade
        </Button>
      </div>
    </header>
  )
}
