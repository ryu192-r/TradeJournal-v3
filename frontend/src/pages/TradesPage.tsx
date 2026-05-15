import { GlassButton } from '@/components/ui/GlassButton'
import { BrokerImportModal } from '@/components/trades/BrokerImportModal'
import { StopHistoryTimeline } from '@/components/trades/StopHistoryTimeline'
import { ChartImageGallery } from '@/components/trades/ChartImageGallery'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useUpdateTradeMutation } from '@/hooks/useTradeMutation'
import { useToastStore } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrency, formatPrice, formatQuantity, formatDate } from '@/utils/format'
import type { BackendTradeStatus, ApiTrade } from '@/types'
import { pyramidTrade, exportTradesXlsx } from '@/lib/endpoints'
import { Loader2, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Upload, Layers, Download, CheckSquare, Square } from 'lucide-react'
import { useState, useCallback, useEffect } from 'react'

const statusBadge: Record<string, string> = {
  open: 'bg-accent-muted text-accent',
  closed: 'bg-profit-muted text-profit',
}

export function TradesPage() {
  const addToast = useToastStore((s) => s.addToast)
  const { openCreateTrade } = useAppStore()
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
      await pyramidTrade(tradeId, {
        entry_price: Number(pyramidEntryPrice),
        quantity: Number(pyramidQty),
        fees: Number(pyramidFees) || 0,
        stop_price: pyramidStopPrice ? Number(pyramidStopPrice) : undefined,
      })
      addToast({ title: 'Pyramided', message: 'Shares added to position.', variant: 'success' })
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['capital-dashboard'] })
      closePyramid()
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to pyramid trade.', variant: 'error' })
    } finally {
      setPyramidSubmitting(false)
    }
  }, [pyramidEntryPrice, pyramidQty, pyramidFees, pyramidStopPrice, addToast, queryClient, closePyramid])

  const skip = (page - 1) * 100
  const { data, isLoading, error } = useTradesQuery({
    status: statusFilter ? (statusFilter as BackendTradeStatus) : undefined,
    symbol: symbolFilter || undefined,
    skip,
    limit: 100,
  })
  const updateMutation = useUpdateTradeMutation()
  const totalPages = data ? Math.ceil(data.total / 100) : 0

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
        await updateMutation.mutateAsync({ id, payload: { status: 'deleted' } })
        success++
      } catch { /* skip failed */ }
    }
    addToast({ title: 'Deleted', message: `${success} trades deleted.`, variant: 'info' })
    setSelectedIds(new Set())
    queryClient.invalidateQueries({ queryKey: ['trades'] })
  }, [selectedIds, updateMutation, addToast, queryClient])

  const allSelected = data?.items?.length === selectedIds.size

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['trades'] })
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
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed</option>
          <option value="analytics">Analytics</option>
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
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Qty</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Setup</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">Status</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">P&amp;L</th>
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.items && data.items.length > 0 ? (
                  data.items.map((trade) => {
                    const isProfit = trade.pnl != null && Number(trade.pnl) >= 0
                    const pnlFormatted = trade.pnl != null ? formatCurrency(Number(trade.pnl)) : '—'
                    const pnlText = isProfit ? `+${pnlFormatted}` : pnlFormatted
                    return (
                      <tr key={trade.id} className={`transition-colors hover:bg-bg-card-h ${selectedIds.has(trade.id) ? 'bg-accent-faint/20' : ''}`}>
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
                        <td className="px-[var(--cell-px)] py-[var(--cell-py)] text-text-heading text-xs">{formatQuantity(trade.quantity)}</td>
                        <td className="px-[var(--cell-px)] py-[var(--cell-py)] text-text-muted text-xs">{trade.setup || '—'}</td>
                        <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge[getStatus(trade)] || 'bg-text-faint text-text-muted'}`}>
                            {getStatusLabel(trade)}
                          </span>
                        </td>
                        <td className="px-[var(--cell-px)] py-[var(--cell-py)]">
                          <span className={`font-data text-xs font-medium ${trade.pnl == null ? 'text-text-muted' : isProfit ? 'text-profit' : 'text-loss'}`}>
                            {pnlText}
                          </span>
                        </td>
                        <td className="px-[var(--cell-px)] py-[var(--cell-py)] text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            {!trade.exit_price && (
                              <button
                                onClick={() => { setPyramidingTradeId(trade.id); setPyramidEntryPrice(''); setPyramidQty('') }}
                                className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors cursor-pointer"
                                title="Pyramid"
                              >
                                <Layers className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => setDetailTrade(trade)}
                              className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors cursor-pointer"
                              title="View"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center text-text-muted">No trades found. Click "New Trade" to add your first trade.</td>
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

      {/* Pyramid modal */}
      {pyramidingTradeId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg text-text-heading">Pyramid Position</h3>
              <button onClick={closePyramid} className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-card-h transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-text-muted mb-4">Add more shares to this open position. Entry price will be averaged.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Entry Price (₹)</label>
                <input type="number" step="0.01" value={pyramidEntryPrice} onChange={(e) => setPyramidEntryPrice(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Quantity</label>
                <input type="number" step="1" value={pyramidQty} onChange={(e) => setPyramidQty(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Fees (optional)</label>
                <input type="number" step="0.01" value={pyramidFees} onChange={(e) => setPyramidFees(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Stop Price (optional)</label>
                <input type="number" step="0.01" value={pyramidStopPrice} onChange={(e) => setPyramidStopPrice(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-card/60 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={closePyramid} className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer">Cancel</button>
              <button onClick={() => handlePyramid(pyramidingTradeId)} disabled={pyramidSubmitting || !pyramidEntryPrice || !pyramidQty}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                {pyramidSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</> : <><Layers className="w-4 h-4" /> Pyramid</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade detail modal */}
      {detailTrade && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-bg-card rounded-2xl border border-border p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-lg text-text-heading">{detailTrade.symbol}</h2>
              <button onClick={() => setDetailTrade(null)} className="p-1.5 rounded-lg text-text-muted hover:text-text-heading hover:bg-bg-card-h transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Entry</div>
                  <div className="font-data text-sm font-medium text-text-heading">{formatPrice(Number(detailTrade.entry_price))}</div>
                  <div className="text-[11px] text-text-muted mt-1">{formatDate(detailTrade.entry_time)}</div>
                </div>
                <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Exit</div>
                  <div className="font-data text-sm font-medium text-text-heading">{detailTrade.exit_price ? formatPrice(Number(detailTrade.exit_price)) : '—'}</div>
                  <div className="text-[11px] text-text-muted mt-1">{detailTrade.exit_time ? formatDate(detailTrade.exit_time) : 'Open'}</div>
                </div>
                <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">Qty</div>
                  <div className="font-data text-sm font-medium text-text-heading">{formatQuantity(detailTrade.quantity)}</div>
                </div>
                <div className="rounded-xl border border-border bg-bg-elevated/30 p-3">
                  <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">P&amp;L</div>
                  <div className={`font-data text-sm font-medium ${detailTrade.pnl == null ? 'text-text-muted' : Number(detailTrade.pnl) >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {detailTrade.pnl != null ? `${Number(detailTrade.pnl) >= 0 ? '+' : ''}${formatCurrency(Number(detailTrade.pnl))}` : '—'}
                  </div>
                </div>
              </div>

              <ChartImageGallery tradeId={detailTrade.id} images={detailTrade.chart_images ?? []} />

              <div className="border-t border-border pt-4 space-y-2">
                {detailTrade.stop_price && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">Stop Loss</span><span className="text-text-heading font-medium">{formatPrice(Number(detailTrade.stop_price))}</span></div>
                )}
                {detailTrade.target_price && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">Target</span><span className="text-text-heading font-medium">{formatPrice(Number(detailTrade.target_price))}</span></div>
                )}
                {detailTrade.r_multiple && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">R-Multiple</span><span className="text-text-heading font-medium">{Number(detailTrade.r_multiple).toFixed(2)}</span></div>
                )}
                {detailTrade.fees && Number(detailTrade.fees) > 0 && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">Fees</span><span className="text-text-heading font-medium">{formatCurrency(Number(detailTrade.fees))}</span></div>
                )}
                {detailTrade.setup && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">Setup</span><span className="text-text-heading font-medium">{detailTrade.setup}</span></div>
                )}
                {detailTrade.tactic && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">Tactic</span><span className="text-text-heading font-medium">{detailTrade.tactic}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-text-muted">Status</span><span className="text-text-heading font-medium capitalize">{detailTrade.status}</span></div>
                {detailTrade.exit_reason && (
                  <div className="flex justify-between text-sm"><span className="text-text-muted">Exit Reason</span><span className="text-text-heading font-medium capitalize">{detailTrade.exit_reason.replace('_', ' ')}</span></div>
                )}
              </div>

              {detailTrade.notes && (
                <div className="border-t border-border pt-4">
                  <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Notes</div>
                  <p className="text-sm text-text-heading whitespace-pre-wrap">{detailTrade.notes}</p>
                </div>
              )}
              {detailTrade.tags && detailTrade.tags.length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="text-xs text-text-muted uppercase tracking-wide mb-2">Tags</div>
                  <div className="flex flex-wrap gap-1.5">{detailTrade.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-accent-faint text-accent">{tag}</span>
                  ))}</div>
                </div>
              )}
              <StopHistoryTimeline tradeId={detailTrade.id} />
            </div>
          </div>
        </div>
      )}

      <BrokerImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => queryClient.invalidateQueries({ queryKey: ['trades'] })} />
    </div>
    </PullToRefresh>
  )
}

function getStatus(trade: ApiTrade): string {
  if (trade.status === 'deleted') return 'deleted'
  return trade.exit_price ? 'closed' : 'open'
}

function getStatusLabel(trade: ApiTrade): string {
  if (trade.status === 'deleted') return 'Deleted'
  return trade.exit_price ? 'Closed' : 'Open'
}
