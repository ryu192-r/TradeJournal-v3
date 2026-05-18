import { useQuery } from '@tanstack/react-query'
import { getPlaybookOverview, getSetupIntelligence } from '@/lib/endpoints'

export function usePlaybookOverviewQuery(fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['playbook-intelligence', 'overview', fromDate, toDate],
    queryFn: () => getPlaybookOverview(fromDate, toDate),
    staleTime: 60 * 1000,
  })
}

export function useSetupIntelligenceQuery(setupName: string | null, fromDate?: string, toDate?: string) {
  return useQuery({
    queryKey: ['playbook-intelligence', 'setup', setupName, fromDate, toDate],
    queryFn: () => getSetupIntelligence(setupName!, fromDate, toDate),
    enabled: !!setupName,
    staleTime: 60 * 1000,
  })
}