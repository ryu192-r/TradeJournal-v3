import { isValidElement, type HTMLAttributes, type ReactNode } from 'react'
import { Card } from '../primitives/Card'
import { cn } from '../utils/cn'
import { safeDisplay } from '../utils/format'
import type { ValueTone } from './Value'

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  value: ReactNode
  description?: ReactNode
  tone?: ValueTone
  icon?: ReactNode
  footer?: ReactNode
  compact?: boolean
}

function renderSafeNode(value: ReactNode): ReactNode {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return safeDisplay(value)
  }
  if (isValidElement(value) || Array.isArray(value)) return value
  return '—'
}

export function MetricCard({
  label,
  value,
  description,
  tone = 'neutral',
  icon,
  footer,
  compact = false,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn('tjv3-metric-card', compact && 'tjv3-metric-card--compact', className)} {...props}>
      <div className="tjv3-metric-card__top">
        <div className="tjv3-metric-card__label">{label}</div>
        {icon && <div className="tjv3-metric-card__icon">{icon}</div>}
      </div>
      <div className={cn('tjv3-metric-card__value', `tjv3-tone-${tone}`)}>{renderSafeNode(value)}</div>
      {description && <p className="tjv3-metric__description">{description}</p>}
      {footer && <div className="tjv3-metric-card__footer">{footer}</div>}
    </Card>
  )
}
