import type { ReactNode } from 'react'

export type V3PreviewSectionId =
  | 'cockpit'
  | 'trades'
  | 'review'
  | 'import'
  | 'playbooks'
  | 'analytics'
  | 'reports'
  | 'settings'
  | 'more'

export interface V3NavigationItem {
  id: V3PreviewSectionId
  label: string
  description: string
  icon: ReactNode
  phase?: string
}

export interface V3NavigationSection {
  id: string
  label: string
  items: V3NavigationItem[]
}

export type V3ShellMode = 'preview' | 'live'

export interface V3ShellProps {
  activeSection: V3PreviewSectionId
  onSectionChange: (section: V3PreviewSectionId) => void
  children: ReactNode
  mode?: V3ShellMode
  onMobileAdd?: () => void
  onAddTrade?: () => void
}
