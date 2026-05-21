import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type RiskMetricTone = 'neutral' | 'accent' | 'profit' | 'loss' | 'warning'

const toneClasses: Record<RiskMetricTone, { icon: string; value: string; bg: string; border: string }> = {
  neutral: {
    icon: 'text-text-muted',
    value: 'text-text-heading',
    bg: 'bg-bg-elevated',
    border: 'border-border',
  },
  accent: {
    icon: 'text-accent',
    value: 'text-accent',
    bg: 'bg-accent-muted',
    border: 'border-accent/20',
  },
  profit: {
    icon: 'text-profit',
    value: 'text-profit',
    bg: 'bg-profit-muted',
    border: 'border-profit/20',
  },
  loss: {
    icon: 'text-loss',
    value: 'text-loss',
    bg: 'bg-loss-muted',
    border: 'border-loss/20',
  },
  warning: {
    icon: 'text-gold',
    value: 'text-gold',
    bg: 'bg-gold-faint',
    border: 'border-gold/25',
  },
}

interface RiskMetricCardProps {
  label: string
  value: string
  detail?: string
  icon: LucideIcon
  tone?: RiskMetricTone
}

export function RiskMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: RiskMetricCardProps) {
  const classes = toneClasses[tone]

  return (
    <div className="bg-card rounded-2xl border border-border p-4 animate-card-in min-h-[112px] min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[length:var(--text-xs)] text-text-muted font-data">{label}</div>
          <div className={cn('mt-2 break-words text-lg font-semibold leading-tight font-data tabular-nums sm:text-xl 2xl:text-2xl', classes.value)}>
            {value}
          </div>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', classes.bg, classes.border)}>
          <Icon className={cn('h-4 w-4', classes.icon)} />
        </div>
      </div>
      {detail ? (
        <div className="mt-2 min-h-4 truncate text-[length:var(--text-xs)] text-text-muted font-data tabular-nums">
          {detail}
        </div>
      ) : null}
    </div>
  )
}
