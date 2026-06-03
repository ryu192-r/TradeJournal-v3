import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export type PanelVariant = 'default' | 'elevated' | 'muted'

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  variant?: PanelVariant
  children: ReactNode
}

export function Panel({
  title,
  description,
  action,
  variant = 'default',
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section className={cn('tjv3-panel', variant !== 'default' && `tjv3-panel--${variant}`, className)} {...props}>
      {(title || description || action) && (
        <div className="tjv3-panel__header">
          <div>
            {title && <h2 className="tjv3-panel__title">{title}</h2>}
            {description && <p className="tjv3-panel__description">{description}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
