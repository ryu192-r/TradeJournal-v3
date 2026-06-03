import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  Button,
  Card,
  Chip,
  Drawer,
  EmptyState,
  ErrorState,
  MetricCard,
  MoneyValue,
  Panel,
  PercentValue,
  RMultipleValue,
} from '@/new-ui'

describe('new-ui foundation', () => {
  it('renders Button children', () => {
    render(<Button>Execute</Button>)
    expect(screen.getByRole('button', { name: 'Execute' })).toBeInTheDocument()
  })

  it('supports Button disabled state', () => {
    render(<Button disabled>Blocked</Button>)
    expect(screen.getByRole('button', { name: 'Blocked' })).toBeDisabled()
  })

  it('renders Card children', () => {
    render(<Card>Card body</Card>)
    expect(screen.getByText('Card body')).toBeInTheDocument()
  })

  it('renders Panel title, description, and children', () => {
    render(
      <Panel title="Risk Panel" description="Position exposure">
        Panel body
      </Panel>,
    )

    expect(screen.getByText('Risk Panel')).toBeInTheDocument()
    expect(screen.getByText('Position exposure')).toBeInTheDocument()
    expect(screen.getByText('Panel body')).toBeInTheDocument()
  })

  it('renders Chip text for variants', () => {
    render(<Chip variant="profit">Profitable</Chip>)
    expect(screen.getByText('Profitable')).toBeInTheDocument()
  })

  it('renders positive INR MoneyValue', () => {
    render(<MoneyValue value={1234} />)
    expect(screen.getByText('₹1,234')).toBeInTheDocument()
  })

  it('renders negative INR MoneyValue', () => {
    render(<MoneyValue value={-1234} />)
    expect(screen.getByText('-₹1,234')).toBeInTheDocument()
  })

  it('renders zero MoneyValue safely', () => {
    render(<MoneyValue value={0} />)
    expect(screen.getByText('₹0')).toBeInTheDocument()
  })

  it('renders MoneyValue fallback for null', () => {
    render(<MoneyValue value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders MoneyValue fallback for NaN', () => {
    render(<MoneyValue value={Number.NaN} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders PercentValue fallback for null and NaN', () => {
    render(
      <div>
        <PercentValue value={null} />
        <PercentValue value={Number.NaN} />
      </div>,
    )
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders RMultipleValue fallback for null and NaN', () => {
    render(
      <div>
        <RMultipleValue value={null} />
        <RMultipleValue value={Number.NaN} />
      </div>,
    )
    expect(screen.getAllByText('—')).toHaveLength(2)
  })

  it('renders EmptyState title and description', () => {
    render(<EmptyState title="No trades reviewed" description="Review queue is clear." />)
    expect(screen.getByText('No trades reviewed')).toBeInTheDocument()
    expect(screen.getByText('Review queue is clear.')).toBeInTheDocument()
  })

  it('renders ErrorState title and description', () => {
    render(<ErrorState title="Sync failed" description="Try again after market data refresh." />)
    expect(screen.getByText('Sync failed')).toBeInTheDocument()
    expect(screen.getByText('Try again after market data refresh.')).toBeInTheDocument()
  })

  it('renders Drawer children when open', () => {
    render(
      <Drawer open onClose={vi.fn()} title="Trade drawer">
        Drawer body
      </Drawer>,
    )
    expect(screen.getByRole('dialog', { name: 'Trade drawer' })).toBeInTheDocument()
    expect(screen.getByText('Drawer body')).toBeInTheDocument()
  })

  it('does not render Drawer content when closed', () => {
    render(
      <Drawer open={false} onClose={vi.fn()} title="Hidden drawer">
        Hidden body
      </Drawer>,
    )
    expect(screen.queryByText('Hidden body')).not.toBeInTheDocument()
  })

  it('renders MetricCard label, value, and description', () => {
    render(<MetricCard label="Net P&L" value="₹12,500" description="After charges" />)
    expect(screen.getByText('Net P&L')).toBeInTheDocument()
    expect(screen.getByText('₹12,500')).toBeInTheDocument()
    expect(screen.getByText('After charges')).toBeInTheDocument()
  })
})
