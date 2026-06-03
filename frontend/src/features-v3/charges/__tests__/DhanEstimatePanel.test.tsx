import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DhanEstimatePanel } from '../components/DhanEstimatePanel'

const mocks = vi.hoisted(() => ({
  listTrades: vi.fn(),
}))

vi.mock('@/lib/endpoints', async (importOriginal) => {
  const actual: any = await importOriginal()
  return { ...actual, listTrades: mocks.listTrades }
})

function makeTrade(overrides: Partial<import('@/types').ApiTrade> = {}): import('@/types').ApiTrade {
  return {
    id: 1,
    symbol: 'RELIANCE',
    direction: 'LONG',
    entry_price: '2500',
    exit_price: '2600',
    quantity: '10',
    entry_time: '2025-06-03T10:00:00',
    exit_time: '2025-06-03T15:00:00',
    fees: '0',
    notes: null,
    tags: null,
    setup: null,
    tactic: null,
    stop_price: null,
    target_price: null,
    r_multiple: null,
    status: 'closed',
    remaining_qty: null,
    ...overrides,
  }
}

describe('DhanEstimatePanel', () => {
  const mockUseAsDraft = vi.fn()

  beforeEach(() => {
    mockUseAsDraft.mockClear()
    mocks.listTrades.mockReset()
    mocks.listTrades.mockResolvedValue({ items: [], total: 0 })
  })

  it('renders collapsed by default with title', () => {
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    expect(screen.getByText(/Estimate with Dhan template/i)).toBeInTheDocument()
    expect(screen.getByText(/Use Dhan's published tariff/i)).toBeInTheDocument()
  })

  it('expands when clicked', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    expect(screen.getByText(/Calculate estimate/i)).toBeInTheDocument()
  })

  it('shows validation error for negative turnover', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    const buyInput = screen.getByLabelText(/Buy turnover/i)
    await user.type(buyInput, '-100')
    await user.click(screen.getByText(/Calculate estimate/i))
    expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument()
  })

  it('calculates estimate and shows breakdown', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    expect(screen.getByText(/Estimated breakdown/i)).toBeInTheDocument()
    // "Total" appears in both breakdown table and "Use estimate as draft" button
    // Match the table total row specifically
    const totalRow = screen.getAllByText(/^Total$/i).find((el) => el.tagName === 'TD')
    expect(totalRow).toBeTruthy()
  })

  it('does not auto-save when estimate is calculated', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    // "Use estimate as draft" should be present but not auto-clicked
    expect(screen.getByText(/Use estimate as draft/i)).toBeInTheDocument()
    expect(mockUseAsDraft).not.toHaveBeenCalled()
  })

  it('calls onUseAsDraft when Use estimate as draft is clicked', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    await user.click(screen.getByText(/Use estimate as draft/i))
    expect(mockUseAsDraft).toHaveBeenCalled()
  })

  it('shows estimate vs actual comparison when actual exists', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal="250"
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    expect(screen.getByText(/Estimate vs actual/i)).toBeInTheDocument()
    // "Actual" label is inside the comparison card
    const actualLabels = screen.getAllByText(/^Actual$/i)
    expect(actualLabels.length).toBeGreaterThan(0)
  })

  it('shows disclaimer after estimate', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    expect(screen.getByText(/Estimate only. Verify against contract note/i)).toBeInTheDocument()
  })

  it('shows total-only label on Use as Draft when in total_only mode', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    expect(screen.getByText(/fills total/i)).toBeInTheDocument()
  })

  it('shows breakdown label on Use as Draft when in breakdown mode', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="breakdown"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await user.type(screen.getByLabelText(/Buy turnover/i), '100000')
    await user.type(screen.getByLabelText(/Sell turnover/i), '100000')
    await user.type(screen.getByLabelText(/Executed orders/i), '2')
    await user.click(screen.getByText(/Calculate estimate/i))
    expect(screen.getByText(/fills breakdown/i)).toBeInTheDocument()
  })

  // ───────── Derive from trades tests ─────────

  it('shows derive-from-trades section with derived values when trades exist', async () => {
    mocks.listTrades.mockResolvedValue({ items: [makeTrade()], total: 1 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByTestId('derive-from-trades')).toBeInTheDocument()
    })
    expect(screen.getByText(/Derive from trades/i)).toBeInTheDocument()
    expect(screen.getByText(/25,000.00/)).toBeInTheDocument() // buy turnover
    expect(screen.getByText(/26,000.00/)).toBeInTheDocument() // sell turnover
    expect(screen.getByText(/Use derived values/i)).toBeInTheDocument()
  })

  it('fills estimator inputs when Use derived values is clicked', async () => {
    mocks.listTrades.mockResolvedValue({ items: [makeTrade()], total: 1 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByText(/Use derived values/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Use derived values/i))
    // The form inputs should be filled
    const buyInput = screen.getByLabelText(/Buy turnover/i) as HTMLInputElement
    const sellInput = screen.getByLabelText(/Sell turnover/i) as HTMLInputElement
    const orderInput = screen.getByLabelText(/Executed orders/i) as HTMLInputElement
    expect(buyInput.value).toBe('25000')
    expect(sellInput.value).toBe('26000')
    expect(orderInput.value).toBe('2')
  })

  it('does not auto-calculate after using derived values', async () => {
    mocks.listTrades.mockResolvedValue({ items: [makeTrade()], total: 1 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByText(/Use derived values/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Use derived values/i))
    // Estimate breakdown should NOT be visible yet
    expect(screen.queryByText(/Estimated breakdown/i)).not.toBeInTheDocument()
  })

  it('does not auto-save charges from derived values', async () => {
    mocks.listTrades.mockResolvedValue({ items: [makeTrade()], total: 1 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByText(/Use derived values/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Use derived values/i))
    expect(mockUseAsDraft).not.toHaveBeenCalled()
  })

  it('shows unavailable state when no eligible trades', async () => {
    mocks.listTrades.mockResolvedValue({ items: [], total: 0 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByText(/Unavailable/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/No eligible trades/i)).toBeInTheDocument()
  })

  it('shows warnings for low confidence', async () => {
    // 2 skipped + 1 valid = low confidence
    mocks.listTrades.mockResolvedValue({
      items: [
        makeTrade({ id: 1, entry_price: '' }),
        makeTrade({ id: 2, quantity: '0' }),
        makeTrade({ id: 3, entry_price: '1000', exit_price: '1100', quantity: '5' }),
      ],
      total: 3,
    })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByText(/low/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/skipped/i)).toBeInTheDocument()
  })

  it('does not show derive section when no date is provided', async () => {
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    expect(screen.queryByTestId('derive-from-trades')).not.toBeInTheDocument()
    expect(screen.queryByText(/Derive from trades/i)).not.toBeInTheDocument()
  })

  it('manual entry still works when derive is available', async () => {
    mocks.listTrades.mockResolvedValue({ items: [makeTrade()], total: 1 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByTestId('derive-from-trades')).toBeInTheDocument()
    })
    // User can still type manually
    const buyInput = screen.getByLabelText(/Buy turnover/i) as HTMLInputElement
    await user.type(buyInput, '50000')
    expect(buyInput.value).toBe('50000')
  })

  it('existing C3 Use estimate as draft still works with derivation', async () => {
    mocks.listTrades.mockResolvedValue({ items: [makeTrade()], total: 1 })
    const user = userEvent.setup()
    render(
      <DhanEstimatePanel
        actualTotal={null}
        onUseAsDraft={mockUseAsDraft}
        currentEntryMode="total_only"
        date="2025-06-03"
      />
    )
    await user.click(screen.getByText(/Estimate with Dhan template/i))
    await waitFor(() => {
      expect(screen.getByText(/Use derived values/i)).toBeInTheDocument()
    })
    // Use derived, then calculate, then use as draft
    await user.click(screen.getByText(/Use derived values/i))
    await user.click(screen.getByText(/Calculate estimate/i))
    await waitFor(() => {
      expect(screen.getByText(/Use estimate as draft/i)).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Use estimate as draft/i))
    expect(mockUseAsDraft).toHaveBeenCalled()
  })
})
