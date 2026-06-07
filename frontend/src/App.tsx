import { ToastContainer } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ActionsInbox } from '@/components/actions/ActionsInbox'
import { InstallPrompt } from '@/components/ui/InstallPrompt'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { lazy, Suspense, useEffect } from 'react'
import { mark } from '@/utils/performance'
import { LoadingState } from '@/new-ui'

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const V3PreviewRoute = lazy(() => import('@/features-v3/preview/V3PreviewRoute').then((m) => ({ default: m.V3PreviewRoute })))
const V3LiveApp = lazy(() => import('@/features-v3/shell/V3LiveApp').then((m) => ({ default: m.V3LiveApp })))

// queryClient is shared from src/lib/queryClient.ts — imported by App.tsx and authStore.ts
// so logout() can clear the cache to prevent stale user data leaks.

function ViewFallback() {
  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)]">
      <LoadingState label="Loading…" />
    </div>
  )
}

function App() {
  const { fetchMe } = useAuthStore()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isV3PreviewRoute = window.location.pathname === '/v3-preview'
  const hasStoredAuthToken = typeof window !== 'undefined' && Boolean(window.localStorage.getItem('auth_token'))
  const isAuthPending = !isAuthenticated && hasStoredAuthToken

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
      {isAuthPending ? (
        <ViewFallback />
      ) : isV3PreviewRoute && (isAuthenticated || import.meta.env.DEV) ? (
        <Suspense fallback={<ViewFallback />}>
          <ErrorBoundary name="V3Preview">
            <V3PreviewRoute isAuthenticated={isAuthenticated} />
          </ErrorBoundary>
        </Suspense>
      ) : !isAuthenticated ? (
        <Suspense fallback={<ViewFallback />}>
          <LoginPage />
        </Suspense>
      ) : (
        <>
          <Suspense fallback={<ViewFallback />}>
            <ErrorBoundary name="V3LiveApp">
              <V3LiveApp />
            </ErrorBoundary>
          </Suspense>
          <ActionsInbox />
          <ToastContainer />
          <InstallPrompt />
        </>
      )}
    </QueryClientProvider>
  )
}

export default App
