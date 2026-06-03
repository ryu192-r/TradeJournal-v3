import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'
import { Button } from '../primitives/Button'

export interface ErrorStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: string
  icon?: ReactNode
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Retry',
  icon,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div className={cn('tjv3-error-state', className)} role="alert" {...props}>
      {icon && <div className="tjv3-error-state__icon">{icon}</div>}
      <h2 className="tjv3-error-state__title">{title}</h2>
      {description && <p className="tjv3-error-state__description">{description}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
