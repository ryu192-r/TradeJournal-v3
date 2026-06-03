import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../utils/cn'
import { Value } from './Value'

export interface MetricProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode
  value: unknown
  description?: ReactNode
  fallback?: string
}

export function Metric({ label, value, description, fallback = '—', className, ...props }: MetricProps) {
  return (
    <div className={cn('tjv3-metric', className)} {...props}>
      <div className="tjv3-metric__label">{label}</div>
      <Value className="tjv3-metric__value" value={value} fallback={fallback} />
      {description && <p className="tjv3-metric__description">{description}</p>}
    </div>
  )
}
