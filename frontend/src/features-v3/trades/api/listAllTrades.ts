import { listTrades } from '@/lib/endpoints'
import { normalizeTradeListResponse } from '../../shared/apiAdapters'
import type { NormalizedTradeListResponse } from '../../shared/apiAdapters'
import type { BackendTradeStatus } from '@/types'

const PAGE_LIMIT = 200
const MAX_PAGES = 100

interface ListAllTradesParams {
  status?: BackendTradeStatus
  symbol?: string
  from_date?: string
  to_date?: string
}

export async function listAllTrades(params: ListAllTradesParams = {}): Promise<NormalizedTradeListResponse> {
  const items: NormalizedTradeListResponse['items'] = []
  let total: number
  let skip = 0

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = normalizeTradeListResponse(await listTrades({ ...params, skip, limit: PAGE_LIMIT }))
    total = response.total
    items.push(...response.items)

    if (items.length >= total || response.items.length === 0) {
      return { items, total }
    }
    skip += PAGE_LIMIT
  }

  throw new Error(`Trade list exceeded ${MAX_PAGES * PAGE_LIMIT} rows; metrics would be incomplete.`)
}
