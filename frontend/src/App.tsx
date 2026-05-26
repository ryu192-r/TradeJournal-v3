import { Sidebar, TopBar } from '@/components/layout/Sidebar'
import { ToastContainer } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { EdgeSwipe } from '@/components/ui/EdgeSwipe'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { lazy, Suspense, useEffect } from 'react'
import { mark } from '@/utils/performance'
import { viewMeta } from '@/app/navigation'
import { Globe2 } from 'lucide-react'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AnalyticsDashboardPage = lazy(() => import('@/pages/AnalyticsDashboardPage').then((m) => ({ default: m.AnalyticsDashboardPage })))
const TradesPage = lazy(() => import('@/pages/TradesPage').then((m) => ({ default: m.TradesPage })))
const CreateTradePage = lazy(() => import('@/pages/CreateTradePage').then((m) => ({ default: m.CreateTradePage })))
const EditTradePage = lazy(() => import('@/pages/EditTradePage').then((m) => ({ default: m.EditTradePage })))
const TradeDetailPage = lazy(() => import('@/pages/TradeDetailPage').then((m) => ({ default: m.TradeDetailPage })))
const SetupPlaybookPage = lazy(() => import('@/components/playbook/SetupPlaybookPage').then((m) => ({ default: m.SetupPlaybookPage })))
const TradeIdeasPage = lazy(() => import('@/components/ideas/TradeIdeasPage').then((m) => ({ default: m.TradeIdeasPage })))
const CapitalPage = lazy(() => import('@/pages/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const TradeReviewStream = lazy(() => import('@/components/review/TradeReviewStream').then((m) => ({ default: m.TradeReviewStream })))
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      networkMode: 'online',
    },
  },
})

function ViewFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-text-muted">
      Loading...
    </div>
  )
}

function App() {
  const { sidebarOpen, activeView, tradeFormMode, selectedTradeId } = useAppStore()
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
        <div className="min-h-screen bg-bg flex">
          <Sidebar />
          <div
            className={cn(
              'flex-1 flex flex-col min-h-screen transition-all duration-300',
              sidebarOpen && 'lg:ml-60'
            )}
          >
            <EdgeSwipe>
            <OfflineIndicator />
            <TopBar>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-data uppercase tracking-wider text-accent">
                    <Globe2 className="h-3 w-3" />
                    {activeMeta.section}
                  </div>
                  <div className="mt-0.5 text-sm text-text-muted truncate">
                    {activeMeta.purpose}
                  </div>
                </div>
                <div className="inline-flex items-center gap-[.375rem] rounded-md px-2 py-[.1875rem] text-[.5rem] font-semibold font-data uppercase tracking-wider bg-text-muted text-text-muted md:gap-[.4375rem] md:px-2.5 md:py-1 md:text-[.625rem]">
                  <div className="w-[4px] h-[4px] rounded-full bg-accent animate-pulse md:w-[6px] md:h-[6px]" />
                  <span className="hidden xs:inline">Closed · Opens 9:15 AM IST</span>
                </div>
              </div>
            </TopBar>
            <main className="flex-1 overflow-auto pb-20 scrollbar-thin lg:pb-0">
              <Suspense fallback={<ViewFallback />}>
                {activeView === 'dashboard' && <ErrorBoundary name="Dashboard"><DashboardPage /></ErrorBoundary>}
                {activeView === 'analytics' && <ErrorBoundary name="Analytics"><AnalyticsDashboardPage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'list' && <ErrorBoundary name="Trades"><TradesPage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'create' && <ErrorBoundary name="CreateTrade"><CreateTradePage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'edit' && <ErrorBoundary name="EditTrade"><EditTradePage tradeId={selectedTradeId ?? undefined} /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'detail' && selectedTradeId != null && <ErrorBoundary name="TradeDetail"><TradeDetailPage tradeId={selectedTradeId} /></ErrorBoundary>}
                {activeView === 'playbook' && <ErrorBoundary name="Playbook"><SetupPlaybookPage /></ErrorBoundary>}
                {activeView === 'ideas' && <ErrorBoundary name="Ideas"><TradeIdeasPage /></ErrorBoundary>}
                {activeView === 'capital' && <ErrorBoundary name="Capital"><CapitalPage /></ErrorBoundary>}
                {activeView === 'review' && <ErrorBoundary name="Review"><TradeReviewStream /></ErrorBoundary>}
                {activeView === 'perf-os' && <ErrorBoundary name="PerfOS"><PerformanceOSPage /></ErrorBoundary>}
                {activeView === 'journal' && <ErrorBoundary name="Journal"><JournalPage /></ErrorBoundary>}
                {activeView === 'calendar' && <ErrorBoundary name="Calendar"><CalendarPage /></ErrorBoundary>}
                {activeView === 'reports' && <ErrorBoundary name="Reports"><ReportsPage /></ErrorBoundary>}
                {activeView === 'sa-notes' && <ErrorBoundary name="SANotes"><DailySANotesPage /></ErrorBoundary>}
                {activeView === 'lifecycle' && <ErrorBoundary name="Lifecycle"><LifecyclePage /></ErrorBoundary>}
                {activeView === 'risk' && <ErrorBoundary name="Risk"><RiskPage /></ErrorBoundary>}
                {activeView === 'market' && <ErrorBoundary name="MarketContext"><MarketContextPage /></ErrorBoundary>}
                {activeView === 'settings' && <ErrorBoundary name="Settings"><SettingsPage /></ErrorBoundary>}
                {activeView === 'coach' && <ErrorBoundary name="AICoach"><AICoachPage /></ErrorBoundary>}
              </Suspense>
            </main>
            </EdgeSwipe>
          </div>
          <ToastContainer />
          <InstallPrompt />
        </div>
      )}
    </QueryClientProvider>
  )
}

export default App
