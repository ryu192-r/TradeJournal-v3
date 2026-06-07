import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BookOpen,
  ChevronRight,
  ClipboardList,
  ListChecks,
  Loader2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActionsInboxQuery } from '@/hooks/useActionsInboxQuery'
import { useAppStore } from '@/store/appStore'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { CARD_COMPACT } from '@/components/layout/layoutTokens'
import { EmptyState, ErrorState } from '@/new-ui'
import type { ActionItem, ActionInboxSection } from '@/types/actionsInbox'
import { navigateActionTarget } from '@/components/actions/navigateActionTarget'

const EMPTY_TITLE = "You're all set"
const EMPTY_MESSAGE =
  'No pending reviews, journal steps, or risk alerts. Check back after your next session.'

const SECTION_ICONS: Record<string, LucideIcon> = {
  trade_review: ListChecks,
  workflow: BookOpen,
  journal: BookOpen,
  risk: ShieldAlert,
  rule_violation: AlertTriangle,
  suggestion: Sparkles,
  notification: ClipboardList,
  system: Bell,
}

function severityClass(severity?: string) {
  if (severity === 'critical') return 'border-loss/30 bg-loss-muted/15'
  if (severity === 'warning') return 'border-accent/25 bg-accent-muted/20'
  return 'border-border bg-bg-elevated/30'
}

function ActionRow({
  item,
  onClick,
}: {
  item: ActionItem
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer hover:border-accent/30',
        severityClass(item.severity)
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-text-heading truncate">{item.title}</div>
        {item.description && (
          <div className="mt-0.5 text-[length:var(--text-xs)] text-text-muted line-clamp-2">
            {item.description}
          </div>
        )}
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-text-faint mt-0.5" />
    </button>
  )
}

function InboxSectionBlock({
  section,
  onItemClick,
}: {
  section: ActionInboxSection
  onItemClick: (item: ActionItem) => void
}) {
  const Icon = SECTION_ICONS[section.id] ?? Bell
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-accent" />
        <h3 className="text-[10px] font-data uppercase tracking-wider text-text-faint">{section.title}</h3>
      </div>
      <div className="space-y-2">
        {section.items.map((item) => (
          <ActionRow key={item.id} item={item} onClick={() => onItemClick(item)} />
        ))}
      </div>
    </div>
  )
}

function readLargeScreen() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(min-width: 1024px)').matches
}

function useIsLargeScreen() {
  const [isLg, setIsLg] = useState(readLargeScreen)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsLg(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isLg
}

function InboxPanel({
  isLoading,
  isError,
  isFetching,
  data,
  sections,
  showEdgeLink,
  onClose,
  onRetry,
  onItemClick,
  onOpenEdge,
}: {
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  data: ReturnType<typeof useActionsInboxQuery>['data']
  sections: ActionInboxSection[]
  showEdgeLink: boolean
  onClose: () => void
  onRetry: () => void
  onItemClick: (item: ActionItem) => void
  onOpenEdge: () => void
}) {
  const body = () => {
    if (isLoading && !data) {
      return (
        <div className={cn(CARD_COMPACT, 'flex flex-col items-center justify-center py-12 gap-2')}>
          <Loader2 className="w-6 h-6 text-accent animate-spin" aria-hidden />
          <p className="text-sm text-text-muted">Loading your action list…</p>
        </div>
      )
    }

    if (isError) {
      return (
        <ErrorState
          title="Couldn't load actions"
          description="Your list will show up once the connection is back. Tap Retry to try again."
          onRetry={onRetry}
        />
      )
    }

    if (sections.length === 0) {
      return (
        <EmptyState title={EMPTY_TITLE} description={EMPTY_MESSAGE} icon={<Bell size={20} />} />
      )
    }

    return sections.map((section) => (
      <InboxSectionBlock key={section.id} section={section} onItemClick={onItemClick} />
    ))
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 max-h-[min(72dvh,32rem)] lg:max-h-none lg:h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div>
          <h2 className="text-base font-display text-text-heading">Actions</h2>
          <p className="text-[length:var(--text-xs)] text-text-muted mt-0.5">
            Reviews, journal, risk, and intelligence prompts
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text-heading cursor-pointer lg:hidden"
          aria-label="Close actions"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 scrollbar-thin"
        role="region"
        aria-label="Action items"
      >
        {isFetching && data ? (
          <p className="text-[10px] text-text-faint text-center" aria-live="polite">
            Updating…
          </p>
        ) : null}
        {body()}
      </div>
      {showEdgeLink && (
        <div className="border-t border-border px-4 py-3 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onOpenEdge}
            className="w-full text-center text-[length:var(--text-xs)] font-medium text-accent hover:underline cursor-pointer"
          >
            Open full command center →
          </button>
        </div>
      )}
    </div>
  )
}

export function ActionsInbox() {
  const [open, setOpen] = useState(false)
  const isLargeScreen = useIsLargeScreen()
  const tradeFormMode = useAppStore((s) => s.tradeFormMode)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const openDetailTrade = useAppStore((s) => s.openDetailTrade)

  const { data, isLoading, isError, refetch, isFetching } = useActionsInboxQuery()

  const handleItemClick = useCallback(
    (item: ActionItem) => {
      navigateActionTarget(item.target, { setActiveView, openDetailTrade })
      setOpen(false)
    },
    [setActiveView, openDetailTrade]
  )

  const badgeCount = Math.min(99, data?.open_count ?? 0)
  const sections = data?.sections ?? []
  const showEdgeLink = true

  if (tradeFormMode !== 'list') {
    return null
  }

  const panel = (
    <InboxPanel
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      data={data}
      sections={sections}
      showEdgeLink={showEdgeLink}
      onClose={() => setOpen(false)}
      onRetry={() => refetch()}
      onItemClick={handleItemClick}
      onOpenEdge={() => {
        navigateActionTarget({ view: 'edge-center' }, { setActiveView, openDetailTrade })
        setOpen(false)
      }}
    />
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-[45] inline-flex min-h-11 min-w-11 items-center justify-center rounded-full',
          'bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-hover transition-colors cursor-pointer',
          'bottom-[var(--actions-bell-bottom-mobile)] right-[calc(1rem+env(safe-area-inset-right,0px))]',
          'lg:bottom-6 lg:right-6 lg:z-[90] lg:min-h-12 lg:min-w-12'
        )}
        aria-label={badgeCount > 0 ? `Actions, ${badgeCount} pending` : 'Open actions'}
        title="Actions & notifications"
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-loss text-[10px] font-bold font-data flex items-center justify-center leading-none"
            aria-hidden
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {!isLargeScreen && (
        <BottomSheet open={open} onClose={() => setOpen(false)} flush>
          {open ? panel : null}
        </BottomSheet>
      )}

      {open && isLargeScreen && (
        <>
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
        </>
      )}
    </>
  )
}
