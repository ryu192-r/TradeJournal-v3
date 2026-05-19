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

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AnalyticsDashboardPage = lazy(() => import('@/pages/AnalyticsDashboardPage').then((m) => ({ default: m.AnalyticsDashboardPage })))
const TradesPage = lazy(() => import('@/pages/TradesPage').then((m) => ({ default: m.TradesPage })))
const CreateTradePage = lazy(() => import('@/pages/CreateTradePage').then((m) => ({ default: m.CreateTradePage })))
const EditTradePage = lazy(() => import('@/pages/EditTradePage').then((m) => ({ default: m.EditTradePage })))
const SetupPlaybookPage = lazy(() => import('@/components/playbook/SetupPlaybookPage').then((m) => ({ default: m.SetupPlaybookPage })))
const TradeIdeasPage = lazy(() => import('@/components/ideas/TradeIdeasPage').then((m) => ({ default: m.TradeIdeasPage })))
const CapitalPage = lazy(() => import('@/pages/CapitalPage').then((m) => ({ default: m.CapitalPage })))
const TradeReviewStream = lazy(() => import('@/components/review/TradeReviewStream').then((m) => ({ default: m.TradeReviewStream })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const AICoachPage = lazy(() => import('@/components/coach/AICoachPage').then((m) => ({ default: m.AICoachPage })))
const PerformanceOSPage = lazy(() => import('@/pages/PerformanceOSPage').then((m) => ({ default: m.PerformanceOSPage })))
const DailySANotesPage = lazy(() => import('@/pages/DailySANotesPage').then((m) => ({ default: m.DailySANotesPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
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

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

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
              sidebarOpen && 'lg:ml-56'
            )}
          >
            <EdgeSwipe>
            <OfflineIndicator />
            <TopBar>
              <div className="inline-flex items-center gap-[.375rem] rounded-md px-2 py-[.1875rem] text-[.5rem] font-semibold font-data uppercase tracking-wider bg-text-muted text-text-muted md:gap-[.4375rem] md:px-2.5 md:py-1 md:text-[.625rem]">
                <div className="w-[4px] h-[4px] rounded-full bg-accent animate-pulse md:w-[6px] md:h-[6px]" />
                <span className="hidden xs:inline">Closed · Opens 9:15 AM IST</span>
              </div>
            </TopBar>
            <main className="flex-1 overflow-auto scrollbar-thin">
              <Suspense fallback={<ViewFallback />}>
                {activeView === 'dashboard' && <ErrorBoundary name="Dashboard"><DashboardPage /></ErrorBoundary>}
                {activeView === 'analytics' && <ErrorBoundary name="Analytics"><AnalyticsDashboardPage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'list' && <ErrorBoundary name="Trades"><TradesPage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'create' && <ErrorBoundary name="CreateTrade"><CreateTradePage /></ErrorBoundary>}
                {activeView === 'trades' && tradeFormMode === 'edit' && <ErrorBoundary name="EditTrade"><EditTradePage tradeId={selectedTradeId ?? undefined} /></ErrorBoundary>}
                {activeView === 'playbook' && <ErrorBoundary name="Playbook"><SetupPlaybookPage /></ErrorBoundary>}
                {activeView === 'ideas' && <ErrorBoundary name="Ideas"><TradeIdeasPage /></ErrorBoundary>}
                {activeView === 'capital' && <ErrorBoundary name="Capital"><CapitalPage /></ErrorBoundary>}
                {activeView === 'review' && <ErrorBoundary name="Review"><TradeReviewStream /></ErrorBoundary>}
                {activeView === 'perf-os' && <ErrorBoundary name="PerfOS"><PerformanceOSPage /></ErrorBoundary>}
                {activeView === 'sa-notes' && <ErrorBoundary name="SANotes"><DailySANotesPage /></ErrorBoundary>}
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
