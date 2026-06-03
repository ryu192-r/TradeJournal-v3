import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('tjv3-empty-state', className)} {...props}>
      {icon && <div className="tjv3-empty-state__icon">{icon}</div>}
      <h2 className="tjv3-empty-state__title">{title}</h2>
      {description && <p className="tjv3-empty-state__description">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}
