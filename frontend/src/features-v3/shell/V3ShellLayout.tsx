import type { ReactNode } from 'react'

interface V3ShellLayoutProps {
  sidebar: ReactNode
  topbar: ReactNode
  mobileNav: ReactNode
  children: ReactNode
}

export function V3ShellLayout({ sidebar, topbar, mobileNav, children }: V3ShellLayoutProps) {
  return (
    <div className="tjv3-ui tjv3-shell">
      <a className="tjv3-shell__skip" href="#v3-preview-main">
        Skip to preview content
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
