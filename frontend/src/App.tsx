import { AppNavigation, TopBar } from '@/components/layout/AppNavigation'
import { ToastContainer } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { APP_SHELL_CLASS, MAIN_CONTENT_CLASS, MAIN_SCROLL_CLASS } from '@/lib/mobileLayout'
import { cn } from '@/lib/utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ActionsInbox } from '@/components/actions/ActionsInbox'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { EdgeSwipe } from '@/components/ui/EdgeSwipe'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { lazy, Suspense, useEffect } from 'react'
import { mark } from '@/utils/performance'
import { viewMeta } from '@/app/navigation'
import { canAccessView } from '@/app/interfaceMode'
import { ProModeGate } from '@/components/layout/ProModeGate'
import { Globe2 } from 'lucide-react'
import { LoadingState } from '@/components/ui'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ReviewAnalyticsPage = lazy(() => import('@/pages/ReviewAnalyticsPage').then((m) => ({ default: m.ReviewAnalyticsPage })))
const TradesPage = lazy(() => import('@/pages/TradesPage').then((m) => ({ default: m.TradesPage })))
const CreateTradePage = lazy(() => import('@/pages/CreateTradePage').then((m) => ({ default: m.CreateTradePage })))
const EditTradePage = lazy(() => import('@/pages/EditTradePage').then((m) => ({ default: m.EditTradePage })))
const TradeDetailPage = lazy(() => import('@/pages/TradeDetailPage').then((m) => ({ default: m.TradeDetailPage })))
const SetupPlaybookPage = lazy(() => import('@/components/playbook/SetupPlaybookPage').then((m) => ({ default: m.SetupPlaybookPage })))
const TradeIdeasPage = lazy(() => import('@/components/ideas/TradeIdeasPage').then((m) => ({ default: m.TradeIdeasPage })))
const CapitalPage = lazy(() => import('@/pages/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const AICoachPage = lazy(() => import('@/components/coach/AICoachPage').then((m) => ({ default: m.AICoachPage })))
const PerformanceOSPage = lazy(() => import('@/pages/PerformanceOSPage').then((m) => ({ default: m.PerformanceOSPage })))
const DailySANotesPage = lazy(() => import('@/pages/DailySANotesPage').then((m) => ({ default: m.DailySANotesPage })))
const JournalPage = lazy(() => import('@/pages/JournalPage').then((m) => ({ default: m.JournalPage })))
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const LifecyclePage = lazy(() => import('@/pages/LifecyclePage').then((m) => ({ default: m.LifecyclePage })))
const RiskPage = lazy(() => import('@/pages/RiskPage').then((m) => ({ default: m.RiskPage })))
const MarketContextPage = lazy(() => import('@/pages/MarketContextPage').then((m) => ({ default: m.MarketContextPage })))
const RecommendationsPage = lazy(() => import('@/pages/RecommendationsPage').then((m) => ({ default: m.RecommendationsPage })))
const CoachingIntelligencePage = lazy(() => import('@/pages/CoachingIntelligencePage').then((m) => ({ default: m.CoachingIntelligencePage })))
const EdgeCommandCenterPage = lazy(() => import('@/pages/EdgeCommandCenterPage').then((m) => ({ default: m.EdgeCommandCenterPage })))

// queryClient is shared from src/lib/queryClient.ts — imported by App.tsx and authStore.ts
// so logout() can clear the cache to prevent stale user data leaks.

function ViewFallback() {
  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)]">
      <LoadingState variant="page" />
    </div>
  )
}

