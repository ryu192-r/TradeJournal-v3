import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { RiskDashboardPayload } from '@/types/riskDashboard'
import { RiskIntelligencePanel } from '../components/RiskIntelligencePanel'

const mocks = vi.hoisted(() => ({
  useRiskDashboardQuery: vi.fn(),
}))

vi.mock('@/hooks/useRiskDashboardQuery', () => ({ useRiskDashboardQuery: mocks.useRiskDashboardQuery }))

function payload(o: Partial<RiskDashboardPayload> = {}): RiskDashboardPayload {
  return {
    account_id: 1, account_name: 'Primary', net_equity: '100000', open_positions: 2,
    deployed_capital: '40000', available_capital: '60000', open_risk: '5000',
    portfolio_heat_pct: 5, deployed_capital_pct: 40, positions_without_stop: 1,
    largest_position: { trade_id: 1, symbol: 'RELIANCE', setup: 'ORB', entry_price: '2500', stop_price: '2450', quantity: '10', deployed_capital: '25000', open_risk: '500', risk_pct: 0.5 },
    largest_risk_position: { trade_id: 2, symbol: 'TCS', setup: null, entry_price: '3500', stop_price: null, quantity: '5', deployed_capital: '17500', open_risk: '0', risk_pct: null },
    risk_by_setup: [{ name: 'ORB', open_risk: '500', deployed_capital: '25000', exposure_pct: 25, position_count: 1 }],
    risk_by_symbol: [{ name: 'RELIANCE', open_risk: '500', deployed_capital: '25000', exposure_pct: 25, position_count: 1 }],
    warnings: [{ severity: 'high', code: 'missing_stop', message: 'TCS has no stop loss set.', trade_id: 2, symbol: 'TCS' }],
    ...o,
  }
}

function q(o: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, error: null, ...o }
}

beforeEach(() => {
  mocks.useRiskDashboardQuery.mockReset()
})

describe('RiskIntelligencePanel', () => {
  it('starts collapsed and does not enable the query', () => {
    mocks.useRiskDashboardQuery.mockReturnValue(q())
    render(<RiskIntelligencePanel />)
    expect(screen.getByRole('button', { name: /Expand/i })).toBeInTheDocument()
    // Called with enabled=false while collapsed
    expect(mocks.useRiskDashboardQuery).toHaveBeenCalledWith(false)
    expect(screen.queryByText('Portfolio heat')).toBeNull()
  })

  it('expands and shows heat + metrics + warnings', async () => {
    const user = userEvent.setup()
    mocks.useRiskDashboardQuery.mockReturnValue(q({ data: payload() }))
    render(<RiskIntelligencePanel />)
    await user.click(screen.getByRole('button', { name: /Expand/i }))
    expect(screen.getByText('Portfolio heat')).toBeInTheDocument()
    expect(screen.getByText('Net equity')).toBeInTheDocument()
    expect(screen.getByText(/has no stop loss set/i)).toBeInTheDocument()
  })

  it('expanded with null data shows no-account empty state', async () => {
    const user = userEvent.setup()
    mocks.useRiskDashboardQuery.mockReturnValue(q({ data: null }))
    render(<RiskIntelligencePanel />)
    await user.click(screen.getByRole('button', { name: /Expand/i }))
    expect(screen.getByText(/No risk data/i)).toBeInTheDocument()
  })

  it('reveals positions & exposure on toggle', async () => {
    const user = userEvent.setup()
    mocks.useRiskDashboardQuery.mockReturnValue(q({ data: payload() }))
    render(<RiskIntelligencePanel />)
    await user.click(screen.getByRole('button', { name: /Expand/i }))
    await user.click(screen.getByText(/View positions & exposure/i))
    expect(screen.getByText('Largest position')).toBeInTheDocument()
    expect(screen.getByText('Setup exposure')).toBeInTheDocument()
  })
})
