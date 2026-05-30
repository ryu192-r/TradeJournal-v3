import { useQuery } from '@tanstack/react-query'
import { getRecommendationDashboard, getRecommendationSummary } from '@/lib/endpoints'
import type { RecommendationDashboardResponse, RecommendationSummary } from '@/types/recommendations'

export function useRecommendationDashboardQuery(periodStart?: string, periodEnd?: string) {
  return useQuery<RecommendationDashboardResponse>({
    queryKey: ['recommendations', 'dashboard', periodStart, periodEnd],
    queryFn: () => getRecommendationDashboard({ period_start: periodStart, period_end: periodEnd }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useRecommendationSummaryQuery(periodStart?: string, periodEnd?: string) {
  return useQuery<RecommendationSummary>({
    queryKey: ['recommendations', 'summary', periodStart, periodEnd],
    queryFn: () => getRecommendationSummary({ period_start: periodStart, period_end: periodEnd }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}
