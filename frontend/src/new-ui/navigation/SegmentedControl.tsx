import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface SegmentedOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps {
  options: SegmentedOption[]
  value: string
  onChange: (value: string) => void
  className?: string
  ariaLabel?: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  className,
  ariaLabel = 'Segmented control',
}: SegmentedControlProps) {
  return (
    <div className={cn('tjv3-segmented', className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={cn('tjv3-segmented__option', active && 'tjv3-segmented__option--active')}
            aria-pressed={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
