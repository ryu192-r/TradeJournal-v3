import { useQuery } from '@tanstack/react-query'
import { getRiskDashboard } from '@/lib/endpoints'
import type { RiskDashboardPayload } from '@/types/riskDashboard'

export function useRiskDashboardQuery() {
  return useQuery<RiskDashboardPayload>({
    queryKey: ['risk-dashboard'],
    queryFn: getRiskDashboard,
    staleTime: 30 * 1000,
  })
}
