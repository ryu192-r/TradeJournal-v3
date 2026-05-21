import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)]'

/* ─── EmptyState ───────────────────────────────────────────── */

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  message: string
  action?: { label: string; onClick: () => void }
  compact?: boolean
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={`${CARD} ${compact ? 'py-6' : 'py-10'} text-center`}>
      <Icon className={`mx-auto mb-3 ${compact ? 'w-6 h-6' : 'w-8 h-8'} text-text-faint`} />
      <h3 className={`font-display text-text-heading ${compact ? 'text-sm' : 'text-base'} mb-1`}>
        {title}
      </h3>
      <p className={`text-text-muted ${compact ? 'text-xs' : 'text-sm'} max-w-xs mx-auto leading-relaxed`}>
        {message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/* ─── ErrorState ───────────────────────────────────────────── */

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  compact?: boolean
}

export function ErrorState({
  title = 'Failed to load',
  message = 'Something went wrong.',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  return (
    <div className={`${CARD} ${compact ? 'py-6' : 'py-10'} text-center`}>
      <AlertTriangle className={`mx-auto mb-3 ${compact ? 'w-6 h-6' : 'w-8 h-8'} text-loss`} />
      <h3 className={`font-display text-text-heading ${compact ? 'text-sm' : 'text-base'} mb-1`}>
        {title}
      </h3>
      <p className={`text-text-muted ${compact ? 'text-xs' : 'text-sm'} max-w-xs mx-auto leading-relaxed`}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-xs text-accent hover:bg-accent/20 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      )}
    </div>
  )
}

/* ─── SectionSkeleton ──────────────────────────────────────── */

interface SectionSkeletonProps {
  rows?: number
  className?: string
}

export function SectionSkeleton({ rows = 4, className = '' }: SectionSkeletonProps) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-5 rounded bg-bg-elevated w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton({ height = 'h-24', className = '' }: { height?: string; className?: string }) {
  return (
    <div className={`${CARD} ${height} animate-pulse bg-bg-elevated/50 ${className}`} />
  )
}

export function MetricSkeleton() {
  return (
    <div className={`${CARD} min-h-[112px] animate-pulse`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 w-full">
          <div className="h-3 w-20 rounded bg-bg-elevated" />
          <div className="h-6 w-28 rounded bg-bg-elevated" />
        </div>
        <div className="h-9 w-9 rounded-lg bg-bg-elevated shrink-0" />
      </div>
      <div className="mt-3 h-3 w-16 rounded bg-bg-elevated" />
    </div>
  )
}
