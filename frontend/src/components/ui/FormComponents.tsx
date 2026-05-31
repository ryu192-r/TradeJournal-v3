import type { ReactNode, ComponentType } from 'react'
import { cn } from '@/lib/utils'
import { GlassButton } from './GlassButton'
import { Loader2 } from 'lucide-react'

/* ─── FormSection ────────────────────────────────────────── */

export function FormSection({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('', className)}>
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-3.5 h-3.5 text-accent shrink-0" />}
        <div>
          <h3 className="font-display text-[length:var(--text-sm)] text-text-heading">{title}</h3>
          {subtitle && <p className="text-[10px] text-text-muted font-data leading-tight">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

/* ─── FormActions ────────────────────────────────────────── */

interface FormActionsProps {
  children: ReactNode
  className?: string
  sticky?: boolean
}

export function FormActions({ children, className, sticky }: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 pt-1',
        sticky && 'sticky bottom-0 z-10 bg-bg-card/95 backdrop-blur-sm border-t border-border -mx-[var(--page-px)] px-[var(--page-px)] py-3 mt-6',
        className
      )}
    >
      {children}
    </div>
  )
}

/* ─── StickyFormFooter ───────────────────────────────────── */

interface StickyFormFooterProps {
  children: ReactNode
  className?: string
}

export function StickyFormFooter({ children, className }: StickyFormFooterProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 bg-bg-card/95 backdrop-blur-sm border-t border-border px-[var(--page-px)] py-3',
        'md:relative md:border-t-0 md:bg-transparent md:backdrop-blur-none md:px-0 md:py-0',
        className
      )}
    >
      <div className="flex items-center justify-end gap-3 md:pt-4 md:border-t md:border-border">
        {children}
      </div>
    </div>
  )
}

/* ─── FormError ──────────────────────────────────────────── */

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-lg bg-loss-muted border border-loss/20 px-3 py-2 text-sm text-loss">
      {message}
    </div>
  )
}

/* ─── FormHint ───────────────────────────────────────────── */

export function FormHint({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] text-text-muted font-data mt-1">{children}</p>
  )
}

/* ─── SubmitButton ───────────────────────────────────────── */

interface SubmitButtonProps {
  isSubmitting: boolean
  label: string
  submittingLabel?: string
  disabled?: boolean
  className?: string
}

export function SubmitButton({
  isSubmitting,
  label,
  submittingLabel = 'Saving...',
  disabled,
  className,
}: SubmitButtonProps) {
  return (
    <GlassButton
      variant="accent"
      size="md"
      type="submit"
      disabled={disabled || isSubmitting}
      className={cn('w-full sm:min-w-[140px] sm:w-auto', className)}
    >
      {isSubmitting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : null}
      {isSubmitting ? submittingLabel : label}
    </GlassButton>
  )
}