function App() {
  const { sidebarOpen, activeView, tradeFormMode, selectedTradeId, navMode } = useAppStore()
  const viewBlocked = !canAccessView(activeView, navMode)
  const { isAuthenticated, fetchMe } = useAuthStore()
  const activeMeta = viewMeta[activeView]

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  /*
    Global Performance Listener:
    * Logs query success/fetch durations
    * Logs mutation success/failure durations
    * Measures dashboard full paint time
  */
  useEffect(() => {
    if (!import.meta.env.DEV) return

    const unsubQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return
      const query = event.query
      if (query.state.status === 'success' && query.state.dataUpdateCount === 1) {
        const key = query.queryKey.join('/')
        mark(`query:${key}:success`)
        console.log(`[perf] query resolved: ${key}`)
      }
    })

    const unsubMutation = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated') return
      const m = event.mutation
      if (m && (m.state.status === 'success' || m.state.status === 'error')) {
        const name = m.options.mutationKey?.join('/') ?? 'unknown'
        const status = m.state.status
        console.log(`[perf] mutation ${name} → ${status}`)
      }
    })

    return () => {
      unsubQuery()
      unsubMutation()
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <Suspense fallback={<ViewFallback />}>
          <LoginPage />
        </Suspense>
      ) : (
        <div className={cn(APP_SHELL_CLASS)}>
          <AppNavigation />
          <div
            className={cn(
              MAIN_CONTENT_CLASS,
              sidebarOpen && 'lg:ml-60'
            )}
          >
            <EdgeSwipe>
            <OfflineIndicator />
            <TopBar>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-wider text-accent">
                    <Globe2 className="h-3 w-3 shrink-0" />
                    {activeMeta.section}
                  </div>
                  <div className="mt-0.5 text-sm text-text-muted truncate">
                    {activeMeta.purpose}
                  </div>
                </div>
                <div className="inline-flex shrink-0 items-center gap-[.375rem] rounded-md px-2 py-[.1875rem] text-[.5rem] font-semibold font-data uppercase tracking-wider bg-text-muted text-text-muted md:gap-[.4375rem] md:px-2.5 md:py-1 md:text-[.625rem]">
                  <div className="w-[4px] h-[4px] rounded-full bg-accent animate-pulse md:w-[6px] md:h-[6px]" />
                  <span className="hidden sm:inline">Closed · Opens 9:15 AM IST</span>
                </div>
              </div>
            </TopBar>
            <main className={MAIN_SCROLL_CLASS}>
              {viewBlocked ? (
                <ProModeGate view={activeView} />
              ) : (
              <Suspense fallback={<ViewFallback />}>
                {activeView === 'dashboard' && <ErrorBoundary name="Dashboard"><DashboardPage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'list' && <ErrorBoundary name="Trades"><TradesPage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'create' && <ErrorBoundary name="CreateTrade"><CreateTradePage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'edit' && <ErrorBoundary name="EditTrade"><EditTradePage tradeId={selectedTradeId ?? undefined} /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'detail' && selectedTradeId != null && <ErrorBoundary name="TradeDetail"><TradeDetailPage tradeId={selectedTradeId} /></ErrorBoundary>}
                {activeView === 'playbook' && <ErrorBoundary name="Playbook"><SetupPlaybookPage /></ErrorBoundary>}
                {activeView === 'ideas' && <ErrorBoundary name="Ideas"><TradeIdeasPage /></ErrorBoundary>}
                {activeView === 'capital' && <ErrorBoundary name="Capital"><CapitalPage /></ErrorBoundary>}
                {(activeView === 'review' || activeView === 'analytics') && (
                  <ErrorBoundary name="ReviewAnalytics">
                    <ReviewAnalyticsPage defaultTab={activeView === 'analytics' ? 'overview' : 'queue'} />
                  </ErrorBoundary>
                )}
                {activeView === 'perf-os' && <ErrorBoundary name="PerfOS"><PerformanceOSPage /></ErrorBoundary>}
                {activeView === 'journal' && <ErrorBoundary name="Journal"><JournalPage /></ErrorBoundary>}
                {activeView === 'calendar' && <ErrorBoundary name="Calendar"><CalendarPage /></ErrorBoundary>}
                {activeView === 'reports' && <ErrorBoundary name="Reports"><ReportsPage /></ErrorBoundary>}
                {activeView === 'sa-notes' && <ErrorBoundary name="SANotes"><DailySANotesPage /></ErrorBoundary>}
                {activeView === 'lifecycle' && <ErrorBoundary name="Lifecycle"><LifecyclePage /></ErrorBoundary>}
                {activeView === 'risk' && <ErrorBoundary name="Risk"><RiskPage /></ErrorBoundary>}
                {activeView === 'market' && <ErrorBoundary name="MarketContext"><MarketContextPage /></ErrorBoundary>}
                {activeView === 'recommendations' && <ErrorBoundary name="Recommendations"><RecommendationsPage /></ErrorBoundary>}
                {activeView === 'coaching-intelligence' && <ErrorBoundary name="CoachingIntelligence"><CoachingIntelligencePage /></ErrorBoundary>}
                {activeView === 'edge-center' && <ErrorBoundary name="EdgeCenter"><EdgeCommandCenterPage /></ErrorBoundary>}
                {activeView === 'settings' && <ErrorBoundary name="Settings"><SettingsPage /></ErrorBoundary>}
                {activeView === 'coach' && <ErrorBoundary name="AICoach"><AICoachPage /></ErrorBoundary>}
              </Suspense>
              )}
            </main>
            </EdgeSwipe>
          </div>
          <ActionsInbox />
          <ToastContainer />
          <InstallPrompt />
        </div>
      )}
    </QueryClientProvider>
  )
}

export default App
