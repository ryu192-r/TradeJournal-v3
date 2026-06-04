import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTrade } from '@/types'
import { useCockpitV3Data } from '../hooks/useCockpitV3Data'

const mocks = vi.hoisted(() => ({
  getOperationalDashboard: vi.fn(),
  getIntelligenceDashboard: vi.fn(),
  listTrades: vi.fn(),
}))

vi.mock('@/lib/endpoints', () => ({
  getOperationalDashboard: mocks.getOperationalDashboard,
  getIntelligenceDashboard: mocks.getIntelligenceDashboard,
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

function createWrapper(queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useCockpitV3Data', () => {
  beforeEach(() => {
    mocks.getOperationalDashboard.mockReset()
    mocks.getIntelligenceDashboard.mockReset()
    mocks.listTrades.mockReset()
  })

  it('handles trades loaded from existing endpoint', async () => {
    mocks.getOperationalDashboard.mockResolvedValue({ kpi: {}, open_trades: [] })
    mocks.getIntelligenceDashboard.mockResolvedValue({ lifecycle: {}, behavioral: {}, playbook: {}, market: {} })
    mocks.listTrades.mockResolvedValue({ items: [trade(1)], total: 1 })

    const { result } = renderHook(() => useCockpitV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.trades).toHaveLength(1))

    expect(result.current.error).toBeNull()
    expect(result.current.dashboardError).toBeNull()
    expect(result.current.trades[0].id).toBe(1)
  })

  it('keeps trades visible when dashboard data partially fails', async () => {
    mocks.getOperationalDashboard.mockRejectedValue(new Error('dashboard failed'))
    mocks.getIntelligenceDashboard.mockResolvedValue({ lifecycle: {}, behavioral: {}, playbook: {}, market: {} })
    mocks.listTrades.mockResolvedValue({ items: [trade(2)], total: 1 })

    const { result } = renderHook(() => useCockpitV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.trades).toHaveLength(1))
    await waitFor(() => expect(result.current.dashboardError).toBeInstanceOf(Error))

    expect(result.current.error).toBeNull()
    expect(result.current.dashboardError?.message).toBe('dashboard failed')
  })

  it('returns blocking error when trades endpoint fails', async () => {
    mocks.getOperationalDashboard.mockResolvedValue({ kpi: {}, open_trades: [] })
    mocks.getIntelligenceDashboard.mockResolvedValue({ lifecycle: {}, behavioral: {}, playbook: {}, market: {} })
    mocks.listTrades.mockRejectedValue(new Error('trades failed'))

    const { result } = renderHook(() => useCockpitV3Data(true), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

    expect(result.current.trades).toEqual([])
    expect(result.current.error?.message).toBe('trades failed')
  })

  it('refresh invalidates daily charges with dashboards and trades', async () => {
    mocks.getOperationalDashboard.mockResolvedValue({ kpi: {}, open_trades: [] })
    mocks.getIntelligenceDashboard.mockResolvedValue({ lifecycle: {}, behavioral: {}, playbook: {}, market: {} })
    mocks.listTrades.mockResolvedValue({ items: [trade(3)], total: 1 })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useCockpitV3Data(true), { wrapper: createWrapper(qc) })
    await waitFor(() => expect(result.current.trades).toHaveLength(1))
    await result.current.refresh()

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'intelligence'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['trades'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
  })
})
