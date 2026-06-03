import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface TabItem {
  value: string
  label: ReactNode
  disabled?: boolean
  badge?: ReactNode
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
}

export function Tabs({ items, value, onChange, className, ariaLabel = 'Tabs' }: TabsProps) {
  return (
    <div className={cn('tjv3-tabs', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn('tjv3-tabs__tab', active && 'tjv3-tabs__tab--active')}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
          >
            <span>{item.label}</span>
            {item.badge && <span>{item.badge}</span>}
          </button>
        )
      })}
    </div>
  )
}
