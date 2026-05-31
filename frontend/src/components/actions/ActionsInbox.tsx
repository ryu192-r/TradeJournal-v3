import { useMemo, useState } from 'react'
import {
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  ListChecks,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEdgeCommandCenterQuery } from '@/hooks/useEdgeCommandCenterQuery'
import { useOperationalDashboardQuery } from '@/hooks/useOperationalDashboardQuery'
import { useAppStore } from '@/store/appStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { CARD_COMPACT } from '@/components/layout/layoutTokens'
import type { EdgePriority, EdgeReviewQueueItem } from '@/types/edgeCommandCenter'

type ActionSection = {
  id: string
  title: string
  icon: typeof Bell
  items: Array<{
    id: string
    title: string
    subtitle?: string
    severity?: 'info' | 'warning' | 'critical'
    onClick: () => void
  }>
}

function severityClass(severity?: string) {
  if (severity === 'critical') return 'border-loss/30 bg-loss-muted/15'
  if (severity === 'warning') return 'border-accent/25 bg-accent-muted/20'
  return 'border-border bg-bg-elevated/30'
}

function ActionRow({
  title,
  subtitle,
  severity,
  onClick,
}: {
  title: string
  subtitle?: string
  severity?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer hover:border-accent/30',
        severityClass(severity)
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-heading truncate">{title}</div>
        {subtitle && (
          <div className="mt-0.5 text-[length:var(--text-xs)] text-text-muted line-clamp-2">{subtitle}</div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-text-faint mt-0.5" />
    </button>
  )
}

function buildSections(
  reviewQueue: EdgeReviewQueueItem[],
  priorities: EdgePriority[],
  riskWarnings: string[],
  workflowMissing: string[],
  workflowNext: string | null,
  workflowComplete: boolean,
  handlers: {
    openReview: () => void
    openTrade: (id: number) => void
    openPerfOs: () => void
    openJournal: () => void
    openRisk: () => void
    openCoach: () => void
    openEdge: () => void
  }
): ActionSection[] {
  const sections: ActionSection[] = []

  if (reviewQueue.length > 0) {
    sections.push({
      id: 'reviews',
      title: 'Pending trade reviews',
      icon: ListChecks,
      items: reviewQueue.slice(0, 8).map((item) => ({
        id: `review-${item.trade_id}`,
        title: `${item.symbol} — ${item.reason}`,
        subtitle: item.mistake_tags.length > 0 ? item.mistake_tags.join(', ') : undefined,
        severity: item.severity,
        onClick: () => handlers.openTrade(item.trade_id),
      })),
    })
  }

  if (!workflowComplete && (workflowMissing.length > 0 || workflowNext)) {
    sections.push({
      id: 'journal',
      title: 'Daily journal',
      icon: BookOpen,
      items: [
        ...(workflowMissing.length > 0
          ? workflowMissing.map((item, i) => ({
              id: `wf-missing-${i}`,
              title: item,
              severity: 'warning' as const,
              onClick: handlers.openPerfOs,
            }))
          : []),
        ...(workflowNext
          ? [{
              id: 'wf-next',
              title: workflowNext,
              subtitle: 'Next workflow step',
              onClick: handlers.openPerfOs,
            }]
          : []),
      ],
    })
  }

  if (riskWarnings.length > 0) {
    sections.push({
      id: 'risk',
      title: 'Risk warnings',
      icon: ShieldAlert,
      items: riskWarnings.slice(0, 6).map((msg, i) => ({
        id: `risk-${i}`,
        title: msg,
        severity: 'critical' as const,
        onClick: handlers.openRisk,
      })),
    })
  }

  const suggested = priorities.filter((p) => p.severity === 'warning' || p.severity === 'critical').slice(0, 5)
  if (suggested.length > 0) {
    sections.push({
      id: 'suggested',
      title: 'Suggested actions',
      icon: Sparkles,
      items: suggested.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.action,
        severity: p.severity === 'critical' ? 'critical' : 'warning',
        onClick: () => {
          if (p.related_trade_ids.length > 0) handlers.openTrade(p.related_trade_ids[0])
          else if (p.category === 'review') handlers.openReview()
          else handlers.openEdge()
        },
      })),
    })
  }

  const infoPriorities = priorities.filter((p) => p.severity === 'info').slice(0, 3)
  if (infoPriorities.length > 0) {
    sections.push({
      id: 'notifications',
      title: 'Insights',
      icon: ClipboardList,
      items: infoPriorities.map((p) => ({
        id: p.id,
        title: p.summary,
        subtitle: p.source,
        onClick: handlers.openCoach,
      })),
    })
  }

  return sections
}

