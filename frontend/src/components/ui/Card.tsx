import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type CardVariant = 'default' | 'elevated' | 'subtle' | 'danger'

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-card border-border',
  elevated: 'bg-bg-elevated border-border-medium shadow-card',
  subtle: 'bg-bg-low border-border',
  danger: 'bg-loss-faint border-loss/30',
}

export function Card({ children, className, variant = 'default' }: { children: ReactNode; className?: string; variant?: CardVariant }) {
  return (
    <section className={cn('rounded-2xl border p-[var(--page-px)] animate-card-in', variantClasses[variant], className)}>
      {children}
    </section>
  )
}

