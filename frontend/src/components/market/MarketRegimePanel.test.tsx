import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  CurrentRegimeCard,
  RegimePerformanceTable,
  SetupRegimeMatrix,
} from './MarketRegimePanel'
import type {
  CurrentRegime,
  RegimePerformanceResponse,
  SetupRegimeMatrix as SetupRegimeMatrixData,
} from '@/types/marketRegime'

describe('MarketRegimePanel', () => {
  it('CurrentRegimeCard shows regime, best/worst setup', () => {
    const data: CurrentRegime = {
      regime: 'TRENDING_BULL',
      confidence: 'MEDIUM',
      status: 'FAVORABLE',
      as_of_date: '2025-07-01',
      reasoning: ['Nifty uptrend', 'VIX moderate'],
      nifty_trend: 'uptrend',
      nifty_regime: 'bullish',
      nifty_change_pct: 1.4,
      india_vix: 14,
      atr_pct: 1.2,
      advance_decline_ratio: 1.5,
      best_setup: 'Breakout',
      best_setup_expectancy_r: 1.12,
      worst_setup: 'Pullback',
      worst_setup_expectancy_r: -0.45,
    }
    render(<CurrentRegimeCard data={data} />)
    expect(screen.getByText('Trending Bull')).toBeTruthy()
    expect(screen.getByText('Breakout')).toBeTruthy()
    expect(screen.getByText('+1.12R')).toBeTruthy()
    expect(screen.getByText('-0.45R')).toBeTruthy()
  })

  it('RegimePerformanceTable empty state is clean', () => {
    const data: RegimePerformanceResponse = {
      generated_at: '2025-07-01T00:00:00Z',
      matched_trades: 0,
      regimes: [],
      favorable_regimes: [],
      unfavorable_regimes: [],
    }
    render(<RegimePerformanceTable data={data} />)
    expect(screen.getByText('No regime data yet')).toBeTruthy()
    expect(screen.getByText(/Log market snapshots/i)).toBeTruthy()
  })

  it('SetupRegimeMatrix empty state is clean', () => {
    const data: SetupRegimeMatrixData = { generated_at: '2025-07-01T00:00:00Z', regimes: [], rows: [] }
    render(<SetupRegimeMatrix data={data} />)
    expect(screen.getByText('No setup-regime data')).toBeTruthy()
  })

  it('SetupRegimeMatrix renders cells without NaN display', () => {
    const data: SetupRegimeMatrixData = {
      generated_at: '2025-07-01T00:00:00Z',
      regimes: ['TRENDING_BULL', 'RANGE_BOUND'],
      rows: [
        {
          setup: 'Breakout',
          best_regime: 'TRENDING_BULL',
          worst_regime: 'RANGE_BOUND',
          cells: [
            {
              regime: 'TRENDING_BULL',
              sample_size: 22,
              win_rate: 81.8,
              avg_r: 1.1,
              expectancy_r: 0.95,
              confidence: 'MEDIUM',
            },
            {
              regime: 'RANGE_BOUND',
              sample_size: 22,
              win_rate: 18.2,
              avg_r: -0.8,
              expectancy_r: -0.72,
              confidence: 'MEDIUM',
            },
          ],
        },
      ],
    }
    render(<SetupRegimeMatrix data={data} />)
    expect(screen.getByText('+0.95R')).toBeTruthy()
    expect(screen.getByText('-0.72R')).toBeTruthy()
    expect(screen.queryByText(/NaN/i)).toBeNull()
  })
})
