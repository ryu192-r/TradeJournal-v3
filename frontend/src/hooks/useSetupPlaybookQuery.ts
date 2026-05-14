import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSetups, getSetup, createSetup, updateSetup, archiveSetup, seedSetups } from '@/lib/endpoints'
import type { SetupPlaybookItem, SetupPlaybookListResponse, SetupPlaybookCreatePayload, SetupPlaybookUpdatePayload } from '@/types/setupPlaybook'

export function useSetupsQuery(is_active?: string) {
  return useQuery<SetupPlaybookListResponse>({
    queryKey: ['setups', { is_active }],
    queryFn: () => listSetups(is_active),
    staleTime: 2 * 60 * 1000,
  })
}

export function useSetupQuery(id: number | null) {
  return useQuery<SetupPlaybookItem>({
    queryKey: ['setup', id],
    queryFn: () => getSetup(id!),
    enabled: id != null && id > 0,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateSetupMutation() {
  const queryClient = useQueryClient()
  return useMutation<SetupPlaybookItem, Error, SetupPlaybookCreatePayload>({
    mutationFn: createSetup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setups'] }),
  })
}

export function useUpdateSetupMutation() {
  const queryClient = useQueryClient()
  return useMutation<SetupPlaybookItem, Error, { id: number; payload: SetupPlaybookUpdatePayload }>({
    mutationFn: ({ id, payload }) => updateSetup(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setups'] })
      queryClient.invalidateQueries({ queryKey: ['setup'] })
    },
  })
}

export function useArchiveSetupMutation() {
  const queryClient = useQueryClient()
  return useMutation<void, Error, number>({
    mutationFn: archiveSetup,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setups'] }),
  })
}

export function useSeedSetupsMutation() {
  const queryClient = useQueryClient()
  return useMutation<SetupPlaybookListResponse, Error, void>({
    mutationFn: seedSetups,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setups'] }),
  })
}
