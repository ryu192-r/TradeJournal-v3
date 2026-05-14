import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

interface GlassCardProps {
  children?: ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function GlassCard({
  children,
  className,
  hover = true,
  padding = 'md',
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'glass rounded-2xl shadow-card',
        hover && 'hover-lift cursor-pointer',
        padding === 'sm' && 'p-3',
        padding === 'md' && 'p-5',
        padding === 'lg' && 'p-7',
        className
      )}
    >
      {children}
    </div>
  )
}