export function ActionsInbox() {
  const [open, setOpen] = useState(false)
  const { data: edge } = useEdgeCommandCenterQuery()
  const { data: operational } = useOperationalDashboardQuery()
  const setActiveView = useAppStore((s) => s.setActiveView)
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)

  const handlers = useMemo(
    () => ({
      openReview: () => {
        setActiveView('review')
        setOpen(false)
      },
      openTrade: (id: number) => {
        openDetailTrade(id)
        setOpen(false)
      },
      openPerfOs: () => {
        setActiveView('perf-os')
        setOpen(false)
      },
      openJournal: () => {
        setActiveView('journal')
        setOpen(false)
      },
      openRisk: () => {
        setActiveView('risk')
        setOpen(false)
      },
      openCoach: () => {
        setActiveView('coach')
        setOpen(false)
      },
      openEdge: () => {
        setActiveView('edge-center')
        setOpen(false)
      },
    }),
    [setActiveView, openDetailTrade]
  )

  const reviewQueue = edge?.review_queue ?? []
  const priorities = edge?.priorities ?? []
  const riskWarnings = [
    ...(operational?.risk?.warnings?.map((w) => w.message) ?? []),
    ...(edge?.summary.risk_warnings ?? []),
  ]
  const workflow = edge?.workflow ?? null
  const workflowMissing = workflow?.missing_items ?? []
  const workflowNext = workflow?.next_step ?? null
  const workflowComplete = workflow?.is_complete ?? false

  const sections = useMemo(
    () =>
      buildSections(
        reviewQueue,
        priorities,
        [...new Set(riskWarnings)],
        workflowMissing,
        workflowNext,
        workflowComplete,
        handlers
      ),
    [reviewQueue, priorities, riskWarnings, workflowMissing, workflowNext, workflowComplete, handlers]
  )

  const badgeCount = useMemo(() => {
    let n = reviewQueue.length
    if (!workflowComplete) n += Math.max(workflowMissing.length, workflowNext ? 1 : 0)
    n += operational?.risk?.warnings?.length ?? 0
    n += priorities.filter((p) => p.severity === 'critical' || p.severity === 'warning').length
    return Math.min(99, n)
  }, [reviewQueue, workflowComplete, workflowMissing, workflowNext, operational, priorities])

  const panel = (
    <div className="flex flex-col max-h-[min(70vh,520px)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div>
          <h2 className="text-base font-display text-text-heading">Actions</h2>
          <p className="text-[length:var(--text-xs)] text-text-muted mt-0.5">
            Reviews, journal, risk, and coaching prompts
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text-heading cursor-pointer lg:hidden"
          aria-label="Close actions"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-thin">
        {sections.length === 0 ? (
          <div className={cn(CARD_COMPACT, 'text-center py-8')}>
            <p className="text-sm text-text-heading font-medium">All caught up</p>
            <p className="text-[length:var(--text-xs)] text-text-muted mt-1">No pending reviews or warnings right now.</p>
          </div>
        ) : (
          sections.map((section) => {
            const Icon = section.icon
            return (
              <div key={section.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5 text-accent" />
                  <h3 className="text-[10px] font-data uppercase tracking-wider text-text-faint">{section.title}</h3>
                </div>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <ActionRow
                      key={item.id}
                      title={item.title}
                      subtitle={item.subtitle}
                      severity={item.severity}
                      onClick={item.onClick}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-3 shrink-0">
        <button
          type="button"
          onClick={handlers.openEdge}
          className="w-full text-center text-[length:var(--text-xs)] font-medium text-accent hover:underline cursor-pointer"
        >
          Open full command center →
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-[90] inline-flex min-h-12 min-w-12 items-center justify-center rounded-full',
          'bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-hover transition-colors cursor-pointer',
          'bottom-[calc(var(--bottom-nav-height)+0.75rem)] right-4 lg:bottom-6 lg:right-6'
        )}
        aria-label={badgeCount > 0 ? `Actions, ${badgeCount} pending` : 'Open actions'}
        title="Actions & notifications"
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-loss text-[10px] font-bold font-data flex items-center justify-center leading-none">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {/* Mobile: bottom sheet */}
      <div className="lg:hidden">
        <BottomSheet open={open} onClose={() => setOpen(false)} title="Actions">
          {panel}
        </BottomSheet>
      </div>

      {/* Desktop: slide-over */}
      {open && (
        <div className="hidden lg:block">
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed top-0 right-0 z-[101] h-full w-full max-w-md bg-bg-low border-l border-border shadow-xl flex flex-col"
            role="dialog"
            aria-label="Actions panel"
          >
            {panel}
          </aside>
        </div>
      )}
    </>
  )
}
