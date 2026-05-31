import { useQuery } from '@tanstack/react-query'
import { getActionsInbox } from '@/lib/endpoints'
import type { ActionsInboxResponse } from '@/types/actionsInbox'
import type { NavMode } from '@/app/navigation'

export function useActionsInboxQuery(navMode: NavMode = 'simple') {
  const interfaceMode = navMode === 'pro' ? 'pro' : 'simple'
  return useQuery<ActionsInboxResponse>({
    queryKey: ['actions-inbox', interfaceMode],
    queryFn: () => getActionsInbox({ interface_mode: interfaceMode }),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (previousData) => previousData,
  })
}
