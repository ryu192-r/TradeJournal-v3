import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadChartImage, deleteChartImage } from '@/lib/endpoints'

export function useUploadChartImageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tradeId, file }: { tradeId: number; file: File }) =>
      uploadChartImage(tradeId, file),
    onSuccess: (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['trade', tradeId] })
    },
  })
}

export function useDeleteChartImageMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tradeId, url }: { tradeId: number; url: string }) =>
      deleteChartImage(tradeId, url),
    onSuccess: (_, { tradeId }) => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['trade', tradeId] })
    },
  })
}
