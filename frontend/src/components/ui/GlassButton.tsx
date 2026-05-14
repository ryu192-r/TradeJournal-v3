import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react'

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'default' | 'accent' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ children, className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-hover ease-out cursor-pointer',
          'border border-border-strong backdrop-blur-sm',
          variant === 'default' &&
            'bg-bg-card/70 text-text-heading hover:bg-bg-card-h/70 hover:text-text-heading/90',
          variant === 'accent' &&
            'bg-accent/15 text-accent border-accent/30 hover:bg-accent/25 hover:text-accent-hover hover:border-accent/50',
          variant === 'danger' &&
            'bg-loss-muted text-loss border-loss/30 hover:bg-loss/25 hover:border-loss/50',
          variant === 'ghost' &&
            'bg-transparent border-transparent text-text hover:text-text-heading hover:bg-bg-card/40',
          size === 'sm' && 'px-3 py-1.5 text-sm',
          size === 'md' && 'px-4 py-2 text-sm',
          size === 'lg' && 'px-6 py-3 text-base',
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

GlassButton.displayName = 'GlassButton'
