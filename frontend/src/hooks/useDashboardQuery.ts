import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '@/lib/endpoints'
import type { FullDashboardPayload } from '@/types'

export function useDashboardQuery(fromDate?: string, toDate?: string) {
  return useQuery<FullDashboardPayload>({
    queryKey: ['analytics', 'dashboard', { fromDate, toDate }],
    queryFn: () => getDashboard(fromDate, toDate),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })
}
