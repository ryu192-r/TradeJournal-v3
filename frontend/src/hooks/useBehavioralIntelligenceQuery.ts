import { useQuery, useMutation } from '@tanstack/react-query'
import { getOvertradingDetection, getEarlyExitAnalysis, getDisciplineScore, getBehavioralScore } from '@/lib/endpoints'

export function useOvertradingQuery(fromDate?: string, toDate?: string, dailyThreshold?: number, weeklyThreshold?: number) {
  return useQuery({
    queryKey: ['lifecycle', 'overtrading', fromDate, toDate, dailyThreshold, weeklyThreshold],
    queryFn: () => getOvertradingDetection(fromDate, toDate, dailyThreshold, weeklyThreshold),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useEarlyExitQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'early-exits', fromDate, toDate],
    queryFn: () => getEarlyExitAnalysis(fromDate, toDate),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useDisciplineScoreQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['lifecycle', 'discipline-score', fromDate, toDate],
    queryFn: () => getDisciplineScore(fromDate, toDate),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  })
}

export function useBehavioralScoreMutation() {
  return useMutation({
    mutationFn: (lookbackDays?: number) => getBehavioralScore(lookbackDays),
  })
}