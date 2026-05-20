import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getJournal, getWeeklyJournals, getWeeklyJournalStats, createJournal, updateJournal } from '@/lib/endpoints'
import type { DailyJournal, DailyJournalPayload } from '@/types'
import type { WeeklyJournalStats } from '@/types'

const JOURNAL_KEY = ['journal'] as const

export function useJournalQuery(date: string) {
  return useQuery<DailyJournal | null>({
    queryKey: [...JOURNAL_KEY, date],
    queryFn: async () => {
      try {
        return await getJournal(date)
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return null
        throw error
      }
    },
    enabled: date.length > 0,
  })
}

export function useWeeklyJournalsQuery(weekStart: string) {
  return useQuery<DailyJournal[]>({
    queryKey: [...JOURNAL_KEY, 'weekly', weekStart],
    queryFn: () => getWeeklyJournals(weekStart),
    enabled: weekStart.length > 0,
  })
}

export function useWeeklyJournalStatsQuery(weekStart: string) {
  return useQuery<WeeklyJournalStats>({
    queryKey: [...JOURNAL_KEY, 'weekly-stats', weekStart],
    queryFn: () => getWeeklyJournalStats(weekStart),
    enabled: weekStart.length > 0,
  })
}

export function useCreateJournalMutation() {
  const queryClient = useQueryClient()
  return useMutation<DailyJournal, Error, DailyJournalPayload>({
    mutationFn: createJournal,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...JOURNAL_KEY, data.date] })
      queryClient.invalidateQueries({ queryKey: [...JOURNAL_KEY, 'weekly'] })
    },
  })
}

export function useUpdateJournalMutation() {
  const queryClient = useQueryClient()
  return useMutation<DailyJournal, Error, { date: string; payload: DailyJournalPayload }>({
    mutationFn: ({ date, payload }) => updateJournal(date, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...JOURNAL_KEY, data.date] })
      queryClient.invalidateQueries({ queryKey: [...JOURNAL_KEY, 'weekly'] })
    },
  })
}
