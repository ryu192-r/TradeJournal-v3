import type { V3PreviewSectionId } from './V3Shell.types'
import { v3MobileNavigationItems } from './v3Navigation'
import { cn } from '@/new-ui'

interface V3MobileNavProps {
  activeSection: V3PreviewSectionId
  onSectionChange: (section: V3PreviewSectionId) => void
}

export function V3MobileNav({ activeSection, onSectionChange }: V3MobileNavProps) {
  return (
    <nav className="tjv3-mobile-nav" aria-label="V3 preview mobile navigation">
      {v3MobileNavigationItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn('tjv3-mobile-nav__button', activeSection === item.id && 'tjv3-mobile-nav__button--active')}
          aria-current={activeSection === item.id ? 'page' : undefined}
          onClick={() => onSectionChange(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
