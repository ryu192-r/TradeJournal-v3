import { GlassButton } from '@/components/ui/GlassButton'
import { BrokerImportModal } from '@/components/trades/BrokerImportModal'
import { TradeDetailSwipeContent } from '@/components/trades/TradeDetailSwipeContent'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { SwipeModal } from '@/components/ui/SwipeModal'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useLiveQuotesQuery } from '@/hooks/useMarketContextQuery'
import { useToastStore } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '@/utils/format'
import type { BackendTradeStatus, ApiTrade, LiveQuote } from '@/types'
import { pyramidTrade, exportTradesXlsx, deleteTrade, getCapitalDashboard, createPartialExit } from '@/lib/endpoints'
import { Loader2, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Upload, Layers, Download, CheckSquare, Square, ArrowDownToLine } from 'lucide-react'
import { useRowGestures } from '@/hooks/useRowGestures'
import { usePartialExitsQuery } from '@/hooks/usePartialExitQuery'
import { useCreateStopHistoryMutation } from '@/hooks/useStopHistoryQuery'
import { invalidateTradeDomain, setTradeCache } from '@/lib/queryInvalidation'
import { useState, useCallback, useEffect } from 'react'

function statusBadgeClass(trade: ApiTrade): string {
  if (trade.status === 'deleted') return 'bg-text-faint text-text-muted'
  if (!trade.exit_price) return 'bg-border text-text-muted'
  return Number(trade.pnl) >= 0 ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'
}

