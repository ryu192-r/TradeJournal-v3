import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface GlassBadgeProps {
  children: ReactNode
  variant?: 'default' | 'profit' | 'loss' | 'accent' | 'muted' | 'draft' | 'active'
  size?: 'sm' | 'md'
}

export function GlassBadge({
  children,
  variant = 'default',
  size = 'sm',
}: GlassBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-medium',
        variant === 'default' && 'bg-bg-card-h text-text border border-border-medium',
        variant === 'profit' && 'bg-profit-faint text-profit border border-profit/20',
        variant === 'loss' && 'bg-loss-faint text-loss border border-loss/20',
        variant === 'accent' && 'bg-accent-muted text-accent border border-accent/20',
        variant === 'muted' && 'bg-transparent text-text-muted border border-border',
        variant === 'draft' && 'bg-gold-faint text-gold border border-gold/25',
        variant === 'active' && 'bg-profit-faint text-profit border border-profit/20',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-2.5 py-1 text-sm'
      )}
    >
      {children}
    </span>
  )
}
