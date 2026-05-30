import { useQuery } from '@tanstack/react-query'
import {
  getCoachingIntelligenceDashboard,
  getWeeklyCoachingPlan,
  getSetupConfidenceScores,
  getBehavioralDrift,
  getTradeReviewPrompts,
} from '@/lib/endpoints'
import type {
  CoachingIntelligenceDashboard,
  WeeklyCoachingPlan,
  SetupConfidenceScore,
  BehavioralDriftSignal,
  TradeReviewPrompt,
} from '@/types/coachingIntelligence'

export function useCoachingIntelligenceDashboardQuery() {
  return useQuery<CoachingIntelligenceDashboard>({
    queryKey: ['coaching-intelligence', 'dashboard'],
    queryFn: getCoachingIntelligenceDashboard,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useWeeklyCoachingPlanQuery(weekStart?: string) {
  return useQuery<WeeklyCoachingPlan>({
    queryKey: ['coaching-intelligence', 'weekly-plan', weekStart],
    queryFn: () => getWeeklyCoachingPlan(weekStart),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useSetupConfidenceScoresQuery(periodStart?: string, periodEnd?: string) {
  return useQuery<SetupConfidenceScore[]>({
    queryKey: ['coaching-intelligence', 'setup-scores', periodStart, periodEnd],
    queryFn: () => getSetupConfidenceScores({ period_start: periodStart, period_end: periodEnd }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useBehavioralDriftQuery(lookbackDays?: number, baselineDays?: number) {
  return useQuery<BehavioralDriftSignal[]>({
    queryKey: ['coaching-intelligence', 'behavioral-drift', lookbackDays, baselineDays],
    queryFn: () => getBehavioralDrift({ lookback_days: lookbackDays, baseline_days: baselineDays }),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useTradeReviewPromptsQuery(limit?: number) {
  return useQuery<TradeReviewPrompt[]>({
    queryKey: ['coaching-intelligence', 'trade-review-prompts', limit],
    queryFn: () => getTradeReviewPrompts(limit),
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}
