import { useQuery } from '@tanstack/react-query'
import { getOperationalDashboard } from '@/lib/endpoints'
import type { OperationalDashboardPayload } from '@/types'

export function useOperationalDashboardQuery() {
  return useQuery<OperationalDashboardPayload>({
    queryKey: ['dashboard', 'operational'],
    queryFn: getOperationalDashboard,
    staleTime: 30_000,
    placeholderData: (previousData) => previousData,
  })
}
