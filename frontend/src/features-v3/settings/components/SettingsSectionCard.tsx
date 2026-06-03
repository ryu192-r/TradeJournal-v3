import type { ReactNode } from 'react'
import { Panel } from '@/new-ui'

interface SettingsSectionCardProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
}

export function SettingsSectionCard({ title, description, icon, action, children }: SettingsSectionCardProps) {
  const titleNode = icon ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--color-accent)' }}>
        {icon}
      </span>
      {title}
    </span>
  ) : (
    title
  )

  return (
    <Panel title={titleNode} description={description} action={action}>
      {children}
    </Panel>
  )
}
