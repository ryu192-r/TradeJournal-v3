import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCapitalDashboard, reconcileAccount } from '@/lib/endpoints'
import type { CapitalDashboardPayload } from '@/types'

export function useCapitalV3Data() {
  const queryClient = useQueryClient()

  const dashboard = useQuery<CapitalDashboardPayload>({
    queryKey: ['capital-dashboard'],
    queryFn: getCapitalDashboard,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  const reconcileMut = useMutation({
    mutationFn: (accountId: number) => reconcileAccount(accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['capital-events'] })
    },
  })

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
    await queryClient.invalidateQueries({ queryKey: ['capital-events'] })
  }, [queryClient])

  return {
    data: dashboard.data,
    isLoading: dashboard.isLoading && !dashboard.data,
    isFetching: dashboard.isFetching,
    error: dashboard.error as Error | null,
    refresh,
    reconcile: reconcileMut.mutate,
    isReconciling: reconcileMut.isPending,
    reconcileResult: reconcileMut.data,
  }
}
