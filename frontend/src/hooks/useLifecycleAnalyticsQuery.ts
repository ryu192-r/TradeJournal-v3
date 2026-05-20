import { useQuery } from '@tanstack/react-query'
import { getEmotionSummary, getGradeSummary, getBehavioralAnalytics, getRevengeTrades } from '@/lib/endpoints'

export function useEmotionSummaryQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'emotion-summary', fromDate, toDate],
    queryFn: () => getEmotionSummary(fromDate, toDate),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useGradeSummaryQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'grade-summary', fromDate, toDate],
    queryFn: () => getGradeSummary(fromDate, toDate),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useBehavioralAnalyticsQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'behavioral', fromDate, toDate],
    queryFn: () => getBehavioralAnalytics(fromDate, toDate),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useRevengeTradesQuery(fromDate?: string, toDate?: string, hoursWindow?: number) {
  return useQuery({
    queryKey: ['lifecycle', 'revenge-trades', fromDate, toDate, hoursWindow],
    queryFn: () => getRevengeTrades(fromDate, toDate, hoursWindow),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}