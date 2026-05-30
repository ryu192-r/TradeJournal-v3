import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SetupRegimePerformanceSection } from './SetupRegimePerformanceSection'
import type { SetupRegimePerformance } from '@/types'

describe('SetupRegimePerformanceSection', () => {
  it('shows empty message when no regime data', () => {
    render(<SetupRegimePerformanceSection regimePerf={null} />)
    expect(screen.getByText(/No regime-matched trades yet/i)).toBeTruthy()
  })

  it('shows best and worst regime correctly', () => {
    const data: SetupRegimePerformance = {
      best_regime: 'TRENDING_BULL',
      worst_regime: 'RANGE_BOUND',
      by_regime: [
        {
          regime: 'TRENDING_BULL',
          sample_size: 22,
          avg_r: 1.0,
          expectancy_r: 0.85,
          win_rate: 75,
          confidence: 'MEDIUM',
        },
        {
          regime: 'RANGE_BOUND',
          sample_size: 22,
          avg_r: -0.7,
          expectancy_r: -0.65,
          win_rate: 20,
          confidence: 'MEDIUM',
        },
      ],
    }
    render(<SetupRegimePerformanceSection regimePerf={data} />)
    expect(screen.getByText('Best regime')).toBeTruthy()
    expect(screen.getByText('Worst regime')).toBeTruthy()
    expect(screen.getAllByText('Trending Bull').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Range Bound').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('+0.85R').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('-0.65R').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/NaN/i)).toBeNull()
  })
})
