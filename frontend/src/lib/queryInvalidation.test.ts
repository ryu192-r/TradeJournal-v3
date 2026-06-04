import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateChargesDependents, invalidateTradeDomain } from './queryInvalidation'

describe('query invalidation helpers', () => {
  it('invalidates all daily-charge dependents', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    await invalidateChargesDependents(qc)

    expect(spy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'operational'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['dashboard', 'intelligence'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['analytics'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['daily-charges', 'summary', 'analytics'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['daily-charges', 'summary', 'reports'] })
  })

  it('trade-domain invalidation includes charges and lifecycle state', async () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')

    await invalidateTradeDomain(qc, 7)

    expect(spy).toHaveBeenCalledWith({ queryKey: ['trades'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['trade', 7] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['partial-exits', 7] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['risk-dashboard'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['capital-dashboard'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['daily-charges'] })
  })
})
