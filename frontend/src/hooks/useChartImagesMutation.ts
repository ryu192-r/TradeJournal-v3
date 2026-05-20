import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadChartImage, deleteChartImage } from '@/lib/endpoints'
import { invalidateTradeDetail } from '@/lib/queryInvalidation'

export function useUploadChartImageMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tradeId, file }: { tradeId: number; file: File }) =>
      uploadChartImage(tradeId, file),
    onSuccess: (_, { tradeId }) => {
      void invalidateTradeDetail(qc, tradeId)
    },
  })
}

export function useDeleteChartImageMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ tradeId, url }: { tradeId: number; url: string }) =>
      deleteChartImage(tradeId, url),
    onSuccess: (_, { tradeId }) => {
      void invalidateTradeDetail(qc, tradeId)
    },
  })
}
