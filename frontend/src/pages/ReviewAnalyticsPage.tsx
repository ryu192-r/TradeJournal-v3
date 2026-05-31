import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ClipboardList,
  Clock,
  LineChart,
  ListChecks,
  Shield,
  Target,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardQuery } from '@/hooks/useDashboardQuery'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { TradeReviewStream } from '@/components/review/TradeReviewStream'
import { TradeReviewBatchPanel } from '@/components/trade-review-v2/TradeReviewBatchPanel'
import {
  AnalyticsEquityPanel,
  AnalyticsOverviewPanel,
  AnalyticsRiskPanel,
  AnalyticsSetupsPanel,
  AnalyticsTimePanel,
} from '@/components/analytics/AnalyticsTabPanels'
import { PageShell } from '@/components/layout/PageShell'
import { CARD } from '@/components/layout/layoutTokens'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { PageHeader, Tabs } from '@/components/ui/SharedUI'
import { CardSkeleton, EmptyState, ErrorState } from '@/components/ui/StateComponents'
import {
  readStoredReviewTab,
  REVIEW_ANALYTICS_TABS,
  storeReviewTab,
  type ReviewAnalyticsTabId,
} from '@/app/reviewAnalytics'
import { reviewTabsForMode } from '@/app/interfaceMode'
import { useAppStore } from '@/store/appStore'
import type { LucideIcon } from 'lucide-react'

const TAB_ICONS: Record<ReviewAnalyticsTabId, LucideIcon> = {
  overview: Target,
  mistakes: AlertTriangle,
  setups: ClipboardList,
  time: Clock,
  risk: Shield,
  equity: LineChart,
  queue: ListChecks,
}

export type ReviewAnalyticsPageProps = {
  /** When navigating from legacy `analytics` view */
  defaultTab?: ReviewAnalyticsTabId
}

function clampTab(tab: ReviewAnalyticsTabId, allowed: ReviewAnalyticsTabId[]): ReviewAnalyticsTabId {
  return allowed.includes(tab) ? tab : allowed[0] ?? 'queue'
}

export function ReviewAnalyticsPage({ defaultTab = 'queue' }: ReviewAnalyticsPageProps) {
  const navMode = useAppStore((s) => s.navMode)
  const allowedTabIds = useMemo(() => reviewTabsForMode(navMode), [navMode])
  const queryClient = useQueryClient()
  const { data, isLoading, error, isFetching } = useDashboardQuery()
  const { data: tradesList } = useTradesQuery({ limit: 200 })

  const unreviewedCount = useMemo(
    () => tradesList?.items?.filter((t) => !t.review_notes).length ?? 0,
    [tradesList?.items]
  )

  const [activeTab, setActiveTab] = useState<ReviewAnalyticsTabId>(() =>
    clampTab(readStoredReviewTab() ?? defaultTab, allowedTabIds)
  )

  useEffect(() => {
    setActiveTab(clampTab(readStoredReviewTab() ?? defaultTab, allowedTabIds))
  }, [defaultTab, allowedTabIds])

  useEffect(() => {
    if (!allowedTabIds.includes(activeTab)) {
      const next = allowedTabIds[0] ?? 'queue'
      setActiveTab(next)
      storeReviewTab(next)
    }
  }, [allowedTabIds, activeTab])

  const handleTabChange = useCallback((tab: string) => {
    const next = tab as ReviewAnalyticsTabId
    setActiveTab(next)
    storeReviewTab(next)
  }, [])

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['trades'] }),
      queryClient.invalidateQueries({ queryKey: ['trade-review-v2'] }),
    ])
  }, [queryClient])

  const tabs = useMemo(
    () =>
      REVIEW_ANALYTICS_TABS.filter((t) => allowedTabIds.includes(t.id)).map((t) => ({
        id: t.id,
        label: t.label,
        icon: TAB_ICONS[t.id],
        badge: t.id === 'queue' ? unreviewedCount : undefined,
      })),
    [allowedTabIds, unreviewedCount]
  )

  const analyticsBody = useMemo(() => {
    if (isLoading && !data) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} height="h-24" />
            ))}
          </div>
          <CardSkeleton height="h-64" />
        </div>
      )
    }

    if (error && !data) {
      return (
        <ErrorState
          title="Analytics failed to load"
          message={(error as Error)?.message || 'Could not load performance data.'}
          onRetry={handleRefresh}
          compact
        />
      )
    }

    if (!data) {
      return (
        <EmptyState
          title="No analytics data"
          message="Close some trades to unlock performance analysis."
          compact
        />
      )
    }

    switch (activeTab) {
      case 'overview':
        return <AnalyticsOverviewPanel data={data} />
      case 'mistakes':
        return <TradeReviewBatchPanel limit={12} />
      case 'setups':
        return <AnalyticsSetupsPanel data={data} />
      case 'time':
        return <AnalyticsTimePanel data={data} />
      case 'risk':
        return <AnalyticsRiskPanel data={data} />
      case 'equity':
        return <AnalyticsEquityPanel data={data} />
      default:
        return null
    }
  }, [activeTab, data, error, handleRefresh, isLoading])

  return (
    <PageShell className="space-y-[var(--page-gap)]">
      <PageHeader
        title="Review & Analytics"
        right={
          activeTab !== 'queue' ? (
            <span className="text-[10px] font-data text-text-faint uppercase tracking-wider">
              {isFetching ? 'Updating…' : `${data?.kpi.trade_count ?? 0} trades`}
            </span>
          ) : undefined
        }
      />

      <div className={CARD}>
        <Tabs tabs={tabs} active={activeTab} onChange={handleTabChange} />
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        <div
          role="tabpanel"
          id={`${activeTab}-panel`}
          aria-labelledby={`${activeTab}-tab`}
          className="min-w-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {activeTab === 'queue' ? (
            <div className="-mx-[var(--page-px)] sm:mx-0">
              <TradeReviewStream />
            </div>
          ) : (
            analyticsBody
          )}
        </div>
      </PullToRefresh>
    </PageShell>
  )
}

/** @deprecated Use ReviewAnalyticsPage — kept for imports/tests */
export function AnalyticsDashboardPage(props: { defaultTab?: ReviewAnalyticsTabId }) {
  return <ReviewAnalyticsPage defaultTab={props.defaultTab ?? 'overview'} />
}
