import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DimensionScoreCard } from './DimensionScoreCard'
import { MistakeTagBadge } from './MistakeTagBadge'
import type { MistakeTag, ReviewDimensionScore } from '@/types/tradeReviewV2'

const criticalDim: ReviewDimensionScore = {
  dimension: 'risk_discipline',
  score: 25,
  label: 'critical',
  reason: 'Stop missing.',
  evidence: ['No stop defined.'],
  improvement: 'Define stop before entry.',
}

const goodDim: ReviewDimensionScore = {
  dimension: 'entry_quality',
  score: 88,
  label: 'excellent',
  reason: 'Strong entry.',
  evidence: ['Grade A entry.'],
  improvement: null,
}

const criticalTag: MistakeTag = {
  tag: 'no_stop',
  severity: 'critical',
  category: 'risk',
  explanation: 'No stop was defined.',
  suggested_fix: 'Define stop before entry.',
}

describe('DimensionScoreCard', () => {
  it('renders critical dimension score', () => {
    render(<DimensionScoreCard dimension={criticalDim} />)
    expect(screen.getByText('25')).toBeTruthy()
    expect(screen.getByText(/Risk Discipline/i)).toBeTruthy()
  })

  it('renders good dimension score', () => {
    render(<DimensionScoreCard dimension={goodDim} />)
    expect(screen.getByText('88')).toBeTruthy()
  })
})

describe('MistakeTagBadge', () => {
  it('renders severity for critical tag', () => {
    render(<MistakeTagBadge tag={criticalTag} />)
    expect(screen.getByText(/no stop/i)).toBeTruthy()
  })
})
