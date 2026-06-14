import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createImprovementAction,
  updateImprovementAction,
  deleteImprovementAction,
  selectDailyFocus,
  clearDailyFocus,
  getDailyFocus,
  generateImprovementSuggestions,
  listImprovementActions,
  verifyImprovementAction,
} from '@/lib/endpoints'
import type {
  ImprovementActionCreate,
  ImprovementActionUpdate,
  ImprovementActionStatus,
} from '@/types/performanceOs'

const DAILY_FOCUS_KEY = 'daily-focus'
const ACTIONS_KEY = 'improvement-actions'

export function useDailyFocus(date: string, enabled = true) {
  return useQuery({
    queryKey: [DAILY_FOCUS_KEY, date],
    queryFn: () => getDailyFocus(date),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

function useInvalidateFocus() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: [DAILY_FOCUS_KEY] })
    void qc.invalidateQueries({ queryKey: [ACTIONS_KEY] })
  }
}

export function useImprovementActions(status?: ImprovementActionStatus, enabled = true) {
  return useQuery({
    queryKey: [ACTIONS_KEY, status ?? 'all'],
    queryFn: () => listImprovementActions(status),
    enabled,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}

export function useGenerateSuggestions() {
  const invalidate = useInvalidateFocus()
  return useMutation({
    mutationFn: (days: number = 30) => generateImprovementSuggestions(days),
    onSuccess: invalidate,
  })
}

export function useCreateImprovementAction() {
  const invalidate = useInvalidateFocus()
  return useMutation({
    mutationFn: (payload: ImprovementActionCreate) => createImprovementAction(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateImprovementAction() {
  const invalidate = useInvalidateFocus()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ImprovementActionUpdate }) =>
      updateImprovementAction(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteImprovementAction() {
  const invalidate = useInvalidateFocus()
  return useMutation({
    mutationFn: (id: number) => deleteImprovementAction(id),
    onSuccess: invalidate,
  })
}

export function useSelectDailyFocus() {
  const invalidate = useInvalidateFocus()
  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => selectDailyFocus(id, date),
    onSuccess: invalidate,
  })
}

export function useClearDailyFocus() {
  const invalidate = useInvalidateFocus()
  return useMutation({
    mutationFn: (id: number) => clearDailyFocus(id),
    onSuccess: invalidate,
  })
}

export function useVerifyImprovementAction() {
  return useMutation({
    mutationFn: ({ id, session }: { id: number; session?: string }) =>
      verifyImprovementAction(id, session),
  })
}
