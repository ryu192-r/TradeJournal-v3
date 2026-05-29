import { cn } from '@/lib/utils'

type StatusTone = 'neutral' | 'profit' | 'loss' | 'warning' | 'accent'

const toneClasses: Record<StatusTone, string> = {
  neutral: 'bg-border text-text-muted',
  profit: 'bg-profit-muted text-profit',
  loss: 'bg-loss-muted text-loss',
  warning: 'bg-gold-faint text-gold',
  accent: 'bg-accent-muted text-accent',
}

export function StatusPill({ label, tone = 'neutral', className }: { label: string; tone?: StatusTone; className?: string }) {
  return (
    <span className={cn('inline-flex min-h-6 items-center rounded-full px-2.5 text-[length:var(--text-xs)] font-medium', toneClasses[tone], className)}>
      {label}
    </span>
  )
}

