import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { type SelectHTMLAttributes, forwardRef, useId } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

function GlassSelectFn(
  { label, error, options, placeholder, className, ...props }: GlassSelectProps,
  ref: Ref<HTMLSelectElement>
) {
  const selectId = useId()
  const errorId = error ? `${selectId}-error` : undefined
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={props.id ?? selectId} className="block text-xs font-medium text-text-muted mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={props.id ?? selectId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={errorId}
          className={cn(
            'min-h-11 w-full appearance-none rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading',
            'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            'transition-all duration-hover ease-out',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-loss/50 focus:border-loss/50 focus:ring-loss/20',
            className
          )}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-loss">{error}</p>
      )}
    </div>
  )
}

export const GlassSelect = forwardRef(GlassSelectFn)
GlassSelect.displayName = 'GlassSelect'
