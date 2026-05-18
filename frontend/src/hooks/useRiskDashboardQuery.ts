import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { getRiskDashboard } from '@/lib/endpoints'
import type { RiskDashboardPayload } from '@/types/riskDashboard'

export function useRiskDashboardQuery() {
  return useQuery<RiskDashboardPayload | null>({
    queryKey: ['risk-dashboard'],
    queryFn: async () => {
      try {
        return await getRiskDashboard()
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return null
        throw error
      }
    },
    staleTime: 30 * 1000,
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) return false
      return failureCount < 2
    },
  })
}
