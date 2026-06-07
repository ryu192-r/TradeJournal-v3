import { useMemo, useState, type ReactNode } from 'react'
import { Eye, MoreHorizontal, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import {
  advancedNavigationItems,
  mobileBottomNavigationItems,
  mobileMoreNavigationItems,
  navigationSections,
  type ActiveView,
  type NavigationItem,
  viewMeta,
} from '@/app/navigation'
import { BottomSheet } from '@/components/ui/BottomSheet'

const V3_PREVIEW_HREF = '/v3-preview'
const V3_PREVIEW_LABEL = 'V3 Preview'

function V3PreviewLink({ className }: { className?: string }) {
  return (
    <a
      href={V3_PREVIEW_HREF}
      className={cn(
        'flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-transparent px-[.8125rem] py-[.625rem] text-[.8125rem] font-medium text-text opacity-75 transition-all duration-[120ms] ease-out hover:border-accent/20 hover:bg-accent-faint hover:text-text-heading hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-low',
        className
      )}
      title="Open the V3 design system preview (Cockpit + Trades)."
      aria-label={V3_PREVIEW_LABEL}
    >
      <Eye className="h-[15px] w-[15px] shrink-0" />
      <span className="min-w-0 flex-1 truncate">{V3_PREVIEW_LABEL}</span>
      <span className="shrink-0 rounded-full border border-accent/15 bg-accent-faint px-2 py-0.5 text-[9px] font-data uppercase tracking-wider text-accent">
        Preview
      </span>
    </a>
  )
}

function V3PreviewMobileLink({ onAfterNavigate }: { onAfterNavigate?: () => void }) {
  return (
    <a
      href={V3_PREVIEW_HREF}
      onClick={() => onAfterNavigate?.()}
      className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text transition-colors hover:bg-accent-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card"
      aria-label={V3_PREVIEW_LABEL}
    >
      <Eye className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{V3_PREVIEW_LABEL}</span>
      <span className="shrink-0 rounded-full border border-accent/15 bg-accent-faint px-2 py-0.5 text-[9px] font-data uppercase tracking-wider text-accent">
        Preview
      </span>
    </a>
  )
}

function isSelectableView(value: string): value is ActiveView {
  return Boolean(viewMeta[value as ActiveView])
}

function isNavItemActive(item: NavigationItem, activeView: ActiveView) {
  if (!item.view) return false
  if (item.view === 'review') return activeView === 'review'
  if (item.view === 'analytics') return activeView === 'analytics'
  return item.view === activeView
}

function isMobileBottomActive(item: NavigationItem, activeView: ActiveView) {
  if (item.view === 'review') return activeView === 'review' || activeView === 'analytics'
  return isNavItemActive(item, activeView)
}

function useNavSelect() {
  const { sidebarOpen, toggleSidebar, setActiveView } = useAppStore()

  return (view: ActiveView) => {
    setActiveView(view)
    if (window.innerWidth < 1024 && sidebarOpen) toggleSidebar()
  }
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileBottomNav />
    </>
  )
}