export function TradesPage() {
  const addToast = useToastStore((s) => s.addToast)
  const { openCreateTrade, openEditTrade } = useAppStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [symbolFilter, setSymbolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailTrade, setDetailTrade] = useState<ApiTrade | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pyramidingTradeId, setPyramidingTradeId] = useState<number | null>(null)
  const [pyramidEntryPrice, setPyramidEntryPrice] = useState('')
  const [pyramidQty, setPyramidQty] = useState('')
  const [pyramidFees, setPyramidFees] = useState('0')
  const [pyramidStopPrice, setPyramidStopPrice] = useState('')
  const [pyramidSubmitting, setPyramidSubmitting] = useState(false)
  const [partialExitTradeId, setPartialExitTradeId] = useState<number | null>(null)
  const [peQty, setPeQty] = useState('')
  const [pePrice, setPePrice] = useState('')
  const [peReason, setPeReason] = useState('')
  const [peNote, setPeNote] = useState('')
  const [peSubmitting, setPeSubmitting] = useState(false)

  const hasFilters = symbolFilter !== '' || statusFilter !== ''

  const clearFilters = useCallback(() => {
    setSymbolFilter('')
    setStatusFilter('')
    setPage(1)
  }, [])

  const closePyramid = useCallback(() => {
    setPyramidingTradeId(null)
    setPyramidEntryPrice('')
    setPyramidQty('')
    setPyramidFees('0')
    setPyramidStopPrice('')
  }, [])

  const handlePyramid = useCallback(async (tradeId: number) => {
    if (!pyramidEntryPrice || !pyramidQty) return
    setPyramidSubmitting(true)
    try {
      const trade = await pyramidTrade(tradeId, {
        entry_price: Number(pyramidEntryPrice),
        quantity: Number(pyramidQty),
        fees: Number(pyramidFees) || 0,
        stop_price: pyramidStopPrice ? Number(pyramidStopPrice) : undefined,
      })
      addToast({ title: 'Pyramided', message: 'Shares added to position.', variant: 'success' })
      setTradeCache(queryClient, trade)
      invalidateTradeDomain(queryClient)
      closePyramid()
    } catch {
      addToast({ title: 'Error', message: 'Failed to pyramid trade.', variant: 'error' })
    } finally {
      setPyramidSubmitting(false)
    }
  }, [pyramidEntryPrice, pyramidQty, pyramidFees, pyramidStopPrice, addToast, queryClient, closePyramid])

  const closePartialExit = useCallback(() => {
    setPartialExitTradeId(null)
    setPeQty('')
    setPePrice('')
    setPeReason('')
    setPeNote('')
  }, [])

  const handlePartialExit = useCallback(async (tradeId: number) => {
    if (!peQty || !pePrice) return
    setPeSubmitting(true)
    try {
      await createPartialExit(tradeId, {
        qty: peQty,
        exit_price: pePrice,
        exit_time: new Date().toISOString(),
        exit_reason: peReason || null,
        note: peNote || null,
      })
      addToast({ title: 'Partial exit recorded', message: `${peQty} shares exited.`, variant: 'success' })
      invalidateTradeDomain(queryClient)
      closePartialExit()
    } catch {
      addToast({ title: 'Error', message: 'Failed to record partial exit.', variant: 'error' })
    } finally {
      setPeSubmitting(false)
    }
  }, [peQty, pePrice, peReason, peNote, addToast, queryClient, closePartialExit])

  const skip = (page - 1) * 100
  const { data, isLoading, error } = useTradesQuery({
    status: statusFilter ? (statusFilter as BackendTradeStatus) : undefined,
    symbol: symbolFilter || undefined,
    skip,
    limit: 100,
  })
  const totalPages = data ? Math.ceil(data.total / 100) : 0

  const { data: capitalData } = useQuery({
    queryKey: ['capital-dashboard'],
    queryFn: getCapitalDashboard,
    staleTime: 5 * 1000,
  })
  const netEquity = capitalData?.net_equity ?? null

  const { data: peExitsData } = usePartialExitsQuery(partialExitTradeId)
  const peMaxQty = peExitsData ? Number(peExitsData.remaining_qty) : null

  const { data: liveQuotesData } = useLiveQuotesQuery()
  const quoteMap: Map<string, LiveQuote> = new Map(
    (liveQuotesData?.quotes ?? []).map((q: LiveQuote) => [q.symbol, q])
  )

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return
    let success = 0
    for (const id of selectedIds) {
      try {
        await deleteTrade(id)
        success++
      } catch { /* skip failed */ }
    }
    addToast({ title: 'Deleted', message: `${success} trades deleted.`, variant: 'info' })
    setSelectedIds(new Set())
    invalidateTradeDomain(queryClient)
  }, [selectedIds, addToast, queryClient])

  const allSelected = data?.items?.length === selectedIds.size

  const handleRefresh = useCallback(async () => {
    await invalidateTradeDomain(queryClient)
  }, [queryClient])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openCreateTrade() }
      if (e.key === 'j' || e.key === 'J') { e.preventDefault(); setPage((p) => Math.min(totalPages || 1, p + 1)) }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openCreateTrade, totalPages])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Trades</h1>
          <p className="text-sm text-text-muted mt-0.5">Track and manage every trade in your journal.</p>
        </div>
        <div className="flex items-center gap-2">
          <GlassButton variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Import
          </GlassButton>
          <GlassButton variant="accent" size="sm" onClick={openCreateTrade}>
            <Plus className="w-4 h-4" /> New Trade
          </GlassButton>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-full sm:w-44">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint pointer-events-none" />
          <input
            type="text"
            placeholder="Search symbol..."
            value={symbolFilter}
            onChange={(e) => { setSymbolFilter(e.target.value); setPage(1) }}
            className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 pl-8 pr-3 py-2 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="w-full sm:w-36 rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all appearance-none cursor-pointer"
        >
          <option value="">All positions</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
        <button
          onClick={() => exportTradesXlsx()}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer"
          title="Export to Excel"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-muted border border-accent/20">
          <span className="text-sm text-text-heading font-medium">{selectedIds.size} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-text-muted hover:text-text-heading px-2 py-1 cursor-pointer"
          >
            Deselect all
          </button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-loss hover:bg-loss-muted/20 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {isLoading && (
          <div className="py-16 text-center">
            <Loader2 className="w-5 h-5 text-accent animate-spin mx-auto mb-2.5" />
            <p className="text-sm text-text-muted">Loading trades…</p>
          </div>
        )}
        {error && (
          <div className="py-16 text-center">
            <p className="text-sm text-loss">Failed to load trades.</p>
            <p className="text-xs text-text-muted mt-1">{error.message}</p>
          </div>
        )}
        {!isLoading && !error && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-bg-low text-left">
                  <th className="px-3 py-3 w-10">
                    {data?.items && data.items.length > 0 && (
                      <button
                        onClick={() => {
                          if (allSelected) setSelectedIds(new Set())
                          else setSelectedIds(new Set(data!.items.map(t => t.id)))
                        }}
                        className="text-text-muted hover:text-text-heading cursor-pointer"
                      >
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                  </th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Symbol</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Entry</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Exit</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">LTP</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">SL</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Max Risk</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Qty</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Rem.</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Setup</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Status</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Realized</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Unrealized</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Cap%</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.items && data.items.length > 0 ? (
                  data.items.map((trade) => (
                      <TradeRow
                         key={trade.id}
                         trade={trade}
                         selectedIds={selectedIds}
                         toggleSelect={toggleSelect}
                         openEditTrade={openEditTrade}
                         setDetailTrade={setDetailTrade}
                         setPyramidingTradeId={setPyramidingTradeId}
                         setPartialExitTradeId={setPartialExitTradeId}
                         netEquity={netEquity}
                         quoteMap={quoteMap}
                       />
                  ))
                ) : (
                  <tr>
                    <td colSpan={15} className="px-5 py-16 text-center text-text-muted">No trades found. Click "New Trade" to add your first trade.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Pagination */}
            {!isLoading && !error && data && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border px-3 sm:px-5 pb-4">
                <span className="text-xs text-text-muted font-data">
                  {data.total === 0 ? '0 trades' : `${data.items.length} of ${data.total} trades · Page ${page} of ${totalPages}`}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    <ChevronLeft className="w-3.5 h-3.5" /> Previous
                  </button>
                  <span className="text-xs text-text-muted font-data px-2">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pyramid bottom sheet */}
      <BottomSheet open={pyramidingTradeId !== null} onClose={closePyramid} title="Pyramid Position">
        <p className="text-sm text-text-muted mb-4">Add more shares to this open position. Entry price will be averaged.</p>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Entry Price (₹)</label>
            <input type="number" step="0.01" value={pyramidEntryPrice} onChange={(e) => setPyramidEntryPrice(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Quantity</label>
            <input type="number" step="1" value={pyramidQty} onChange={(e) => setPyramidQty(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Fees (optional)</label>
            <input type="number" step="0.01" value={pyramidFees} onChange={(e) => setPyramidFees(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Stop Price (optional)</label>
            <input type="number" step="0.01" value={pyramidStopPrice} onChange={(e) => setPyramidStopPrice(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={closePyramid} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => handlePyramid(pyramidingTradeId!)} disabled={pyramidSubmitting || !pyramidEntryPrice || !pyramidQty}
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
            {pyramidSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Layers className="w-4 h-4" /> Pyramid</>}
          </button>
        </div>
      </BottomSheet>

      {/* Partial exit bottom sheet */}
      <BottomSheet open={partialExitTradeId !== null} onClose={closePartialExit} title="Partial Exit">
        <p className="text-sm text-text-muted mb-4">Sell a portion of your open position.</p>
        <div className="space-y-3 mb-5">
          {peMaxQty != null && (
            <div className="flex items-center justify-between text-xs font-data">
              <span className="text-text-muted">Remaining shares</span>
              <span className={peMaxQty > 0 ? 'text-profit' : 'text-loss'}>{peMaxQty}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Qty</label>
            <input type="number" step="1" value={peQty} onChange={(e) => setPeQty(e.target.value)} max={peMaxQty ?? undefined}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder={peMaxQty != null ? `max ${peMaxQty}` : '0'} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Exit Price (₹)</label>
            <input type="number" step="0.01" value={pePrice} onChange={(e) => setPePrice(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Reason</label>
            <select value={peReason} onChange={(e) => setPeReason(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all appearance-none cursor-pointer">
              <option value="">Select reason...</option>
              {['target_hit', 'stop_hit', 'trailing_stop', 'manual_rules', 'gut_feeling', 'risk_management', 'partial_profit', 'time_based'].map(r => (
                <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1">Note (optional)</label>
            <textarea value={peNote} onChange={(e) => setPeNote(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all resize-none" placeholder="Optional note..." />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={closePartialExit} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer">Cancel</button>
          <button onClick={() => handlePartialExit(partialExitTradeId!)} disabled={peSubmitting || !peQty || !pePrice || (peMaxQty != null && Number(peQty) > peMaxQty)}
            className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
            {peSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><ArrowDownToLine className="w-4 h-4" /> Record Exit</>}
          </button>
        </div>
      </BottomSheet>

      {/* Trade detail modal */}
      {detailTrade && (
        <SwipeModal open={true} onClose={() => setDetailTrade(null)}>
          <TradeDetailSwipeContent
            trade={detailTrade}
            trades={data?.items ?? []}
            onSelect={setDetailTrade}
            onClose={() => setDetailTrade(null)}
          />
        </SwipeModal>
      )}

      <BrokerImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => invalidateTradeDomain(queryClient)} />
    </div>
    </PullToRefresh>
  )
}

function getStatusLabel(trade: ApiTrade): string {
  if (trade.status === 'deleted') return 'Deleted'
  return trade.exit_price ? 'Closed' : 'Open'
}
// ── TradeRow component ──

interface TradeRowProps {
  trade: ApiTrade
  selectedIds: Set<number>
  toggleSelect: (id: number) => void
  openEditTrade: (id: number) => void
  setDetailTrade: (t: ApiTrade) => void
  setPyramidingTradeId: (id: number | null) => void
  setPartialExitTradeId: (id: number | null) => void
  netEquity: string | null
  quoteMap: Map<string, LiveQuote>
}

const STOP_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'trailing', label: 'Trailing' },
  { value: 'breakeven', label: 'Breakeven' },
]

function TradeRow({ trade, selectedIds, toggleSelect, openEditTrade, setDetailTrade, setPyramidingTradeId, setPartialExitTradeId, netEquity, quoteMap }: TradeRowProps) {
  const entryCost = Number(trade.entry_price) * Number(trade.quantity)
  const pnlNum = trade.pnl != null ? Number(trade.pnl) : 0
  const capPct = netEquity && Number(netEquity) > 0 ? ((pnlNum / Number(netEquity)) * 100) : null
  const quote = quoteMap.get(trade.symbol)
  const ltp = quote?.ltp ? parseFloat(quote.ltp) : null
  const ltpChg = quote?.change_pct ? parseFloat(quote.change_pct) : null
  const isOpen = !trade.exit_price
  const remainingQty = trade.remaining_qty ? Number(trade.remaining_qty) : Number(trade.quantity)
  const partialRealized = trade.partial_realized_pnl ? Number(trade.partial_realized_pnl) : null
  const hasPartials = partialRealized != null
  const realizedPnl = hasPartials ? partialRealized : (trade.exit_price ? pnlNum : null)
  const livePnl = isOpen && ltp != null ? (ltp - Number(trade.entry_price)) * remainingQty - Number(trade.fees) * (remainingQty / Number(trade.quantity)) : null
  const livePnlPct = isOpen && entryCost > 0 && livePnl != null ? (livePnl / entryCost) * 100 : null
  const [slEditing, setSlEditing] = useState(false)
  const [slPrice, setSlPrice] = useState(trade.stop_price ?? '')
  const [slType, setSlType] = useState('trailing')
  const createStopHistory = useCreateStopHistoryMutation()

  const slRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.focus()
  }, [])

  const handleSlSave = useCallback(async () => {
    if (!slPrice) return
    try {
      await createStopHistory.mutateAsync({
        tradeId: trade.id,
        payload: {
          stop_type: slType,
          price: slPrice,
          timestamp: new Date().toISOString(),
        },
      })
      setSlEditing(false)
    } catch {
      /* toast handled by hook */
    }
  }, [slPrice, slType, trade.id, createStopHistory])

  const swipeGw = useRowGestures({
    disabled: false,
    onDoubleTap: () => openEditTrade(trade.id),
    onLongPress: () => {
      navigator.clipboard?.writeText(trade.pnl ?? '').then(() => {
        const addToast = useToastStore.getState().addToast
        addToast({ title: 'Copied', message: 'P&L copied to clipboard.', variant: 'info' })
      })
    },
  })

  return (
    <tr className={`transition-colors hover:bg-bg-card-h ${selectedIds.has(trade.id) ? 'bg-accent-faint/20' : ''}`} {...swipeGw.handlers}>
      <td className="px-3 py-3">
        <button
          onClick={() => toggleSelect(trade.id)}
          className={`transition-colors cursor-pointer ${selectedIds.has(trade.id) ? 'text-accent' : 'text-text-muted hover:text-text-heading'}`}
        >
          {selectedIds.has(trade.id) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        <button
          onClick={() => setDetailTrade(trade)}
          className="font-medium text-text-heading hover:text-accent transition-colors cursor-pointer"
        >
          {trade.symbol}
        </button>
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        <div className="text-text-heading text-xs">{formatPrice(Number(trade.entry_price))}</div>
        <div className="text-[10px] text-text-muted mt-0.5">{formatDate(trade.entry_time)}</div>
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        {trade.exit_price ? (
          <>
            <div className="text-text-heading text-xs">{formatPrice(Number(trade.exit_price))}</div>
            <div className="text-[10px] text-text-muted mt-0.5">{trade.exit_time ? formatDate(trade.exit_time) : '—'}</div>
          </>
        ) : (
          <span className="text-text-muted text-xs">Open</span>
        )}
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        {ltp != null ? (
          <div>
            <div className="text-text-heading text-xs font-data">{formatPrice(ltp)}</div>
            {ltpChg != null && (
              <div className={`text-[10px] font-data ${(ltpChg >= 0) ? 'text-profit' : 'text-loss'}`}>
                {ltpChg >= 0 ? '+' : ''}{ltpChg.toFixed(2)}%
              </div>
            )}
          </div>
        ) : (
          <span className="text-text-faint text-xs">—</span>
        )}
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        {slEditing ? (
          <div className="flex items-center gap-1 min-w-[140px]">
            <input
              ref={slRef}
              type="number"
              step="0.01"
              value={slPrice}
              onChange={(e) => setSlPrice(e.target.value)}
              className="w-20 px-1.5 py-1 rounded text-[10px] bg-bg-card border border-border text-text-heading"
              placeholder="Price"
            />
            <select
              value={slType}
              onChange={(e) => setSlType(e.target.value)}
              className="w-16 px-1 py-1 rounded text-[10px] bg-bg-card border border-border text-text-heading"
            >
              {STOP_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              onClick={handleSlSave}
              disabled={!slPrice || createStopHistory.isPending}
              className="px-1.5 py-1 rounded text-[10px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
            >
              {createStopHistory.isPending ? '…' : 'Set'}
            </button>
            <button
              onClick={() => setSlEditing(false)}
              className="px-1 py-1 rounded text-[10px] text-text-muted hover:text-text-heading transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setSlPrice(trade.stop_price ?? ''); setSlEditing(true) }}
            className={`font-data text-xs transition-colors cursor-pointer ${trade.stop_price ? 'text-text-heading hover:text-accent' : 'text-text-faint hover:text-text-muted'}`}
            title="Click to set trailing stop"
          >
            {trade.stop_price ? formatPrice(Number(trade.stop_price)) : '—'}
          </button>
        )}
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        {trade.stop_price ? (() => {
          const risk = (Number(trade.entry_price) - Number(trade.stop_price)) * remainingQty
          return (
            <span className={`font-data text-xs ${risk < 0 ? 'text-profit' : risk > 0 ? 'text-loss' : 'text-text-muted'}`}>
              {risk < 0 ? '-' : ''}{formatCurrency(Math.abs(risk))}
            </span>
          )
        })() : (
          <span className="text-text-faint text-xs">—</span>
        )}
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)] text-text-heading text-xs">{formatQuantity(trade.quantity)}</td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        <span className={`font-data text-xs ${remainingQty < Number(trade.quantity) ? 'text-accent' : 'text-text-heading'}`}>
          {formatQuantity(String(remainingQty))}
        </span>
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)] text-text-muted text-xs">{trade.setup || '—'}</td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadgeClass(trade)}`}>
          {getStatusLabel(trade)}
        </span>
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        {realizedPnl != null ? (
          <span className={`font-data text-xs font-medium ${realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl)}
          </span>
        ) : (
          <span className="text-text-muted text-xs">—</span>
        )}
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        {isOpen ? (
          livePnl != null ? (
            <div>
              <span className={`font-data text-xs font-medium ${livePnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {livePnl >= 0 ? '+' : ''}{formatCurrency(livePnl)}
              </span>
              {livePnlPct != null && (
                <div className={`text-[10px] font-data ${livePnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(2)}%
                </div>
              )}
            </div>
          ) : (
            <span className="text-text-faint text-xs">—</span>
          )
        ) : (
          <span className="text-text-faint text-xs">—</span>
        )}
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
        <span className={`font-data text-xs ${capPct == null ? 'text-text-faint' : pnlNum >= 0 ? 'text-profit' : 'text-loss'}`}>
          {capPct != null ? `${pnlNum >= 0 ? '+' : ''}${capPct.toFixed(2)}%` : '—'}
        </span>
      </td>
      <td className="px-[var(--cell-px)] py-[var(--cell-py)] text-right">
        <div className="flex items-center justify-end gap-0.5">
          {!trade.exit_price && (
            <>
              <button
                onClick={() => { setPartialExitTradeId(trade.id) }}
                className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors cursor-pointer"
                title="Partial Exit"
              >
                <ArrowDownToLine className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setPyramidingTradeId(trade.id) }}
                className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors cursor-pointer"
                title="Pyramid"
              >
                <Layers className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => openEditTrade(trade.id)}
            className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors cursor-pointer"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}
