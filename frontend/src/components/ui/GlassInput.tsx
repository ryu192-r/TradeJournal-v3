import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

function GlassInputFn(
  { label, error, icon, className, ...props }: GlassInputProps,
  ref: React.Ref<HTMLInputElement>
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint',
            'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
            'transition-all duration-hover ease-out',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            icon && 'pl-10',
            error && 'border-loss/50 focus:border-loss/50 focus:ring-loss/20',
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-loss">{error}</p>
      )}
    </div>
  )
}

export const GlassInput = forwardRef(GlassInputFn)
GlassInput.displayName = 'GlassInput'
