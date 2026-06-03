import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DhanEstimatePanel } from '../components/DhanEstimatePanel'

describe('DhanEstimatePanel', () => {
  const mockUseAsDraft = vi.fn()

  beforeEach(() => {
    mockUseAsDraft.mockClear()
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
})
