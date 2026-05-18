import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import { getRiskDashboard } from '@/lib/endpoints'
import type { RiskDashboardPayload } from '@/types/riskDashboard'

function isMissingAccount(error: unknown): boolean {
  if (!axios.isAxiosError(error) || error.response?.status !== 404) return false
  const detail = error.response.data?.detail
  return typeof detail === 'string' && detail.toLowerCase().includes('no accounts found')
}

export function useRiskDashboardQuery() {
  return useQuery<RiskDashboardPayload | null>({
    queryKey: ['risk-dashboard'],
    queryFn: async () => {
      try {
        return await getRiskDashboard()
      } catch (error) {
        if (isMissingAccount(error)) return null
        throw error
      }
    },
    staleTime: 10 * 1000,
    retry: (failureCount, error) => {
      if (isMissingAccount(error)) return false
      return failureCount < 2
    },
  })
}
