import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { DailyJournal } from '@/types'
import { JournalV3Page } from '../JournalV3Page'
import type { JournalV3Data, JournalWeekDay } from '../hooks/useJournalV3Data'

const mocks = vi.hoisted(() => ({
  useJournalV3Data: vi.fn(),
  useJournalQuery: vi.fn(),
  useCreateJournalMutation: vi.fn(),
  useUpdateJournalMutation: vi.fn(),
}))

vi.mock('../hooks/useJournalV3Data', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useJournalV3Data')>('../hooks/useJournalV3Data')
  return { ...actual, useJournalV3Data: mocks.useJournalV3Data }
})
vi.mock('@/hooks/useJournalMutation', () => ({
  useJournalQuery: mocks.useJournalQuery,
  useCreateJournalMutation: mocks.useCreateJournalMutation,
  useUpdateJournalMutation: mocks.useUpdateJournalMutation,
}))

function journal(o: Partial<DailyJournal> = {}): DailyJournal {
  return {
    id: 1, date: '2025-06-02', pre_trade_notes: 'Watch RELIANCE breakout', post_trade_notes: null,
    bias_notes: null, trade_count: null, total_pnl: null, avg_r_multiple: null, win_rate: null,
    mood_rating: 4, discipline_rating: 5, mood_notes: null, rules_followed: null,
    rules_violated: null, lessons_learned: null, ...o,
  }
}

function weekDay(date: string, weekday: string, j: DailyJournal | null): JournalWeekDay {
  return { date, weekday, journal: j }
}

function data(o: Partial<JournalV3Data> = {}): JournalV3Data {
  return {
    weekStart: '2025-06-02',
    days: [
      weekDay('2025-06-02', 'Mon', journal()),
      weekDay('2025-06-03', 'Tue', null),
      weekDay('2025-06-04', 'Wed', null),
      weekDay('2025-06-05', 'Thu', null),
      weekDay('2025-06-06', 'Fri', null),
    ],
    stats: { week_start: '2025-06-02', week_end: '2025-06-08', trade_count: 4, total_pnl: '1500', win_rate: '50', avg_r: '0.8' },
    isLoading: false, isFetching: false, error: null,
    goPrevWeek: vi.fn(), goNextWeek: vi.fn(), goThisWeek: vi.fn(), ...o,
  }
}

beforeEach(() => {
  mocks.useJournalV3Data.mockReset()
  mocks.useJournalQuery.mockReset()
  mocks.useCreateJournalMutation.mockReset()
  mocks.useUpdateJournalMutation.mockReset()
  mocks.useJournalQuery.mockReturnValue({ data: null, isLoading: false })
  mocks.useCreateJournalMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
  mocks.useUpdateJournalMutation.mockReturnValue({ mutate: vi.fn(), isPending: false, error: null })
})

describe('JournalV3Page', () => {
  it('renders loading', () => {
    mocks.useJournalV3Data.mockReturnValue(data({ isLoading: true }))
    render(<JournalV3Page />)
    expect(screen.getByLabelText(/Loading journal/i)).toBeInTheDocument()
  })

  it('renders weekly cards with filled + empty states', () => {
    mocks.useJournalV3Data.mockReturnValue(data())
    render(<JournalV3Page />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getAllByText('No entry').length).toBeGreaterThan(0)
  })

  it('shows editor for selected day and loads existing entry', () => {
    mocks.useJournalV3Data.mockReturnValue(data())
    mocks.useJournalQuery.mockReturnValue({ data: journal(), isLoading: false })
    render(<JournalV3Page />)
    // Editor panel header reflects an existing entry
    expect(screen.getByText(/Editing existing entry/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Watch RELIANCE breakout')).toBeInTheDocument()
  })

  it('save button disabled when not dirty', () => {
    mocks.useJournalV3Data.mockReturnValue(data())
    render(<JournalV3Page />)
    const btn = screen.getByRole('button', { name: /Save entry|Update entry/i })
    expect(btn).toBeDisabled()
  })
})
