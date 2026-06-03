import type { ApiTrade } from '@/types'

export interface NormalizedTradeListResponse {
  items: ApiTrade[]
  total: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function tradeArrayFrom(value: unknown): ApiTrade[] {
  return Array.isArray(value) ? (value as ApiTrade[]) : []
}

export function normalizeTradeListResponse(response: unknown): NormalizedTradeListResponse {
  if (Array.isArray(response)) {
    return { items: response as ApiTrade[], total: response.length }
  }

  if (!isRecord(response)) {
    return { items: [], total: 0 }
  }

  const items = tradeArrayFrom(response.items)
  if (items.length > 0 || 'items' in response) {
    return {
      items,
      total: typeof response.total === 'number' && Number.isFinite(response.total) ? response.total : items.length,
    }
  }

  const trades = tradeArrayFrom(response.trades)
  if (trades.length > 0 || 'trades' in response) {
    return {
      items: trades,
      total: typeof response.total === 'number' && Number.isFinite(response.total) ? response.total : trades.length,
    }
  }

  const nestedData = response.data
  if (Array.isArray(nestedData)) {
    return { items: nestedData as ApiTrade[], total: nestedData.length }
  }

  if (isRecord(nestedData)) {
    return normalizeTradeListResponse(nestedData)
  }

  return { items: [], total: 0 }
}