export function DesktopSidebar() {
  const { sidebarOpen, toggleSidebar, activeView } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const selectView = useNavSelect()
  const sections = navigationSections

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-border bg-bg-low transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
        aria-label="Primary navigation"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-5 pb-[1.125rem] pt-[1.375rem]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted">
            <svg className="h-[17px] w-[17px] text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display text-[1.1rem] font-medium leading-none tracking-[-0.025rem] text-text-heading">TradeJournal</div>
            <div className="mt-1 text-[10px] font-data uppercase tracking-wider text-text-faint">
              TradeJournal v3
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2.5" aria-label="Main sections">
          {sections.map((section) => (
            <div key={section.id} className="mb-3 last:mb-0">
              <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                {section.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <NavListButton
                    key={item.id}
                    item={item}
                    activeView={activeView}
                    onSelect={selectView}
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-2 border-t border-border pt-2">
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">
              Preview
            </div>
            <V3PreviewLink />
          </div>
        </nav>

        <div className="flex items-center gap-3 border-t border-border px-5 pb-[.875rem] pt-3.5">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-accent text-[.625rem] font-bold font-display text-white">
            {user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[.8125rem] font-semibold leading-tight text-text-heading">{user?.full_name || 'User'}</div>
            <div className="flex items-center gap-[.3125rem]">
              <div className="h-[5px] w-[5px] rounded-full bg-text-muted" />
              <span className="text-[.625rem] text-text-muted">Market closed</span>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={toggleSidebar}
        className="fixed left-[calc(0.75rem+env(safe-area-inset-left,0px))] top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-50 inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-border bg-bg-card text-text hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 lg:hidden"
        aria-label="Open navigation"
      >
        <PanelLeft className="h-5 w-5" />
      </button>
    </>
  )
}

function NavListButton({
  item,
  activeView,
  onSelect,
}: {
  item: NavigationItem
  activeView: ActiveView
  onSelect: (view: ActiveView) => void
}) {
  const Icon = item.icon
  const isActive = isNavItemActive(item, activeView)
  const isComingSoon = item.comingSoon || !item.view
  const isSelectable = item.view && isSelectableView(item.view)

  return (
    <button
      onClick={() => {
        if (item.view) onSelect(item.view)
      }}
      disabled={!isSelectable || isComingSoon}
      className={cn(
        'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg border px-[.8125rem] py-[.625rem] text-left text-[.8125rem] font-medium transition-all duration-[120ms] ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-low',
        isActive
          ? 'border-accent/25 bg-accent-muted text-accent'
          : isComingSoon
            ? 'cursor-not-allowed border-transparent text-text-faint opacity-65'
            : 'border-transparent text-text opacity-75 hover:bg-accent-faint hover:text-text-heading hover:opacity-100'
      )}
      title={item.purpose}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-[15px] w-[15px] shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate">{item.label}</div>
      </div>
      {item.comingSoon && (
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] font-data uppercase tracking-wider text-text-faint">
          Soon
        </span>
      )}
    </button>
  )
}

export function MobileBottomNav() {
  const { activeView } = useAppStore()
  const selectView = useNavSelect()
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const bottomHasActive = mobileBottomNavigationItems.some((item) => isMobileBottomActive(item, activeView))
  const moreActive = !bottomHasActive
  const advancedMoreItems = useMemo(() => {
    const reservedViews = new Set(
      [...mobileBottomNavigationItems, ...mobileMoreNavigationItems]
        .map((item) => item.view)
        .filter((view): view is ActiveView => Boolean(view))
    )
    return advancedNavigationItems.filter((item) => item.view && !reservedViews.has(item.view))
  }, [])

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 max-w-full overflow-x-clip border-t border-border bg-bg-low/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5 gap-1">
          {mobileBottomNavigationItems.map((item) => (
            <MobileNavButton
              key={item.id}
              item={item}
              isActive={isMobileBottomActive(item, activeView)}
              onClick={() => item.view && selectView(item.view)}
            />
          ))}
          <MobileNavButton
            item={{ id: 'more', label: 'More', icon: MoreHorizontal }}
            isActive={moreActive}
            onClick={() => setMoreSheetOpen(true)}
          />
        </div>
      </nav>

      <BottomSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="More">
        <div className="flex flex-col gap-1">
          {mobileMoreNavigationItems.map((item) => (
            <MoreSheetButton
              key={item.id}
              item={item}
              activeView={activeView}
              onSelect={(view) => {
                selectView(view)
                setMoreSheetOpen(false)
              }}
            />
          ))}
          {advancedMoreItems.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <div className="px-3 pb-1 text-[10px] font-data uppercase tracking-wider text-text-faint">Advanced</div>
              {advancedMoreItems.map((item) => (
                <MoreSheetButton
                  key={item.id}
                  item={item}
                  activeView={activeView}
                  onSelect={(view) => {
                    selectView(view)
                    setMoreSheetOpen(false)
                  }}
                />
              ))}
            </div>
          )}

          <div className="mt-2 border-t border-border pt-2">
            <div className="px-3 pb-1 text-[10px] font-data uppercase tracking-wider text-text-faint">Preview</div>
            <V3PreviewMobileLink onAfterNavigate={() => setMoreSheetOpen(false)} />
          </div>
        </div>
      </BottomSheet>
    </>
  )
}

function MobileNavButton({
  item,
  isActive,
  onClick,
}: {
  item: Pick<NavigationItem, 'id' | 'label' | 'icon'>
  isActive: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-low',
        isActive ? 'bg-accent-muted text-accent' : 'text-text-muted hover:bg-accent-faint hover:text-text-heading'
      )}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="max-w-full truncate">{item.label}</span>
    </button>
  )
}

function MoreSheetButton({
  item,
  activeView,
  onSelect,
}: {
  item: NavigationItem
  activeView: ActiveView
  onSelect: (view: ActiveView) => void
}) {
  const Icon = item.icon
  const isActive = isNavItemActive(item, activeView)
  return (
    <button
      type="button"
      onClick={() => item.view && onSelect(item.view)}
      disabled={!item.view}
      className={cn(
        'flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-card',
        isActive ? 'bg-accent-muted text-accent' : 'text-text hover:bg-accent-faint'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  )
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="flex min-h-14 items-center border-b border-border bg-bg-low/60 px-4 pl-14 pt-[env(safe-area-inset-top,0px)] backdrop-blur-sm lg:pl-4">
      <div className="ml-0 min-w-0 flex-1 lg:ml-2">{children}</div>
    </header>
  )
}
