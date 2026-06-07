import { useQuery } from '@tanstack/react-query'
import { getActionsInbox } from '@/lib/endpoints'
import type { ActionsInboxResponse } from '@/types/actionsInbox'

export function useActionsInboxQuery() {
  return useQuery<ActionsInboxResponse>({
    queryKey: ['actions-inbox', 'pro'],
    queryFn: () => getActionsInbox({ interface_mode: 'pro' }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  })
}
