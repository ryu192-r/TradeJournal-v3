import { ArrowLeft } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface LayoutPageHeaderProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  onBack?: () => void
}

export function PageHeader({ title, subtitle, icon: Icon, actions, onBack }: LayoutPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-[length:var(--text-sm)] text-text-muted hover:bg-bg-elevated hover:text-text-heading"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}
        <div className="flex items-center gap-2 min-w-0">
          {Icon ? <Icon className="h-5 w-5 shrink-0 text-accent" /> : null}
          <h1 className="truncate font-display text-[length:var(--heading-size)] text-text-heading">{title}</h1>
        </div>
        {subtitle ? <p className="text-[length:var(--text-sm)] text-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

