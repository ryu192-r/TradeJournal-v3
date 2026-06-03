import { Badge, NavItem } from '@/new-ui'
import { Activity } from 'lucide-react'
import type { V3PreviewSectionId, V3ShellMode } from './V3Shell.types'
import { v3NavigationSections } from './v3Navigation'

interface V3SidebarProps {
  activeSection: V3PreviewSectionId
  onSectionChange: (section: V3PreviewSectionId) => void
  mode?: V3ShellMode
}

export function V3Sidebar({ activeSection, onSectionChange, mode = 'preview' }: V3SidebarProps) {
  const isLive = mode === 'live'

  return (
    <aside className="tjv3-sidebar" aria-label={isLive ? 'Main navigation' : 'V3 preview navigation'}>
      <div className="tjv3-sidebar__brand">
        <div className="tjv3-sidebar__mark">
          <Activity aria-hidden="true" size={18} />
        </div>
        <div className="min-w-0">
          <p className="tjv3-sidebar__title">TradeJournal v3</p>
          <p className="tjv3-sidebar__subtitle">{isLive ? 'Live app shell' : 'Midnight Cockpit'}</p>
        </div>
      </div>

      <nav className="tjv3-sidebar__nav" aria-label={isLive ? 'App sections' : 'V3 preview sections'}>
        {v3NavigationSections.map((section) => (
          <div className="tjv3-sidebar__group" key={section.id}>
            <div className="tjv3-sidebar__group-label">{section.label}</div>
            <div className="tjv3-sidebar__items">
              {section.items.map((item) => (
                <NavItem
                  key={item.id}
                  label={item.label}
                  icon={item.icon}
                  active={activeSection === item.id}
                  badge={
                    !isLive && item.phase ? <Badge variant="neutral">{item.phase}</Badge> : undefined
                  }
                  onClick={() => onSectionChange(item.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="tjv3-sidebar__footer">
        {!isLive && (
          <Badge variant="accent" dot>
            Preview route only
          </Badge>
        )}
        <div className="tjv3-sidebar__account">
          <div className="tjv3-sidebar__avatar">{isLive ? 'TJ' : 'V3'}</div>
          <div className="min-w-0">
            <div className="tjv3-sidebar__account-title">{isLive ? 'Authenticated session' : 'Shell foundation'}</div>
            <div className="tjv3-sidebar__account-subtitle">
              {isLive ? 'Live data connected' : 'No production data connected'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
