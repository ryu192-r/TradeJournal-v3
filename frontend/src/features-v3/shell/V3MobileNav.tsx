import type { V3PreviewSectionId, V3ShellMode } from './V3Shell.types'
import { v3MobileNavigationItems } from './v3Navigation'
import { cn } from '@/new-ui'

interface V3MobileNavProps {
  activeSection: V3PreviewSectionId
  onSectionChange: (section: V3PreviewSectionId) => void
  mode?: V3ShellMode
  onMobileAdd?: () => void
}

export function V3MobileNav({
  activeSection,
  onSectionChange,
  mode = 'preview',
  onMobileAdd,
}: V3MobileNavProps) {
  const isLive = mode === 'live'

  return (
    <nav className="tjv3-mobile-nav" aria-label={isLive ? 'Mobile navigation' : 'V3 preview mobile navigation'}>
      {v3MobileNavigationItems.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn('tjv3-mobile-nav__button', activeSection === item.id && 'tjv3-mobile-nav__button--active')}
          aria-current={activeSection === item.id ? 'page' : undefined}
          onClick={() => {
            if (isLive && item.id === 'import' && onMobileAdd) {
              onMobileAdd()
              return
            }
            onSectionChange(item.id)
          }}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
