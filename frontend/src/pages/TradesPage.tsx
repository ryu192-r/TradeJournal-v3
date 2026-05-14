import { GlassButton } from '@/components/ui/GlassButton'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useUpdateTradeMutation } from '@/hooks/useTradeMutation'
import { useToastStore } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { formatCurrency, formatDate } from '@/utils/format'
import type { BackendTradeStatus } from '@/types'
import { Loader2, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { useState, useCallback } from 'react'

const statusBadge: Record<string, string> = {
  draft: 'bg-accent-muted text-accent',
  reviewed: 'bg-profit-muted text-profit',
  analytics: 'bg-blue-500/15 text-blue-400',
}

export function TradesPage() {
  const addToast = useToastStore((s) => s.addToast)
  const { openCreateTrade, openEditTrade } = useAppStore()
  const [page, setPage] = useState(1)
  const [symbolFilter, setSymbolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const hasFilters = symbolFilter !== '' || statusFilter !== ''

  const clearFilters = useCallback(() => {
    setSymbolFilter('')
    setStatusFilter('')
    setPage(1)
  }, [])

  const skip = (page - 1) * 100
  const { data, isLoading, error } = useTradesQuery({
    status: statusFilter ? (statusFilter as BackendTradeStatus) : undefined,
    symbol: symbolFilter || undefined,
    skip,
    limit: 100,
  })
  const updateMutation = useUpdateTradeMutation()
  const totalPages = data ? Math.ceil(data.total / 100) : 0

  const handleDelete = async (id: number) => {
    try {
      await updateMutation.mutateAsync({
        id,
        payload: { status: 'deleted' },
      })
      addToast({ title: 'Deleted', message: `Trade #${id} marked deleted.`, variant: 'info' })
    } catch (err: unknown) {
      addToast({ title: 'Error', message: 'Failed to delete trade.', variant: 'error' })
    }
  }

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[1.65rem] font-normal tracking-[-0.03rem] leading-tight text-text-heading">
            Trades
          </h1>
          <p className="text-[.8125rem] text-text-muted mt-0.5">
            Track and manage every trade in your journal.
          </p>
        </div>
        <GlassButton variant="accent" size="sm" onClick={() => openCreateTrade()}>
          <Plus className="w-4 h-4" />
          New Trade
        </GlassButton>
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
            className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 pl-8 pr-3 py-2 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="w-full sm:w-36 rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all appearance-none cursor-pointer"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="reviewed">Reviewed</option>
          <option value="analytics">Analytics</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

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
            <p className="text-sm text-[#f87171]">Failed to load trades.</p>
            <p className="text-xs text-text-muted mt-1">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-[#131621] text-left">
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Symbol</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Dir</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Entry</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Exit</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Qty</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Setup</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">Status</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest">P&L</th>
                  <th className="px-5 py-3 text-[.6875rem] font-medium text-text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.items && data.items.length > 0 ? (
                  data.items.map((trade) => {
                    const isProfit = trade.pnl != null && Number(trade.pnl) >= 0
                    const isLong = trade.direction === 'LONG'
                    const pnlFormatted = trade.pnl != null ? formatCurrency(Number(trade.pnl)) : '—'
                    const pnlText = isProfit ? `+${pnlFormatted}` : pnlFormatted

                    return (
                      <tr
                        key={trade.id}
                        className="transition-colors hover:bg-[#1d2133]"
                      >
                        {/* Symbol */}
                        <td className="px-5 py-3 font-medium text-text-heading">
                          {trade.symbol}
                        </td>

                        {/* Direction */}
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 font-medium ${isLong ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                            {isLong
                              ? <ArrowUpRight className="w-[14px] h-[14px]" />
                              : <ArrowDownRight className="w-[14px] h-[14px]" />
                            }
                            {trade.direction}
                          </span>
                        </td>

                        {/* Entry */}
                        <td className="px-5 py-3">
                          <div className="text-text-heading text-[.8125rem]">{formatCurrency(Number(trade.entry_price))}</div>
                          <div className="text-[.6875rem] text-text-muted mt-0.5">
                            {formatDate(trade.entry_time)}
                          </div>
                        </td>

                        {/* Exit */}
                        <td className="px-5 py-3">
                          {trade.exit_price ? (
                            <>
                              <div className="text-text-heading text-[.8125rem]">{formatCurrency(Number(trade.exit_price))}</div>
                              <div className="text-[.6875rem] text-text-muted mt-0.5">
                                {trade.exit_time ? formatDate(trade.exit_time) : '—'}
                              </div>
                            </>
                          ) : (
                            <span className="text-text-muted text-[.8125rem]">Open</span>
                          )}
                        </td>

                        {/* Qty */}
                        <td className="px-5 py-3 text-text-heading text-[.8125rem]">
                          {String(trade.quantity)}
                        </td>

                        {/* Setup */}
                        <td className="px-5 py-3 text-text-muted text-[.8125rem]">
                          {trade.setup || '—'}
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[.625rem] font-medium capitalize ${statusBadge[trade.status] || 'bg-white/5 text-text-muted'}`}>
                            {trade.status}
                          </span>
                        </td>

                        {/* P&L */}
                        <td className="px-5 py-3">
                          <span
                            className={`font-data text-[.8125rem] font-medium ${
                              trade.pnl == null
                                ? 'text-text-muted'
                                : isProfit
                                  ? 'text-[#4ade80]'
                                  : 'text-[#f87171]'
                            }`}
                          >
                            {pnlText}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => openEditTrade(trade.id)}
                              className="p-1.5 rounded-md text-text-muted hover:text-accent hover:bg-accent-muted transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(trade.id)}
                              className="p-1.5 rounded-md text-text-muted hover:text-[#f87171] hover:bg-[#f87171]/10 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center text-text-muted">
                      No trades found. Click "New Trade" to add your first trade.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination controls */}
            {!isLoading && !error && data && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border px-5 pb-4">
                <span className="text-xs text-text-muted font-data">
                  {data.total === 0
                    ? '0 trades'
                    : `Showing ${data.items.length} of ${data.total} trades · Page ${page} of ${totalPages}`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-xs text-text-muted font-data px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
