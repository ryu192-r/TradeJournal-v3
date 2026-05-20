import { useQuery } from '@tanstack/react-query'
import { getIntelligenceDashboard } from '@/lib/endpoints'
import type { IntelligenceDashboardPayload } from '@/types'

export function useIntelligenceDashboardQuery() {
  return useQuery<IntelligenceDashboardPayload>({
    queryKey: ['dashboard', 'intelligence'],
    queryFn: getIntelligenceDashboard,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })
}
