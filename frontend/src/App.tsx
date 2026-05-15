import { Sidebar, TopBar } from '@/components/layout/Sidebar'
import { TradeReviewStream } from '@/components/review/TradeReviewStream'
import { ToastContainer } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TradesPage } from '@/pages/TradesPage'
import { CreateTradePage } from '@/pages/CreateTradePage'
import { EditTradePage } from '@/pages/EditTradePage'
import { DashboardPage } from '@/pages/DashboardPage'
import { JournalPage } from '@/pages/JournalPage'
import { SetupPlaybookPage } from '@/components/playbook/SetupPlaybookPage'
import { TradeIdeasPage } from '@/components/ideas/TradeIdeasPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { OfflineIndicator } from '@/components/ui/OfflineIndicator'
import { AnalyticsDashboardPage } from '@/pages/AnalyticsDashboardPage'
import { CapitalPage } from '@/pages/CapitalPage'
import { AICoachPage } from '@/components/coach/AICoachPage'
import { LoginPage } from '@/pages/LoginPage'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useEffect } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
})

function App() {
  const { sidebarOpen, activeView, tradeFormMode, selectedTradeId } = useAppStore()
  const { isAuthenticated, fetchMe } = useAuthStore()

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <LoginPage />
      ) : (
        <div className="min-h-screen bg-bg flex">
          <Sidebar />
          <div
            className={cn(
              'flex-1 flex flex-col min-h-screen transition-all duration-300',
              sidebarOpen && 'lg:ml-56'
            )}
          >
            <OfflineIndicator />
            <TopBar>
              <div className="inline-flex items-center gap-[.375rem] rounded-md px-2 py-[.1875rem] text-[.5rem] font-semibold font-data uppercase tracking-wider bg-text-muted text-text-muted md:gap-[.4375rem] md:px-2.5 md:py-1 md:text-[.625rem]">
                <div className="w-[4px] h-[4px] rounded-full bg-accent animate-pulse md:w-[6px] md:h-[6px]" />
                <span className="hidden xs:inline">Closed · Opens 9:15 AM IST</span>
              </div>
            </TopBar>
            <main className="flex-1 overflow-auto scrollbar-thin">
              {activeView === 'dashboard' && <ErrorBoundary name="Dashboard"><DashboardPage /></ErrorBoundary>}
              {activeView === 'analytics' && <ErrorBoundary name="Analytics"><AnalyticsDashboardPage /></ErrorBoundary>}
              {activeView === 'trades' && tradeFormMode === 'list' && <ErrorBoundary name="Trades"><TradesPage /></ErrorBoundary>}
              {activeView === 'trades' && tradeFormMode === 'create' && <ErrorBoundary name="CreateTrade"><CreateTradePage /></ErrorBoundary>}
              {activeView === 'trades' && tradeFormMode === 'edit' && <ErrorBoundary name="EditTrade"><EditTradePage tradeId={selectedTradeId ?? undefined} /></ErrorBoundary>}
              {activeView === 'journal' && <ErrorBoundary name="Journal"><JournalPage /></ErrorBoundary>}
              {activeView === 'playbook' && <ErrorBoundary name="Playbook"><SetupPlaybookPage /></ErrorBoundary>}
              {activeView === 'ideas' && <ErrorBoundary name="Ideas"><TradeIdeasPage /></ErrorBoundary>}
              {activeView === 'capital' && <ErrorBoundary name="Capital"><CapitalPage /></ErrorBoundary>}
              {activeView === 'review' && <ErrorBoundary name="Review"><TradeReviewStream /></ErrorBoundary>}
              {activeView === 'settings' && <ErrorBoundary name="Settings"><SettingsPage /></ErrorBoundary>}
              {activeView === 'coach' && <ErrorBoundary name="AICoach"><AICoachPage /></ErrorBoundary>}
            </main>
          </div>
          <ToastContainer />
        </div>
      )}
    </QueryClientProvider>
  )
}

export default App
