import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePriorityCard } from './EdgePriorityCard'
import { EdgeReviewQueue } from './EdgeReviewQueue'
import type { EdgePriority } from '@/types/edgeCommandCenter'

vi.mock('@/store/appStore', () => ({
  useAppStore: (sel: (s: { openDetailTrade: (id: number) => void }) => unknown) =>
    sel({ openDetailTrade: vi.fn() }),
}))

const priority: EdgePriority = {
  id: 'p1',
  title: 'No-stop risk',
  category: 'risk',
  severity: 'critical',
  summary: 'Stops missing on recent trades.',
  action: 'Define stop before every entry.',
  evidence: ['2 trades without stop'],
  related_trade_ids: [1],
  related_setup: null,
  source: 'trade_review_v2',
}

describe('EdgePriorityCard', () => {
  it('renders severity and action', () => {
    render(<EdgePriorityCard priority={priority} />)
    expect(screen.getByText('No-stop risk')).toBeTruthy()
    expect(screen.getByText(/critical/i)).toBeTruthy()
    expect(screen.getByText(/Define stop before every entry/)).toBeTruthy()
  })
})

describe('EdgeReviewQueue', () => {
  it('renders empty state', () => {
    render(<EdgeReviewQueue items={[]} />)
    expect(screen.getByText(/No trades queued/i)).toBeTruthy()
  })
})
