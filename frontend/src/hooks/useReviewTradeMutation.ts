import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTrade } from '@/lib/endpoints'
import type { ApiTrade, ApiTradeUpdatePayload } from '@/types'

export function useReviewTradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<ApiTrade, Error, { id: number; payload: ApiTradeUpdatePayload }>({
    mutationFn: ({ id, payload }) => updateTrade(id, payload as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  })
}
