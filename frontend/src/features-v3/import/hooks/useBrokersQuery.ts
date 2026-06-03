import { useQuery } from '@tanstack/react-query'
import { getBrokers } from '@/lib/endpoints'
import type { BrokerInfo } from '@/types'

export interface BrokersQueryData {
  brokers: BrokerInfo[]
}

/**
 * Fetches the live list of brokers supported by the backend.
 * Source: GET /trades/brokers — never faked locally.
 */
export function useBrokersQuery(enabled = true) {
  return useQuery<BrokersQueryData>({
    queryKey: ['brokers'],
    queryFn: () => getBrokers(),
    staleTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    enabled,
  })
}
