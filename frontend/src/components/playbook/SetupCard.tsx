// SetupCard: 2-col grid card with expandable detail, mini bar chart, dark discipline palette
import type { SetupPlaybookItem } from '@/types/setupPlaybook'
import { cn } from '@/lib/utils'
import { Pencil, Archive } from 'lucide-react'
import { GlassBadge } from '@/components/ui/GlassBadge'

interface SetupCardProps {
  setup: SetupPlaybookItem
  onEdit: (id: number) => void
  onArchive: (id: number) => void
  expanded: boolean
  onToggle: () => void
  staggerDelay?: number
}

function MiniBarChart({ winRate, tradeCount }: { winRate: string | null; tradeCount: number }) {
  const bars = Array.from({ length: 10 }, (_, i) => {
    if (tradeCount === 0 || !winRate) {
      return { outcome: 'gray' as const, height: 6 }
    }
    const wr = parseFloat(winRate)
    const isWin = i < Math.round((wr / 100) * 10)
    return {
      outcome: isWin ? 'win' as const : 'loss' as const,
      height: 8 + Math.round(Math.random() * 16),
    }
  })

  return (
    <div className="flex items-end gap-[2px] h-6 w-fit">
      {bars.map((bar, i) => (
        <div
          key={i}
          className="w-[6px] rounded-[2px]"
          style={{
            height: `${bar.height}px`,
            background:
              bar.outcome === 'win'
                ? 'var(--profit, #4ade80)'
                : bar.outcome === 'loss'
                  ? 'var(--loss, #f87171)'
                  : 'var(--border)',
          }}
        />
      ))}
    </div>
  )
}

function ChevronDownIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn(
        'w-4 h-4 text-text-muted transition-transform duration-300',
        expanded && 'rotate-180',
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// Inline SVG icons for expanded detail sections
function EntryCheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <circle cx="10" cy="10" r="3" fill="var(--accent)" opacity="0.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10l1.5 1.5L13 8.5" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

function ExitArrowIcon() {
  return (
    <svg className="w-4 h-4 text-profit shrink-0" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" d="M12 7l3 3m0 0l-3 3" />
      <path strokeLinecap="round" d="M5 10h10" />
    </svg>
  )
}

function StopShieldIcon() {
  return (
    <svg className="w-4 h-4 text-loss shrink-0" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 2L3 6v3c0 4.5 3 8 7 9 4-1 7-4.5 7-9V6l-7-4z" />
    </svg>
  )
}

function SizeIcon() {
  return (
    <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="6" width="3" height="10" rx="0.5" />
      <rect x="8.5" y="3" width="3" height="13" rx="0.5" />
      <rect x="13" y="8" width="3" height="8" rx="0.5" />
    </svg>
  )
}

export function SetupCard({ setup, onEdit, onArchive, expanded, onToggle, staggerDelay = 20 }: SetupCardProps) {
  const wr = setup.win_rate ?? null
  const avgR = setup.avg_r ?? '--'
  const trades = setup.trade_count

  const previewRules = setup.rules.length > 0 ? setup.rules.slice(0, 3) : setup.ideal_conditions.slice(0, 3)

  const allConditions = setup.ideal_conditions.length > 0
    ? setup.ideal_conditions
    : ['Volume confirmation on entry', 'No trade in first 5 min']

  const entryConditions = allConditions.slice(0, Math.ceil(allConditions.length / 2))
  const exitConditions = allConditions.slice(Math.ceil(allConditions.length / 2))

  const rp = setup.risk_profile
  const stopRules: string[] = []
  if (rp.stop_style) stopRules.push(`${rp.stop_style}`)
  else stopRules.push('Structural stop (swing low/high)')
  if (rp.max_risk_pct != null) stopRules.push(`Max risk: ${rp.max_risk_pct}% per trade`)

  const sizingRules: string[] = []
  if (rp.position_sizing_rule) sizingRules.push(rp.position_sizing_rule)
  else sizingRules.push('Fixed fractional position sizing')
  if (rp.max_risk_pct != null) sizingRules.push(`Risk ${rp.max_risk_pct}% of capital`)

  const tactics = setup.tactics.length > 0 ? setup.tactics : []

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-500 ease-out cursor-pointer overflow-hidden animate-card-in',
        expanded
          ? 'border-accent shadow-lg'
          : 'border-border hover:border-border/80',
      )}
      style={{
        animationDelay: `${staggerDelay}ms`,
      }}
    >
      <div onClick={onToggle} className="px-5 pt-4 pb-3">
        {/* Header: name + tag + chevron */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-[1.05rem] font-normal tracking-[-0.015rem] text-text-heading">
              {setup.name}
            </h3>
            {setup.is_active === 'active' ? (
              <GlassBadge variant="active" size="sm">Active</GlassBadge>
            ) : (
              <GlassBadge variant="muted" size="sm">Archived</GlassBadge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(setup.id) }}
              className="p-1.5 rounded-md hover:bg-accent-muted/60 text-text-muted hover:text-accent transition-colors cursor-pointer"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onArchive(setup.id) }}
              className="p-1.5 rounded-md hover:bg-loss-muted/60 text-text-muted hover:text-loss transition-colors cursor-pointer"
              title="Archive"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <ChevronDownIcon expanded={expanded} />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Minibar */}
          <div className="flex items-end col-span-2 sm:col-span-1">
            <MiniBarChart winRate={wr} tradeCount={trades} />
          </div>
          {/* Win rate */}
          <div className="flex flex-col justify-start col-span-1">
            <span className="font-data text-[.625rem] uppercase tracking-wider text-text-muted text-[.625rem]/60">Win Rate</span>
            <span className={cn(
              'font-data font-semibold text-[1rem] tabular-nums mt-0.5',
              wr && parseFloat(wr) >= 50 ? 'text-profit' : wr !== null ? 'text-loss' : 'text-text-heading',
            )}>
              {wr ?? '--'}
            </span>
          </div>
          {/* Avg R */}
          <div className="flex flex-col justify-start col-span-1">
            <span className="font-data text-[.625rem] uppercase tracking-wider text-text-muted">Avg R</span>
            <span className={cn(
              'font-data font-semibold text-[1rem] tabular-nums mt-0.5',
              avgR !== '--' && parseFloat(avgR) >= 0 ? 'text-profit' : 'text-loss-muted',
            )}>
              {avgR}R
            </span>
          </div>
          {/* Trades */}
          <div className="flex flex-col justify-start col-span-1">
            <span className="font-data text-[.625rem] uppercase tracking-wider text-text-muted">Trades</span>
            <span className="font-data font-semibold text-[1rem] tabular-nums mt-0.5 text-text-heading">
              {trades}
            </span>
          </div>
        </div>

        {/* Rules preview */}
        <div className="mt-4 flex flex-col gap-[0.35rem]">
          {previewRules.map((rule, i) => (
            <div key={i} className="flex items-start gap-2 text-[.75rem] font-medium text-text-muted">
              <span
                className="mt-[0.3rem] w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--accent)', opacity: 0.4 }}
              />
              <span className="truncate">{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expanded section */}
      <div
        className={cn(
          'overflow-hidden transition-all ease-out',
          expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0',
        )}
        style={{ transitionDuration: expanded ? '400ms' : '200ms' }}
      >
          <div className="px-5 pb-5 pt-3 border-t border-accent/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Entry Conditions */}
            <div className="rounded-xl bg-bg-elevated/30 border border-border/60 p-3.5 space-y-2">
              <div className="flex items-center gap-3">
                <EntryCheckIcon />
                <span className="text-[.6875rem] font-semibold uppercase tracking-widest text-text-heading">
                  Entry Conditions
                </span>
              </div>
              <ul className="space-y-1.5 ml-7">
                {entryConditions.map((c, i) => (
                  <li key={i} className="text-[.75rem] text-text-muted">
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Exit Conditions */}
            <div className="rounded-xl bg-bg-elevated/30 border border-border/60 p-3.5 space-y-2">
              <div className="flex items-center gap-3">
                <ExitArrowIcon />
                <span className="text-[.6875rem] font-semibold uppercase tracking-widest text-text-heading">
                  Exit Conditions
                </span>
              </div>
              <ul className="space-y-1.5 ml-7">
                {exitConditions.length > 0
                  ? exitConditions.map((c, i) => (
                      <li key={i} className="text-[.75rem] text-text-muted">
                        {c}
                      </li>
                    ))
                  : <li className="text-[.75rem] text-text-muted">Partial at 1R, runner at 2R+</li>
                }
              </ul>
            </div>

            {/* Stop Loss Rules */}
            <div className="rounded-xl bg-bg-elevated/30 border border-border/60 p-3.5 space-y-2">
              <div className="flex items-center gap-3">
                <StopShieldIcon />
                <span className="text-[.6875rem] font-semibold uppercase tracking-widest text-text-heading">
                  Stop Loss Rules
                </span>
              </div>
              <ul className="space-y-1.5 ml-7">
                {stopRules.map((s, i) => (
                  <li key={i} className="text-[.75rem] text-text-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Position Sizing */}
            <div className="rounded-xl bg-bg-elevated/30 border border-border/60 p-3.5 space-y-2">
              <div className="flex items-center gap-3">
                <SizeIcon />
                <span className="text-[.6875rem] font-semibold uppercase tracking-widest text-text-heading">
                  Position Sizing
                </span>
              </div>
              <ul className="space-y-1.5 ml-7">
                {sizingRules.map((s, i) => (
                  <li key={i} className="text-[.75rem] text-text-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tactics section if present */}
          {tactics.length > 0 && (
            <div className="mt-3 rounded-xl bg-bg-elevated/30 border border-border/60 p-3.5 space-y-2">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" d="M10 2L3 6v8l7 4 7-4V6l-7-4z" />
                  <path strokeLinecap="round" d="M3 6l7 4 7-4" />
                </svg>
                <span className="text-[.6875rem] font-semibold uppercase tracking-widest text-text-heading">
                  Tactics
                </span>
              </div>
              <div className="ml-7 flex flex-wrap gap-1.5">
                {tactics.map((t, i) => (
                  <GlassBadge key={i} variant="accent" size="sm">{t.name}</GlassBadge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}