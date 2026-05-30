import { useQuery } from '@tanstack/react-query'
import {
  getPlaybookEdge,
  getPlaybookEdgeList,
  getPlaybookEdgeTop,
  getPlaybookEdgeWeakest,
} from '@/lib/endpoints'

export function usePlaybookEdgeListQuery() {
  return useQuery({
    queryKey: ['playbook-edge', 'list'],
    queryFn: getPlaybookEdgeList,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function usePlaybookEdgeQuery(setupName: string | null) {
  return useQuery({
    queryKey: ['playbook-edge', 'setup', setupName],
    queryFn: () => getPlaybookEdge(setupName!),
    enabled: !!setupName,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function usePlaybookEdgeTopQuery() {
  return useQuery({
    queryKey: ['playbook-edge', 'top'],
    queryFn: getPlaybookEdgeTop,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function usePlaybookEdgeWeakestQuery() {
  return useQuery({
    queryKey: ['playbook-edge', 'weakest'],
    queryFn: getPlaybookEdgeWeakest,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}
