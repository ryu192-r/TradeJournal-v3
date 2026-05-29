import { cn } from '@/lib/utils'
import type { ComponentType } from 'react'

export interface ResponsiveTabItem {
  id: string
  label: string
  icon?: ComponentType<{ className?: string }>
}

interface ResponsiveTabsProps {
  value: string
  onChange: (id: string) => void
  items: ResponsiveTabItem[]
  className?: string
}

export function ResponsiveTabs({ value, onChange, items, className }: ResponsiveTabsProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1 scrollbar-thin', className)}>
      {items.map((item) => {
        const Icon = item.icon
        const active = value === item.id
        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[length:var(--text-xs)] transition-colors',
              active ? 'bg-accent text-white font-medium' : 'bg-bg-elevated text-text-muted hover:text-text-heading'
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
