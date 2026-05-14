import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { type SelectHTMLAttributes, forwardRef } from 'react'

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
  ref: React.Ref<HTMLSelectElement>
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'w-full appearance-none rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading',
            'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
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
        <p className="mt-1 text-xs text-loss">{error}</p>
      )}
    </div>
  )
}

export const GlassSelect = forwardRef(GlassSelectFn)
GlassSelect.displayName = 'GlassSelect'
