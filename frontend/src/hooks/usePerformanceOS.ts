import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ensureWorkflow, getDailyDashboard, updateDailyWorkflow, advanceWorkflowPhase, resetWorkflow,
  enrichWeeklyReview, updateWeeklyReview,
  enrichMonthlyReview, updateMonthlyReview,
} from '@/lib/endpoints'
import type { DailyWorkflowUpdate, WeeklyReviewUpdate, MonthlyReviewUpdate } from '@/types/performanceOs'

export function useDailyDashboard(date?: string) {
  return useQuery({
    queryKey: ['daily-dashboard', date ?? 'today'],
    queryFn: async () => {
      await ensureWorkflow(date)
      return getDailyDashboard(date)
    },
    placeholderData: (previousData) => previousData,
  })
}

export function useUpdateWorkflow(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DailyWorkflowUpdate) => updateDailyWorkflow(date, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-dashboard'] }) },
  })
}

export function useAdvancePhase(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => advanceWorkflowPhase(date),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-dashboard'] }) },
  })
}

export function useResetWorkflow(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => resetWorkflow(date),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['daily-dashboard'] }) },
  })
}

export function useWeeklyReview(weekStart?: string) {
  return useQuery({
    queryKey: ['weekly-review', weekStart ?? 'current'],
    queryFn: () => enrichWeeklyReview(weekStart),
    placeholderData: (previousData) => previousData,
  })
}

export function useUpdateWeeklyReview(weekStart: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: WeeklyReviewUpdate) => updateWeeklyReview(weekStart, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['weekly-review'] }) },
  })
}

export function useMonthlyReview(month?: string) {
  return useQuery({
    queryKey: ['monthly-review', month ?? 'current'],
    queryFn: () => enrichMonthlyReview(month),
    placeholderData: (previousData) => previousData,
  })
}

export function useUpdateMonthlyReview(month: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MonthlyReviewUpdate) => updateMonthlyReview(month, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monthly-review'] }) },
  })
}
