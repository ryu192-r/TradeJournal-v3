import type { ReactNode } from 'react'
import type { V3ShellMode } from './V3Shell.types'

interface V3ShellLayoutProps {
  sidebar: ReactNode
  topbar: ReactNode
  mobileNav: ReactNode
  children: ReactNode
  mode?: V3ShellMode
}

export function V3ShellLayout({ sidebar, topbar, mobileNav, children, mode = 'preview' }: V3ShellLayoutProps) {
  return (
    <div className="tjv3-ui tjv3-shell">
      <a className="tjv3-shell__skip" href="#v3-preview-main">
        {mode === 'live' ? 'Skip to content' : 'Skip to preview content'}
      </a>
      {sidebar}
      <div className="tjv3-shell__content">
        {topbar}
        {children}
      </div>
      {mobileNav}
    </div>
  )
}
