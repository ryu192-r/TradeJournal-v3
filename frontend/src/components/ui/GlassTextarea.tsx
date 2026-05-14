import { cn } from '@/lib/utils'
import { type TextareaHTMLAttributes, forwardRef } from 'react'

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

function GlassTextareaFn(
  { label, error, className, ...props }: GlassTextareaProps,
  ref: React.Ref<HTMLTextAreaElement>
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint',
          'focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20',
          'transition-all duration-hover ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed resize-y',
          error && 'border-loss/50 focus:border-loss/50 focus:ring-loss/20',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-loss">{error}</p>
      )}
    </div>
  )
}

export const GlassTextarea = forwardRef(GlassTextareaFn)
GlassTextarea.displayName = 'GlassTextarea'
