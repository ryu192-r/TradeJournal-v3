import { Badge, Button } from '@/new-ui'
import { Plus, Search } from 'lucide-react'
import type { V3PreviewSectionId } from './V3Shell.types'
import { getV3NavigationItem } from './v3Navigation'

interface V3TopBarProps {
  activeSection: V3PreviewSectionId
}

export function V3TopBar({ activeSection }: V3TopBarProps) {
  const current = getV3NavigationItem(activeSection)

  return (
    <header className="tjv3-topbar">
      <div className="tjv3-topbar__context">
        <div className="tjv3-topbar__section">
          <div className="tjv3-topbar__eyebrow">V3 shell preview</div>
          <div className="tjv3-topbar__label">{current.label}</div>
        </div>
        <Badge variant="accent">Isolated</Badge>
      </div>

      <div className="tjv3-topbar__actions">
        <div className="tjv3-topbar__command" role="search" aria-label="Preview command search" aria-disabled="true">
          <Search aria-hidden="true" />
          <span>Command/search preview</span>
          <kbd className="tjv3-topbar__kbd">/</kbd>
        </div>
        <Badge variant="neutral">No live data</Badge>
        <Button variant="primary" size="sm" disabled>
          <Plus aria-hidden="true" size={14} />
          Add trade
        </Button>
      </div>
    </header>
  )
}
