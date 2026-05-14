import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTrade, updateTrade, getTrade } from '@/lib/endpoints'
import type { ApiTrade } from '@/types'

export function useCreateTradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<ApiTrade, Error, Record<string, unknown>>({
    mutationFn: createTrade,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  })
}

export function useUpdateTradeMutation() {
  const queryClient = useQueryClient()
  return useMutation<ApiTrade, Error, { id: number; payload: Record<string, unknown> }>({
    mutationFn: ({ id, payload }) => updateTrade(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trades'] }),
  })
}

export function useTradeQuery(id: number) {
  return useQuery<ApiTrade>({
    queryKey: ['trade', id],
    queryFn: () => getTrade(id),
    enabled: id > 0,
    staleTime: 2 * 60 * 1000,
  })
}
