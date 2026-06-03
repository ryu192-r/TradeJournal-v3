import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { ImportV3Page } from '../ImportV3Page'

const mocks = vi.hoisted(() => ({
  getBrokers: vi.fn(),
  getBrokerTemplate: vi.fn(),
  importBrokerCsv: vi.fn(),
  previewBrokerImport: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('@/lib/endpoints', () => ({
  getBrokers: mocks.getBrokers,
  getBrokerTemplate: mocks.getBrokerTemplate,
  importBrokerCsv: mocks.importBrokerCsv,
  previewBrokerImport: mocks.previewBrokerImport,
}))
vi.mock('@/store/toastStore', () => ({
  useToastStore: (sel: (s: { addToast: typeof mocks.addToast }) => unknown) =>
    sel({ addToast: mocks.addToast }),
}))

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  mocks.getBrokers.mockReset()
  mocks.getBrokerTemplate.mockReset()
  mocks.importBrokerCsv.mockReset()
  mocks.previewBrokerImport.mockReset()
  mocks.addToast.mockReset()
})

describe('ImportV3Page', () => {
  it('renders header and instructions panel', async () => {
    mocks.getBrokers.mockResolvedValue({ brokers: [] })
    render(wrap(<ImportV3Page />))
    expect(await screen.findByText('Import')).toBeInTheDocument()
    expect(
      screen.getByText(/Bring broker trades into your journal/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Gross only/i)).toBeInTheDocument()
    expect(screen.getByText(/Charges Ledger/i)).toBeInTheDocument()
  })

  it('renders supported brokers from backend response', async () => {
    mocks.getBrokers.mockResolvedValue({
      brokers: [
        { id: 'zerodha', name: 'Zerodha (Kite)' },
        { id: 'dhan', name: 'Dhan' },
        { id: 'generic', name: 'Generic CSV' },
      ],
    })
    render(wrap(<ImportV3Page />))
    expect(await screen.findByText('Zerodha (Kite)')).toBeInTheDocument()
    expect(screen.getByText('Dhan')).toBeInTheDocument()
    expect(screen.getByText('Generic CSV')).toBeInTheDocument()
    // Metadata badge: zerodha + dhan should be marked as auto-mapping.
    expect(screen.getAllByText(/Auto market metadata/i).length).toBe(2)
    expect(screen.getByText(/No metadata mapping/i)).toBeInTheDocument()
  })

  it('shows empty state when backend returns no sources (no fake)', async () => {
    mocks.getBrokers.mockResolvedValue({ brokers: [] })
    render(wrap(<ImportV3Page />))
    expect(await screen.findByText(/No sources available/i)).toBeInTheDocument()
  })

  it('shows "No import run yet" empty state by default', async () => {
    mocks.getBrokers.mockResolvedValue({ brokers: [] })
    render(wrap(<ImportV3Page />))
    expect(await screen.findByText(/No import run yet/i)).toBeInTheDocument()
  })

  it('renders legacy fallback button', async () => {
    mocks.getBrokers.mockResolvedValue({ brokers: [] })
    render(wrap(<ImportV3Page />))
    expect(await screen.findByText(/Open legacy import/i)).toBeInTheDocument()
  })

  it('opens broker import modal when Start import clicked', async () => {
    mocks.getBrokers.mockResolvedValue({
      brokers: [{ id: 'zerodha', name: 'Zerodha (Kite)' }],
    })
    const user = userEvent.setup()
    render(wrap(<ImportV3Page />))
    await user.click(await screen.findByText('Start import'))
    // Modal should mount with its dialog role.
    expect(await screen.findByRole('dialog', { name: /broker import/i })).toBeInTheDocument()
  })

  it('does not show NaN/undefined/null in default state', async () => {
    mocks.getBrokers.mockResolvedValue({ brokers: [] })
    render(wrap(<ImportV3Page />))
    await screen.findByText('Import')
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.queryByText(/^undefined$/)).toBeNull()
    expect(screen.queryByText(/^null$/)).toBeNull()
    expect(screen.queryByText(/object Object/)).toBeNull()
  })
})
