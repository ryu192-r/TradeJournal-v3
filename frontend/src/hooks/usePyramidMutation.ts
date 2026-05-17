import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pyramidTrade as pyramidTradeEndpoint } from '@/lib/endpoints'
import { invalidateTradeDomain, setTradeCache } from '@/lib/queryInvalidation'
import type { ApiTrade } from '@/types'

interface PyramidTradePayload {
  entry_price: number
  quantity: number
  entry_time?: string
  fees?: number
  stop_price?: number
}

export function usePyramidMutation() {
  const queryClient = useQueryClient()
  return useMutation<ApiTrade, Error, { id: number; payload: PyramidTradePayload }>({
    mutationFn: ({ id, payload }) => pyramidTradeEndpoint(id, payload),
    onSuccess: (trade) => {
      setTradeCache(queryClient, trade)
      invalidateTradeDomain(queryClient)
    },
  })
}
