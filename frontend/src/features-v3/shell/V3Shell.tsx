import { AppCanvas } from '@/new-ui'
import type { V3ShellProps } from './V3Shell.types'
import { V3MobileNav } from './V3MobileNav'
import { V3ShellLayout } from './V3ShellLayout'
import { V3Sidebar } from './V3Sidebar'
import { V3TopBar } from './V3TopBar'
import './v3Shell.css'

export function V3Shell({ activeSection, onSectionChange, children }: V3ShellProps) {
  return (
    <V3ShellLayout
      sidebar={<V3Sidebar activeSection={activeSection} onSectionChange={onSectionChange} />}
      topbar={<V3TopBar activeSection={activeSection} />}
      mobileNav={<V3MobileNav activeSection={activeSection} onSectionChange={onSectionChange} />}
    >
      <main id="v3-preview-main" className="tjv3-shell__main" tabIndex={-1}>
        <AppCanvas className="tjv3-shell__canvas">{children}</AppCanvas>
      </main>
    </V3ShellLayout>
  )
}
