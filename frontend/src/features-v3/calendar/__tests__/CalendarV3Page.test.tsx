import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { CalendarDay } from '@/types'
import { CalendarV3Page } from '../CalendarV3Page'
import type { CalendarV3Data } from '../hooks/useCalendarV3Data'

const mocks = vi.hoisted(() => ({
  useCalendarV3Data: vi.fn(),
  setActiveView: vi.fn(),
}))

vi.mock('../hooks/useCalendarV3Data', async () => {
  const actual = await vi.importActual<typeof import('../hooks/useCalendarV3Data')>('../hooks/useCalendarV3Data')
  return { ...actual, useCalendarV3Data: mocks.useCalendarV3Data }
})
vi.mock('@/store/appStore', () => ({
  useAppStore: (sel: (s: { setActiveView: typeof mocks.setActiveView }) => unknown) =>
    sel({ setActiveView: mocks.setActiveView }),
}))

function day(o: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date: '2025-06-02', trade_count: 0, closed_count: 0, net_pnl: '0', win_rate: null,
    discipline_rating: null, discipline_score: null, journal_done: false, workflow_done: false,
    workflow_phase: null, warnings: [], trades: [], journal: null, emotions: [], realized_events: [],
    ai_summary: null, ...o,
  }
}

function data(o: Partial<CalendarV3Data> = {}): CalendarV3Data {
  return {
    month: '2025-06',
    payload: { month: '2025-06', summary: { trade_count: 0, closed_count: 0, net_pnl: '0', journal_days: 0, warning_days: 0 }, days: [] },
    isLoading: false, isFetching: false, error: null,
    goPrevMonth: vi.fn(), goNextMonth: vi.fn(), goToday: vi.fn(), refresh: vi.fn(), ...o,
  }
}

describe('CalendarV3Page', () => {
  beforeEach(() => {
    mocks.useCalendarV3Data.mockReset()
    mocks.setActiveView.mockReset()
  })

  it('renders loading', () => {
    mocks.useCalendarV3Data.mockReturnValue(data({ isLoading: true }))
    render(<CalendarV3Page />)
    expect(screen.getByLabelText(/Loading calendar/i)).toBeInTheDocument()
  })

  it('renders error with retry', () => {
    mocks.useCalendarV3Data.mockReturnValue(data({ error: new Error('boom') }))
    render(<CalendarV3Page />)
    expect(screen.getByText(/Could not load calendar/i)).toBeInTheDocument()
  })

  it('renders weekday headers and a populated day cell', () => {
    mocks.useCalendarV3Data.mockReturnValue(
      data({
        payload: {
          month: '2025-06',
          summary: { trade_count: 3, closed_count: 2, net_pnl: '1500', journal_days: 1, warning_days: 1 },
          days: [day({ date: '2025-06-02', trade_count: 3, closed_count: 2, net_pnl: '1500', journal_done: true })],
        },
      }),
    )
    render(<CalendarV3Page />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('3T')).toBeInTheDocument()
  })

  it('opens day detail drawer on cell click', async () => {
    const user = userEvent.setup()
    mocks.useCalendarV3Data.mockReturnValue(
      data({
        payload: {
          month: '2025-06',
          summary: { trade_count: 1, closed_count: 1, net_pnl: '990', journal_days: 0, warning_days: 0 },
          days: [
            day({
              date: '2025-06-02', trade_count: 1, closed_count: 1, net_pnl: '990',
              trades: [{ id: 1, symbol: 'RELIANCE', setup: 'ORB', session_date: '2025-06-02', entry_time: '2025-06-02T09:30:00', exit_time: '2025-06-02T15:00:00', entry_price: '2500', exit_price: '2600', quantity: '10', pnl: '990', chart_image_count: 0 }],
            }),
          ],
        },
      }),
    )
    render(<CalendarV3Page />)
    await user.click(screen.getByLabelText(/2025-06-02:/))
    expect(screen.getByText('RELIANCE')).toBeInTheDocument()
  })
})
