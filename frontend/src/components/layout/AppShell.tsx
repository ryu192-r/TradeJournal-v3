import type { ReactNode } from 'react'
import { Globe2 } from 'lucide-react'
import { AppNavigation, TopBar } from '@/components/layout/AppNavigation'
import { EdgeSwipe } from '@/components/ui/EdgeSwipe'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { useAppStore } from '@/store/appStore'
import { viewMeta } from '@/app/navigation'
import { APP_SHELL_CLASS, MAIN_CONTENT_CLASS, MAIN_SCROLL_CLASS } from '@/lib/mobileLayout'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
  header?: ReactNode
}

export function AppShell({ children, header }: AppShellProps) {
  return (
    <div className={cn(APP_SHELL_CLASS)}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[120] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>
      <AppNavigation />
      <div className={cn(MAIN_CONTENT_CLASS, 'lg:ml-64')}>
        <EdgeSwipe>
          <OfflineIndicator />
          <TopBar>{header ?? <AppShellHeader />}</TopBar>
          <main id="main-content" tabIndex={-1} className={MAIN_SCROLL_CLASS}>
            {children}
          </main>
        </EdgeSwipe>
      </div>
    </div>
  )
}

function AppShellHeader() {
  const activeView = useAppStore((s) => s.activeView)
  const activeMeta = viewMeta[activeView] ?? viewMeta.dashboard

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-wider text-accent">
          <Globe2 className="h-3 w-3 shrink-0" />
          {activeMeta.section}
        </div>
        <div className="mt-0.5 truncate text-sm text-text-muted">
          {activeMeta.purpose}
        </div>
      </div>
      <div className="inline-flex shrink-0 items-center gap-[.375rem] rounded-md border border-border bg-bg-elevated px-2 py-[.1875rem] text-[.5rem] font-semibold font-data uppercase tracking-wider text-text-muted md:gap-[.4375rem] md:px-2.5 md:py-1 md:text-[.625rem]">
        <div className="h-[4px] w-[4px] rounded-full bg-accent animate-pulse md:h-[6px] md:w-[6px]" />
        <span className="hidden sm:inline">Closed · Opens 9:15 AM IST</span>
      </div>
    </div>
  )
}
