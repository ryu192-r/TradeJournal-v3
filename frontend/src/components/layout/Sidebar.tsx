import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { mobileNavigationItems, navigationSections, type ActiveView } from '@/app/navigation'
import { PanelLeft, Sparkles, Plus, BarChart3, TrendingUp } from 'lucide-react'
import { type ReactNode } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'

function isSelectableView(value: string): value is ActiveView {
  return navigationSections
    .flatMap((section) => section.items)
    .some((item) => item.view === value)
}

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeView, setActiveView, navMode, setNavMode, openCreateTrade } = useAppStore()
  const user = useAuthStore((s) => s.user)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const coreMobileViews: ActiveView[] = ['dashboard', 'trades', 'analytics']
  const moreActive = !coreMobileViews.includes(activeView)

  const selectView = (view: ActiveView) => {
    setActiveView(view)
    if (window.innerWidth < 1024 && sidebarOpen) toggleSidebar()
  }

  const moreItems = navigationSections
    .flatMap((s) => s.items)
    .filter((item) => item.view && !coreMobileViews.includes(item.view))

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

       <aside
         className={cn(
           'fixed top-0 left-0 h-full z-50 bg-bg-low border-r border-border flex flex-col transition-transform duration-300 ease-out',
           sidebarOpen ? 'translate-x-0' : '-translate-x-full',
           'w-64 lg:translate-x-0'
         )}
       >
        <div className="flex items-center gap-2.5 px-5 pt-[1.375rem] pb-[1.125rem] border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent-muted flex items-center justify-center">
            <svg className="w-[17px] h-[17px] text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="font-display font-medium text-[1.1rem] tracking-[-0.025rem] leading-none text-text-heading">TradeJournal</div>
            <div className="mt-1 text-[10px] font-data uppercase tracking-wider text-text-faint">Trading OS</div>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-border">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-bg-elevated/35 p-1">
            {(['simple', 'advanced'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setNavMode(mode)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer',
                  navMode === mode ? 'bg-bg-card text-text-heading shadow-sm' : 'text-text-faint hover:text-text-muted'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11px] leading-4 text-text-faint">
            {navMode === 'simple'
              ? 'Simple mode keeps the core daily workflow visible.'
              : 'Pro mode unlocks analytics, lifecycle, risk, and market surfaces.'}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pt-2.5 pb-4">
          {navigationSections.map((section) => {
            const items = navMode === 'simple'
              ? section.items.filter((item) => item.simple || item.view === activeView || item.comingSoon)
              : section.items
            if (items.length === 0) return null

            return (
              <div key={section.id} className="mb-3 last:mb-0">
                <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint">{section.label}</div>
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.view === activeView
                    const isComingSoon = item.comingSoon || !item.view
                    const isSelectable = item.view && isSelectableView(item.view)

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.view) selectView(item.view)
                        }}
                        disabled={!isSelectable || isComingSoon}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-[.8125rem] py-[.625rem] rounded-lg text-left text-[.8125rem] font-medium transition-all duration-[120ms] ease-out border cursor-pointer',
                          isActive
                            ? 'border-accent/20 bg-accent-muted text-accent font-semibold'
                            : isComingSoon
                              ? 'border-transparent text-text-faint opacity-65 cursor-not-allowed'
                              : 'border-transparent text-text opacity-70 hover:opacity-100 hover:text-text-heading hover:bg-accent-faint'
                        )}
                        title={item.purpose}
                      >
                        <Icon className="w-[15px] h-[15px] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{item.label}</div>
                          {item.purpose && (
                            <div className="mt-0.5 truncate text-[10px] font-data text-current/70">
                              {item.purpose}
                            </div>
                          )}
                        </div>
                        {item.comingSoon ? (
                          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] font-data uppercase tracking-wider text-text-faint">
                            Soon
                          </span>
                        ) : !item.simple ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-accent/15 bg-accent-faint px-2 py-0.5 text-[9px] font-data uppercase tracking-wider text-accent">
                            <Sparkles className="h-2.5 w-2.5" />
                            Pro
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 px-5 pt-3.5 pb-[.875rem] border-t border-border">
          <div className="w-[30px] h-[30px] rounded-full bg-accent text-white flex items-center justify-center text-[.625rem] font-bold font-display shrink-0">
            {user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '??'}
          </div>
          <div>
            <div className="text-[.8125rem] font-semibold text-text-heading leading-tight">{user?.full_name || 'User'}</div>
            <div className="flex items-center gap-[.3125rem]">
              <div className="w-[5px] h-[5px] rounded-full bg-text-muted" />
              <span className="text-[.625rem] text-text-muted">Market closed</span>
            </div>
          </div>
        </div>
      </aside>

      <button
        onClick={toggleSidebar}
        className="fixed top-3 left-3 z-50 lg:hidden inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg bg-bg-card border border-border text-text hover:bg-bg-elevated cursor-pointer"
        aria-label="Open navigation"
      >
        <PanelLeft className="w-5 h-5" />
      </button>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-bg-low/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm lg:hidden">
        <div className="flex items-end justify-around gap-0.5">
          <MobileNavButton
            icon={mobileNavigationItems.find(i => i.id === 'dashboard')?.icon}
            label="Dashboard"
            isActive={activeView === 'dashboard'}
            onClick={() => selectView('dashboard')}
          />
          <MobileNavButton
            icon={mobileNavigationItems.find(i => i.id === 'trades')?.icon}
            label="Trades"
            isActive={activeView === 'trades'}
            onClick={() => selectView('trades')}
          />
          <button
            onClick={openCreateTrade}
            className="flex min-h-14 min-w-14 -mt-2 flex-col items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 hover:bg-accent-hover transition-colors cursor-pointer"
            aria-label="Add trade"
            title="Add trade"
          >
            <Plus className="w-6 h-6" />
          </button>
          <MobileNavButton
            icon={BarChart3}
            label="Reports"
            isActive={activeView === 'analytics'}
            onClick={() => selectView('analytics')}
          />
          <MobileNavButton
            icon={TrendingUp}
            label="More"
            isActive={moreActive}
            onClick={() => setMoreSheetOpen(true)}
          />
        </div>
      </nav>

      <BottomSheet open={moreSheetOpen} onClose={() => setMoreSheetOpen(false)} title="More">
        <div className="flex flex-col gap-1">
          {moreItems.map((item) => {
            const Icon = item.icon
            const isActive = item.view === activeView
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.view) selectView(item.view)
                  setMoreSheetOpen(false)
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors cursor-pointer',
                  isActive
                    ? 'bg-accent-muted text-accent'
                    : 'text-text hover:bg-accent-faint'
                )}
              >
                {Icon && <Icon className="w-4 h-4 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}

function MobileNavButton({ icon: Icon, label, isActive, onClick }: { icon: any; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-colors cursor-pointer',
        isActive ? 'text-accent' : 'text-text-muted hover:text-text-heading'
      )}
    >
      {Icon && <Icon className="w-[18px] h-[18px]" />}
      <span className="max-w-full truncate">{label}</span>
    </button>
  )
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="min-h-14 flex items-center px-4 border-b border-border bg-bg-low/60 backdrop-blur-sm">
      <div className="flex-1 ml-2">{children}</div>
    </header>
  )
}
