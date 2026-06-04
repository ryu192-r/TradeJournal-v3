import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTrade } from '@/types'
import { useTradesV3Data } from '../hooks/useTradesV3Data'

const mocks = vi.hoisted(() => ({
  listTrades: vi.fn(),
}))

vi.mock('@/lib/endpoints', () => ({
  listTrades: mocks.listTrades,
}))

function trade(id: number): ApiTrade {
  return {
    id,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: null,
    quantity: '10',
    entry_time: '2026-06-03T09:20:00',
    exit_time: null,
    fees: '0',
    notes: null,
    tags: null,
    setup: null,
    tactic: null,
    stop_price: null,
    target_price: null,
    r_multiple: null,
    status: 'open',
  }
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useTradesV3Data', () => {
  beforeEach(() => {
    mocks.listTrades.mockReset()
  })

  it('handles direct array response', async () => {
    mocks.listTrades.mockResolvedValue([trade(1)])
    const { result } = renderHook(() => useTradesV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.trades).toHaveLength(1))

    expect(result.current.total).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('handles current paginated response', async () => {
    mocks.listTrades.mockResolvedValue({ items: [trade(2)], total: 1 })
    const { result } = renderHook(() => useTradesV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.trades).toHaveLength(1))

    expect(result.current.trades[0].id).toBe(2)
    expect(result.current.total).toBe(1)
  })

  it('loads all trade pages instead of silently capping at 200', async () => {
    const firstPage = Array.from({ length: 200 }, (_, i) => trade(i + 1))
    const secondPage = Array.from({ length: 50 }, (_, i) => trade(i + 201))
    mocks.listTrades
      .mockResolvedValueOnce({ items: firstPage, total: 250 })
      .mockResolvedValueOnce({ items: secondPage, total: 250 })

    const { result } = renderHook(() => useTradesV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.trades).toHaveLength(250))

    expect(result.current.total).toBe(250)
    expect(mocks.listTrades).toHaveBeenNthCalledWith(1, { skip: 0, limit: 200 })
    expect(mocks.listTrades).toHaveBeenNthCalledWith(2, { skip: 200, limit: 200 })
  })

  it('surfaces an error instead of silently truncating after the all-pages guard', async () => {
    mocks.listTrades.mockResolvedValue({
      items: Array.from({ length: 200 }, (_, i) => trade(i + 1)),
      total: 20_001,
    })

    const { result } = renderHook(() => useTradesV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

    expect(result.current.error?.message).toMatch(/metrics would be incomplete/)
  })

  it('returns error state when API rejects', async () => {
    mocks.listTrades.mockRejectedValue(new Error('auth failed'))
    const { result } = renderHook(() => useTradesV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

    expect(result.current.trades).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.error?.message).toBe('auth failed')
  })

  it('does not call protected API when disabled', () => {
    renderHook(() => useTradesV3Data(false), { wrapper: createWrapper() })

    expect(mocks.listTrades).not.toHaveBeenCalled()
  })
})
