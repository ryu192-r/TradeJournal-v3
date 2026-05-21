import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { RefreshCw, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

/* ─── SyncBadge ────────────────────────────────────────────── */

export function SyncBadge({ isSyncing, onClick }: { isSyncing: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={isSyncing}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2 py-1 text-[10px] font-data text-text-muted hover:border-text-muted hover:text-text-heading transition-all disabled:opacity-50 cursor-pointer"
    >
      {isSyncing ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-accent" />
          <span className="text-accent animate-pulse">Syncing</span>
        </>
      ) : (
        <>
          <RefreshCw className="w-3 h-3" />
          <span>Sync</span>
        </>
      )}
    </button>
  )
}

/* ─── LastUpdated ──────────────────────────────────────────── */

export function LastUpdated({ timestamp }: { timestamp?: string | Date }) {
  const text = timestamp
    ? typeof timestamp === 'string'
      ? new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      : timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-data text-text-muted">
      <Clock className="w-2.5 h-2.5" />
      {text}
    </span>
  )
}

/* ─── SectionHeader ────────────────────────────────────────── */

interface SectionHeaderProps {
  icon?: LucideIcon
  title?: string
  subtitle?: string
  badge?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  right,
  className = '',
}: SectionHeaderProps) {
  if (!title) return null
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 shrink-0 text-accent" />}
        <div className="min-w-0">
          <h2 className="font-display text-[length:var(--text-sm)] text-text-heading truncate">
            {title}
          </h2>
          {subtitle && <p className="text-[10px] text-text-muted font-data truncate">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

/* ─── SectionTitle ─────────────────────────────────────────── */

export function SectionTitle({
  icon: Icon,
  title,
  size = 'sm',
}: {
  icon?: LucideIcon
  title: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass = size === 'lg' ? 'text-[length:var(--heading-size)]' : size === 'md' ? 'text-base' : 'text-[length:var(--text-sm)]'
  return (
    <div className="flex items-center gap-2 mb-[var(--page-gap)]">
      {Icon && <Icon className="w-[15px] h-[15px] text-accent shrink-0" />}
      <h2 className={`font-display ${sizeClass} text-text-heading`}>{title}</h2>
    </div>
  )
}

/* ─── MetricCard ─────────────────────────────────────────── */

interface MetricCardProps {
  label: string
  value: React.ReactNode
  detail?: string
  icon: LucideIcon
  tone?: 'neutral' | 'accent' | 'profit' | 'loss' | 'warning'
  className?: string
}

const toneMap: Record<string, { icon: string; value: string; bg: string; border: string } > = {
  neutral:  { icon: 'text-text-muted',  value: 'text-text-heading', bg: 'bg-bg-elevated',    border: 'border-border' },
  accent:   { icon: 'text-accent',      value: 'text-accent',       bg: 'bg-accent-muted',   border: 'border-accent/20' },
  profit:   { icon: 'text-profit',       value: 'text-profit',       bg: 'bg-profit-muted',   border: 'border-profit/20' },
  loss:     { icon: 'text-loss',         value: 'text-loss',         bg: 'bg-loss-muted',     border: 'border-loss/20' },
  warning:  { icon: 'text-gold',         value: 'text-gold',         bg: 'bg-gold-faint',     border: 'border-gold/25' },
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  className = '',
}: MetricCardProps) {
  const t = toneMap[tone]
  return (
    <div className={cn(CARD, 'min-h-[112px] min-w-0 flex flex-col', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[length:var(--text-xs)] text-text-muted font-data truncate">{label}</div>
          <div className={cn('mt-1.5 break-words text-lg font-semibold leading-tight font-data tabular-nums sm:text-xl', t.value)}>
            {value}
          </div>
        </div>
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', t.bg, t.border)}>
          <Icon className={cn('h-4 w-4', t.icon)} />
        </div>
      </div>
      {detail && (
        <div className="mt-auto pt-2 truncate text-[length:var(--text-xs)] text-text-muted font-data tabular-nums">
          {detail}
        </div>
      )}
    </div>
  )
}

/* ─── CollapsibleSection ───────────────────────────────────── */

import { useState } from 'react'

interface CollapsibleSectionProps {
  title: string
  icon: LucideIcon
  defaultOpen?: boolean
  summary?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  summary,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className={cn(CARD, className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 cursor-pointer group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-accent shrink-0" />
          <h2 className="font-display text-[length:var(--text-sm)] text-text-heading truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOpen && (
            <span className="text-[10px] text-text-muted font-data hidden sm:inline">Expanded</span>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-heading transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-text-heading transition-colors" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border">
          {children}
        </div>
      )}
      {!isOpen && summary && (
        <div className="mt-3">{summary}</div>
      )}
    </div>
  )
}

/* ─── PageHeader ───────────────────────────────────────────── */

export function PageHeader({
  title,
  left,
  right,
}: {
  title: string
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {left}
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading truncate">{title}</h1>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  )
}

/* ─── StatusBadge ──────────────────────────────────────────── */

export function StatusBadge({
  status,
  tone,
}: {
  status: string
  tone: 'profit' | 'loss' | 'neutral' | 'accent'
}) {
  const map: Record<string, string > = {
    profit:   'bg-profit-muted text-profit',
    loss:     'bg-loss-muted text-loss',
    neutral:  'bg-border text-text-muted',
    accent:   'bg-accent-muted text-accent',
  }
  return (
    <span className={cn('shrink-0 text-[length:var(--text-xs)] font-medium px-2.5 py-1 rounded-full', map[tone])}>
      {status}
    </span>
  )
}

/* ─── AlertRow ─────────────────────────────────────────────── */

export function AlertRow({
  severity,
  message,
}: {
  severity: 'high' | 'medium' | 'low'
  message: string
}) {
  const map = {
    high:   { dot: 'bg-loss',    bg: 'bg-loss-muted/20',    text: 'text-loss' },
    medium: { dot: 'bg-gold',    bg: 'bg-gold-faint',        text: 'text-gold' },
    low:    { dot: 'bg-accent',  bg: 'bg-accent-muted/20',   text: 'text-text-heading' },
  }
  const s = map[severity] || map.low
  return (
    <div className={cn('flex items-start gap-2 p-2.5 rounded-lg text-sm', s.bg)}>
      <span className={cn('shrink-0 mt-1 w-1.5 h-1.5 rounded-full', s.dot)} />
      <span className={cn(s.text)}>{message}</span>
    </div>
  )
}

/* ─── SafeAreaPadding ──────────────────────────────────────── */

export function SafeAreaPadding({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}
