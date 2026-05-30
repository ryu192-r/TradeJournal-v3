import { useQuery } from '@tanstack/react-query'
import { getEdgeCommandCenter } from '@/lib/endpoints'
import type { EdgeCommandCenterResponse } from '@/types/edgeCommandCenter'

export function useEdgeCommandCenterQuery(periodStart?: string, periodEnd?: string) {
  return useQuery<EdgeCommandCenterResponse>({
    queryKey: ['edge-command-center', periodStart, periodEnd],
    queryFn: () => getEdgeCommandCenter({ period_start: periodStart, period_end: periodEnd }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  })
}
