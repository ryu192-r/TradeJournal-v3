import { GlassButton } from '@/components/ui/GlassButton'
import { BrokerImportModal } from '@/components/trades/BrokerImportModal'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useTradesQuery } from '@/hooks/useTradesQuery'
import { useLiveQuotesQuery, useSyncLiveQuotesMutation } from '@/hooks/useMarketContextQuery'
import { useToastStore } from '@/store/toastStore'
import { useAppStore } from '@/store/appStore'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { formatCurrency, formatPrice, formatQuantity, formatDateTime } from '@/utils/format'
import { nowIST } from '@/schemas/tradeForm'
import { getLiveQuoteDisplayClass, getLiveQuoteDisplayStatus } from '@/utils/liveQuotes'
import { computeLivePnl, computeLivePnlPct, computeMaxRisk, computeCapPct } from '@/utils/calculations'
import type { BackendTradeStatus, ApiTrade, LiveQuote } from '@/types'
import { pyramidTrade, deleteTrade, getCapitalDashboard, createPartialExit, updateTrade } from '@/lib/endpoints'
import { Loader2, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Search, X, Upload, Layers, Download, CheckSquare, Square, ArrowDownToLine, RefreshCw, SlidersHorizontal, Save, Columns3, LayoutGrid, LayoutList } from 'lucide-react'
import { useRowGestures } from '@/hooks/useRowGestures'
import { usePartialExitsQuery } from '@/hooks/usePartialExitQuery'
import { useCreateStopHistoryMutation } from '@/hooks/useStopHistoryQuery'
import { invalidateTradeList, invalidateRisk, invalidateAnalytics, invalidatePlaybook, invalidateTradeDetail, invalidateLifecycle, setTradeCache, patchTradeInLists, removeTradeFromLists } from '@/lib/queryInvalidation'
import { useState, useCallback, useEffect, useMemo } from 'react'

type ListingMode = 'auto' | 'table' | 'cards'

function statusBadgeClass(trade: ApiTrade): string {
  if (trade.status === 'deleted') return 'bg-text-faint text-text-muted'
  if (!trade.exit_price) return 'bg-border text-text-muted'
  return Number(trade.pnl) >= 0 ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'
}

type TradeColumnId =
  | 'symbol'
  | 'entry'
  | 'exit'
  | 'ltp'
  | 'sl'
  | 'maxRisk'
  | 'quantity'
  | 'remaining'
  | 'setup'
  | 'status'
  | 'realized'
  | 'unrealized'
  | 'capPct'

type TableDensity = 'compact' | 'comfortable'

interface ResearchFilters {
  fromDate: string
  toDate: string
  setup: string
  tactic: string
  tags: string
  exitReason: string
  pnlMin: string
  pnlMax: string
  rMin: string
  rMax: string
  hasScreenshot: boolean
  hasJournalNote: boolean
  hasStop: boolean
  hasPartialExit: boolean
  noStop: boolean
  unreviewed: boolean
}

interface SavedTradeView {
  id: string
  name: string
  symbolFilter: string
  statusFilter: string
  researchFilters: ResearchFilters
}

const RESEARCH_FILTER_DEFAULTS: ResearchFilters = {
  fromDate: '',
  toDate: '',
  setup: '',
  tactic: '',
  tags: '',
  exitReason: '',
  pnlMin: '',
  pnlMax: '',
  rMin: '',
  rMax: '',
  hasScreenshot: false,
  hasJournalNote: false,
  hasStop: false,
  hasPartialExit: false,
  noStop: false,
  unreviewed: false,
}

const COLUMN_LABELS: Record<TradeColumnId, string> = {
  symbol: 'Symbol',
  entry: 'Entry',
  exit: 'Exit',
  ltp: 'LTP',
  sl: 'SL',
  maxRisk: 'Max Risk',
  quantity: 'Qty',
  remaining: 'Rem.',
  setup: 'Setup',
  status: 'Status',
  realized: 'Realized',
  unrealized: 'Unrealized',
  capPct: 'Cap%',
}

const DEFAULT_COLUMN_ORDER: TradeColumnId[] = ['symbol', 'entry', 'exit', 'ltp', 'sl', 'maxRisk', 'quantity', 'remaining', 'setup', 'status', 'realized', 'unrealized', 'capPct']
const DEFAULT_VISIBLE_COLUMNS = new Set<TradeColumnId>(DEFAULT_COLUMN_ORDER)
const TRADE_TABLE_PREFS_KEY = 'tjv3-trade-table-prefs-v1'
const SAVED_VIEWS_KEY = 'tjv3-trade-saved-views-v1'

const BUILT_IN_VIEWS: SavedTradeView[] = [
  { id: 'open', name: 'Open Positions', symbolFilter: '', statusFilter: 'open', researchFilters: { ...RESEARCH_FILTER_DEFAULTS } },
  { id: 'losses', name: 'Losses to Review', symbolFilter: '', statusFilter: 'closed', researchFilters: { ...RESEARCH_FILTER_DEFAULTS, pnlMax: '-0.01', unreviewed: true } },
  { id: 'no-stop', name: 'No Stop', symbolFilter: '', statusFilter: 'open', researchFilters: { ...RESEARCH_FILTER_DEFAULTS, noStop: true } },
  { id: 'partial-exits', name: 'Partial Exits', symbolFilter: '', statusFilter: '', researchFilters: { ...RESEARCH_FILTER_DEFAULTS, hasPartialExit: true } },
  { id: 'this-month', name: 'This Month', symbolFilter: '', statusFilter: '', researchFilters: { ...RESEARCH_FILTER_DEFAULTS, fromDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10) } },
  { id: 'unreviewed', name: 'Unreviewed Trades', symbolFilter: '', statusFilter: '', researchFilters: { ...RESEARCH_FILTER_DEFAULTS, unreviewed: true } },
]

function loadTablePrefs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRADE_TABLE_PREFS_KEY) ?? '{}')
    return {
      density: parsed.density === 'compact' ? 'compact' as TableDensity : 'comfortable' as TableDensity,
      visibleColumns: new Set<TradeColumnId>(
        Array.isArray(parsed.visibleColumns)
          ? parsed.visibleColumns.filter((id: string): id is TradeColumnId => id in COLUMN_LABELS)
          : DEFAULT_COLUMN_ORDER
      ),
      columnOrder: Array.isArray(parsed.columnOrder)
        ? [...parsed.columnOrder.filter((id: string): id is TradeColumnId => id in COLUMN_LABELS), ...DEFAULT_COLUMN_ORDER.filter((id) => !parsed.columnOrder.includes(id))]
        : DEFAULT_COLUMN_ORDER,
    }
  } catch {
    return { density: 'comfortable' as TableDensity, visibleColumns: DEFAULT_VISIBLE_COLUMNS, columnOrder: DEFAULT_COLUMN_ORDER }
  }
}

function loadSavedViews(): SavedTradeView[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_VIEWS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function tradeDate(trade: ApiTrade) {
  return trade.entry_time ? trade.entry_time.slice(0, 10) : ''
}

function matchesResearchFilters(trade: ApiTrade, filters: ResearchFilters) {
  const pnl = Number(trade.pnl ?? 0)
  const r = Number(trade.r_multiple ?? 0)
  const tags = (trade.tags ?? []).join(' ').toLowerCase()
  const date = tradeDate(trade)
  if (filters.fromDate && date < filters.fromDate) return false
  if (filters.toDate && date > filters.toDate) return false
  if (filters.setup && !(trade.setup ?? '').toLowerCase().includes(filters.setup.toLowerCase())) return false
  if (filters.tactic && !(trade.tactic ?? '').toLowerCase().includes(filters.tactic.toLowerCase())) return false
  if (filters.tags && !tags.includes(filters.tags.toLowerCase())) return false
  if (filters.exitReason && trade.exit_reason !== filters.exitReason) return false
  if (filters.pnlMin && pnl < Number(filters.pnlMin)) return false
  if (filters.pnlMax && pnl > Number(filters.pnlMax)) return false
  if (filters.rMin && r < Number(filters.rMin)) return false
  if (filters.rMax && r > Number(filters.rMax)) return false
  if (filters.hasScreenshot && !(trade.chart_images?.length)) return false
  if (filters.hasJournalNote && !trade.notes && !trade.review_notes) return false
  if (filters.hasStop && !trade.stop_price) return false
  if (filters.noStop && trade.stop_price) return false
  if (filters.hasPartialExit && !trade.partial_realized_pnl) return false
  if (filters.unreviewed && (trade.review_notes || (trade.review_tags?.length ?? 0) > 0)) return false
  return true
}

function downloadFilteredTradesCsv(trades: ApiTrade[], columns: TradeColumnId[]) {
  const rows = [
    columns.map((column) => COLUMN_LABELS[column]),
    ...trades.map((trade) => columns.map((column) => {
      if (column === 'symbol') return trade.symbol
      if (column === 'entry') return `${trade.entry_price} ${trade.entry_time}`
      if (column === 'exit') return `${trade.exit_price ?? ''} ${trade.exit_time ?? ''}`
      if (column === 'ltp') return ''
      if (column === 'sl') return trade.stop_price ?? ''
      if (column === 'maxRisk') return trade.stop_price ? String((Number(trade.entry_price) - Number(trade.stop_price)) * Number(trade.remaining_qty ?? trade.quantity)) : ''
      if (column === 'quantity') return trade.quantity
      if (column === 'remaining') return trade.remaining_qty ?? trade.quantity
      if (column === 'setup') return trade.setup ?? ''
      if (column === 'status') return getStatusLabel(trade)
      if (column === 'realized') return trade.partial_realized_pnl ?? trade.pnl ?? ''
      if (column === 'unrealized') return trade.unrealized_pnl ?? ''
      if (column === 'capPct') return ''
      return ''
    })),
  ]
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `trades-filtered-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function TradesPage() {
  const addToast = useToastStore((s) => s.addToast)
  const { openCreateTrade, openEditTrade, openDetailTrade } = useAppStore()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [symbolFilter, setSymbolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [researchFilters, setResearchFilters] = useState<ResearchFilters>(RESEARCH_FILTER_DEFAULTS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [tableConfigOpen, setTableConfigOpen] = useState(false)
  const [saveViewName, setSaveViewName] = useState('')
  const [savedViews, setSavedViews] = useState<SavedTradeView[]>(loadSavedViews)
  const [density, setDensity] = useState<TableDensity>(() => loadTablePrefs().density)
  const [visibleColumns, setVisibleColumns] = useState<Set<TradeColumnId>>(() => loadTablePrefs().visibleColumns)
  const [columnOrder, setColumnOrder] = useState<TradeColumnId[]>(() => loadTablePrefs().columnOrder)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pyramidingTradeId, setPyramidingTradeId] = useState<number | null>(null)
  const [pyramidEntryPrice, setPyramidEntryPrice] = useState('')
  const [pyramidQty, setPyramidQty] = useState('')
  const [pyramidFees, setPyramidFees] = useState('0')
  const [pyramidStopPrice, setPyramidStopPrice] = useState('')
  const [pyramidDate, setPyramidDate] = useState('')
  const [pyramidSubmitting, setPyramidSubmitting] = useState(false)
  const [sellTradeId, setSellTradeId] = useState<number | null>(null)
  const [sellQty, setSellQty] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [sellReason, setSellReason] = useState('')
  const [sellFees, setSellFees] = useState('')
  const [sellNote, setSellNote] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [sellSubmitting, setSellSubmitting] = useState(false)
  const [listingMode, setListingMode] = useState<ListingMode>('auto')

  const advancedFilterCount = Object.entries(researchFilters).filter(([, value]) => value !== '' && value !== false).length
  const hasFilters = symbolFilter !== '' || statusFilter !== '' || advancedFilterCount > 0

  const clearFilters = useCallback(() => {
    setSymbolFilter('')
    setStatusFilter('')
    setResearchFilters(RESEARCH_FILTER_DEFAULTS)
    setPage(1)
  }, [])

  const closePyramid = useCallback(() => {
    setPyramidingTradeId(null)
    setPyramidEntryPrice('')
    setPyramidQty('')
    setPyramidFees('0')
    setPyramidStopPrice('')
    setPyramidDate('')
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
        entry_time: pyramidDate ? pyramidDate + ':00' : undefined,
      })
      addToast({ title: 'Pyramided', message: 'Shares added to position.', variant: 'success' })
      setTradeCache(queryClient, trade)
      patchTradeInLists(queryClient, trade)
      void invalidateRisk(queryClient)
      void invalidateAnalytics(queryClient)
      void invalidatePlaybook(queryClient)
      void invalidateTradeList(queryClient)
      closePyramid()
    } catch {
      addToast({ title: 'Error', message: 'Failed to pyramid trade.', variant: 'error' })
    } finally {
      setPyramidSubmitting(false)
    }
  }, [pyramidEntryPrice, pyramidQty, pyramidFees, pyramidStopPrice, pyramidDate, addToast, queryClient, closePyramid])

  const openSellTrade = useCallback((trade: ApiTrade) => {
    const qty = trade.remaining_qty ?? trade.quantity
    setSellTradeId(trade.id)
    setSellQty(String(qty))
    setSellPrice('')
    setSellReason('')
    setSellFees(trade.fees ?? '')
    setSellNote('')
    setSellDate(nowIST())
  }, [])

  const closeSellTrade = useCallback(() => {
    setSellTradeId(null)
    setSellQty('')
    setSellPrice('')
    setSellReason('')
    setSellFees('')
    setSellNote('')
    setSellDate('')
  }, [])

  const handleSellTrade = useCallback(async (tradeId: number, maxQty: number | null) => {
    const qty = Number(sellQty)
    if (!sellPrice || !qty || qty <= 0 || (maxQty != null && qty > maxQty)) return
    setSellSubmitting(true)
    try {
      if (maxQty != null && qty < maxQty) {
        await createPartialExit(tradeId, {
          qty: sellQty,
          exit_price: sellPrice,
          exit_time: (sellDate || nowIST()) + ':00',
          exit_reason: sellReason || null,
          note: sellNote || null,
        })
        addToast({ title: 'Partial sell recorded', message: `${sellQty} shares sold.`, variant: 'success' })
      } else {
        const trade = await updateTrade(tradeId, {
          exit_price: sellPrice,
          exit_time: (sellDate || nowIST()) + ':00',
          exit_reason: sellReason || null,
          exit_notes: sellNote || null,
          ...(sellFees ? { fees: sellFees } : {}),
        })
        addToast({ title: 'Trade closed', message: `${trade.symbol} fully sold at ${formatPrice(Number(trade.exit_price))}.`, variant: 'success' })
        setTradeCache(queryClient, trade)
        patchTradeInLists(queryClient, trade)
      }
      void invalidateLifecycle(queryClient, tradeId)
      void invalidateTradeDetail(queryClient, tradeId)
      void invalidateRisk(queryClient)
      void invalidateAnalytics(queryClient)
      void invalidatePlaybook(queryClient)
      void invalidateTradeList(queryClient)
      closeSellTrade()
    } catch {
      addToast({ title: 'Error', message: 'Failed to record sell.', variant: 'error' })
    } finally {
      setSellSubmitting(false)
    }
  }, [sellQty, sellPrice, sellReason, sellFees, sellNote, sellDate, addToast, queryClient, closeSellTrade])

  const skip = (page - 1) * 100
  const { data, isLoading, error } = useTradesQuery({
    status: statusFilter ? (statusFilter as BackendTradeStatus) : undefined,
    symbol: symbolFilter || undefined,
    skip,
    limit: 100,
  })
  const totalPages = data ? Math.ceil(data.total / 100) : 0
  const displayedTrades = useMemo(() => {
    return (data?.items ?? []).filter((trade) => matchesResearchFilters(trade, researchFilters))
  }, [data?.items, researchFilters])
  const activeColumns = useMemo(() => columnOrder.filter((column) => visibleColumns.has(column)), [columnOrder, visibleColumns])

  useEffect(() => {
    localStorage.setItem(TRADE_TABLE_PREFS_KEY, JSON.stringify({
      density,
      visibleColumns: Array.from(visibleColumns),
      columnOrder,
    }))
  }, [density, visibleColumns, columnOrder])

  useEffect(() => {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews))
  }, [savedViews])

  const updateResearchFilter = useCallback(<K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => {
    setResearchFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const applySavedView = useCallback((view: SavedTradeView) => {
    setSymbolFilter(view.symbolFilter)
    setStatusFilter(view.statusFilter)
    setResearchFilters(view.researchFilters)
    setPage(1)
  }, [])

  const saveCurrentView = useCallback(() => {
    const trimmed = saveViewName.trim()
    if (!trimmed) return
    setSavedViews((prev) => [
      ...prev.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase()),
      {
        id: `custom-${Date.now()}`,
        name: trimmed,
        symbolFilter,
        statusFilter,
        researchFilters,
      },
    ])
    setSaveViewName('')
    addToast({ title: 'View saved', message: `${trimmed} is available in saved views.`, variant: 'success' })
  }, [saveViewName, symbolFilter, statusFilter, researchFilters, addToast])

  const moveColumn = useCallback((column: TradeColumnId, direction: -1 | 1) => {
    setColumnOrder((prev) => {
      const index = prev.indexOf(column)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }, [])

  const { data: capitalData } = useQuery({
    queryKey: ['capital-dashboard'],
    queryFn: getCapitalDashboard,
    staleTime: 30 * 1000,
  })
  const netEquity = capitalData?.net_equity ?? null

  const { data: sellExitsData } = usePartialExitsQuery(sellTradeId)
  const sellTrade = useMemo(() => {
    if (sellTradeId == null) return null
    return data?.items.find((trade) => trade.id === sellTradeId) ?? null
  }, [sellTradeId, data?.items])
  const sellMaxQty = sellExitsData ? Number(sellExitsData.remaining_qty) : sellTrade ? Number(sellTrade.remaining_qty ?? sellTrade.quantity) : null
  const sellQtyNum = Number(sellQty)
  const isFullSell = sellMaxQty != null && sellQtyNum === sellMaxQty
  const isInvalidSellQty = sellQty !== '' && (!sellQtyNum || sellQtyNum <= 0 || (sellMaxQty != null && sellQtyNum > sellMaxQty))

  const { data: liveQuotesData } = useLiveQuotesQuery(60_000)
  const syncQuotes = useSyncLiveQuotesMutation()
  const quoteMap = useMemo(() => {
    return new Map<string, LiveQuote>(
      (liveQuotesData?.quotes ?? []).map((q: LiveQuote) => [q.symbol, q])
    )
  }, [liveQuotesData])

  const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, [])
  const showCards = listingMode === 'cards' || (listingMode === 'auto' && isMobile)
  const showTable = listingMode === 'table' || (listingMode === 'auto' && !isMobile)

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
    selectedIds.forEach((id) => removeTradeFromLists(queryClient, id))
    void invalidateRisk(queryClient)
    void invalidateAnalytics(queryClient)
    void invalidatePlaybook(queryClient)
    void invalidateTradeList(queryClient)
  }, [selectedIds, addToast, queryClient])

  const allSelected = displayedTrades.length > 0 && displayedTrades.every((trade) => selectedIds.has(trade.id))

  const handleRefresh = useCallback(async () => {
    void invalidateTradeList(queryClient)
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
          <GlassButton variant="ghost" size="sm" onClick={() => syncQuotes.mutate()} disabled={syncQuotes.isPending}>
            {syncQuotes.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sync
          </GlassButton>
          <GlassButton variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4" /> Import
          </GlassButton>
          <GlassButton variant="accent" size="sm" onClick={openCreateTrade}>
            <Plus className="w-4 h-4" /> New Trade
          </GlassButton>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-border bg-card p-[var(--page-px)] space-y-3">
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
        <button
          onClick={() => setFiltersOpen((open) => !open)}
          className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${filtersOpen || advancedFilterCount > 0 ? 'bg-accent-muted text-accent' : 'text-text-muted hover:text-text-heading hover:bg-accent-faint'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters {advancedFilterCount > 0 ? `(${advancedFilterCount})` : ''}
        </button>
        <button
          onClick={() => setTableConfigOpen((open) => !open)}
          className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${tableConfigOpen ? 'bg-accent-muted text-accent' : 'text-text-muted hover:text-text-heading hover:bg-accent-faint'}`}
        >
          <Columns3 className="w-3.5 h-3.5" /> Columns
        </button>
        <button
          onClick={() => setListingMode(mode => mode === 'cards' ? 'table' : mode === 'table' ? 'auto' : 'cards')}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer text-text-muted hover:text-text-heading hover:bg-accent-faint"
          title={showCards ? 'Table view' : 'Card view'}
        >
          {showCards ? <LayoutList className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
        </button>
        {hasFilters && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
        <button
          onClick={() => downloadFilteredTradesCsv(displayedTrades, activeColumns)}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint transition-all cursor-pointer"
          title="Export current filtered table"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {[...BUILT_IN_VIEWS, ...savedViews].map((view) => (
          <button
            key={view.id}
            onClick={() => applySavedView(view)}
            className="shrink-0 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 text-[10px] font-data text-text-muted hover:border-text-muted hover:text-text-heading"
          >
            {view.name}
          </button>
        ))}
      </div>

      {filtersOpen && (
        <div className="grid gap-3 border-t border-border pt-3 md:grid-cols-4">
          <FilterInput label="From" type="date" value={researchFilters.fromDate} onChange={(value) => updateResearchFilter('fromDate', value)} />
          <FilterInput label="To" type="date" value={researchFilters.toDate} onChange={(value) => updateResearchFilter('toDate', value)} />
          <FilterInput label="Setup" value={researchFilters.setup} onChange={(value) => updateResearchFilter('setup', value)} placeholder="EP, Pullback..." />
          <FilterInput label="Tactic" value={researchFilters.tactic} onChange={(value) => updateResearchFilter('tactic', value)} placeholder="ORB, PDH..." />
          <FilterInput label="Tags" value={researchFilters.tags} onChange={(value) => updateResearchFilter('tags', value)} placeholder="mistake, A+" />
          <div>
            <label className="block text-[10px] font-data uppercase tracking-wider text-text-muted mb-1">Exit reason</label>
            <select value={researchFilters.exitReason} onChange={(e) => updateResearchFilter('exitReason', e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading focus:outline-none focus:border-accent/50 transition-all">
              <option value="">Any</option>
              {['stop_loss', 'target', 'manual', 'trailing', 'system'].map((reason) => <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <FilterInput label="PnL min" type="number" value={researchFilters.pnlMin} onChange={(value) => updateResearchFilter('pnlMin', value)} />
          <FilterInput label="PnL max" type="number" value={researchFilters.pnlMax} onChange={(value) => updateResearchFilter('pnlMax', value)} />
          <FilterInput label="R min" type="number" value={researchFilters.rMin} onChange={(value) => updateResearchFilter('rMin', value)} />
          <FilterInput label="R max" type="number" value={researchFilters.rMax} onChange={(value) => updateResearchFilter('rMax', value)} />
          <div className="md:col-span-4 flex flex-wrap gap-2">
            <FilterToggle label="Has screenshot" checked={researchFilters.hasScreenshot} onChange={(checked) => updateResearchFilter('hasScreenshot', checked)} />
            <FilterToggle label="Has journal note" checked={researchFilters.hasJournalNote} onChange={(checked) => updateResearchFilter('hasJournalNote', checked)} />
            <FilterToggle label="Has stop" checked={researchFilters.hasStop} onChange={(checked) => updateResearchFilter('hasStop', checked)} />
            <FilterToggle label="No stop" checked={researchFilters.noStop} onChange={(checked) => updateResearchFilter('noStop', checked)} />
            <FilterToggle label="Has partial exit" checked={researchFilters.hasPartialExit} onChange={(checked) => updateResearchFilter('hasPartialExit', checked)} />
            <FilterToggle label="Unreviewed" checked={researchFilters.unreviewed} onChange={(checked) => updateResearchFilter('unreviewed', checked)} />
          </div>
          <div className="md:col-span-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <input
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder="Saved view name"
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 sm:w-56"
            />
            <button onClick={saveCurrentView} disabled={!saveViewName.trim()} className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> Save view
            </button>
          </div>
        </div>
      )}

      {tableConfigOpen && (
        <div className="border-t border-border pt-3">
          <div className="mb-3 inline-flex rounded-xl border border-border bg-bg-elevated p-1">
            {(['comfortable', 'compact'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setDensity(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${density === option ? 'bg-card text-text-heading' : 'text-text-muted hover:text-text-heading'}`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {columnOrder.map((column, index) => (
              <div key={column} className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-2 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-text-muted">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(column)}
                    onChange={(e) => {
                      setVisibleColumns((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(column)
                        else next.delete(column)
                        return next
                      })
                    }}
                  />
                  <span className="truncate">{COLUMN_LABELS[column]}</span>
                </label>
                <button disabled={index === 0} onClick={() => moveColumn(column, -1)} className="px-1 text-xs text-text-muted disabled:opacity-30">Up</button>
                <button disabled={index === columnOrder.length - 1} onClick={() => moveColumn(column, 1)} className="px-1 text-xs text-text-muted disabled:opacity-30">Down</button>
              </div>
            ))}
          </div>
        </div>
      )}
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

      {/* Table/Card card container */}
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
        {!isLoading && !error && displayedTrades.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-sm text-text-muted">No trades found.</p>
            <p className="text-xs text-text-faint mt-1">Adjust filters or click "New Trade" to get started.</p>
            <button onClick={openCreateTrade} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> New Trade
            </button>
          </div>
        )}
        {!isLoading && !error && displayedTrades.length > 0 && showCards && (
          <div className="p-[var(--page-px)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-muted font-data">{displayedTrades.length} trades</span>
              <button
                onClick={() => setListingMode(mode => mode === 'cards' ? 'table' : mode === 'table' ? 'auto' : 'cards')}
                className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-text-heading transition-colors cursor-pointer"
              >
                <LayoutList className="w-3 h-3" /> Table
              </button>
            </div>
            <div className="grid gap-[var(--page-gap)] sm:grid-cols-2">
              {displayedTrades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  onTap={() => openDetailTrade(trade.id)}
                  isSelected={selectedIds.has(trade.id)}
                  onToggleSelect={() => toggleSelect(trade.id)}
                  onSellTrade={() => openSellTrade(trade)}
                />
              ))}
            </div>
            {data && totalPages > 1 && (
              <div className="flex items-center justify-between mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border">
                <span className="text-xs text-text-muted font-data">Page {page} / {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint disabled:opacity-30 cursor-pointer">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-heading hover:bg-accent-faint disabled:opacity-30 cursor-pointer">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
        {!isLoading && !error && displayedTrades.length > 0 && showTable && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-bg-low text-left">
                  <th className="px-3 py-3 w-10">
                    {displayedTrades.length > 0 && (
                      <button
                        onClick={() => {
                          if (allSelected) setSelectedIds(new Set())
                          else setSelectedIds(new Set(displayedTrades.map(t => t.id)))
                        }}
                        className="text-text-muted hover:text-text-heading cursor-pointer"
                      >
                        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    )}
                  </th>
                  {activeColumns.map((column) => (
                    <th key={column} className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest">
                      {COLUMN_LABELS[column]}
                    </th>
                  ))}
                  <th className="px-[var(--cell-px)] py-[var(--cell-py)] text-[length:var(--text-xs)] font-medium text-text-muted uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedTrades.map((trade) => (
                    <TradeRow
                       key={trade.id}
                       trade={trade}
                       selectedIds={selectedIds}
                       toggleSelect={toggleSelect}
                        openEditTrade={openEditTrade}
                        openDetailTrade={openDetailTrade}
                        setPyramidingTradeId={setPyramidingTradeId}
                        onPyramidOpen={() => setPyramidDate(nowIST())}
                       openSellTrade={openSellTrade}
                       netEquity={netEquity}
                       quoteMap={quoteMap}
                       activeColumns={activeColumns}
                       density={density}
                     />
                ))}
              </tbody>
            </table>
            {!isLoading && !error && data && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border px-3 sm:px-5 pb-4">
                <span className="text-xs text-text-muted font-data">
                  {data.total === 0 ? '0 trades' : `${displayedTrades.length} shown from ${data.items.length} loaded · ${data.total} total · Page ${page} of ${totalPages}`}
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
        <div className="space-y-3 mb-[var(--page-gap)]">
          <div>
            <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Entry Price (₹)</label>
            <input type="number" step="0.01" value={pyramidEntryPrice} onChange={(e) => setPyramidEntryPrice(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Quantity</label>
            <input type="number" step="1" value={pyramidQty} onChange={(e) => setPyramidQty(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0" />
          </div>
          <div>
            <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Entry Date & Time</label>
            <input type="datetime-local" value={pyramidDate} onChange={(e) => setPyramidDate(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" />
          </div>
          <div>
            <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Fees (optional)</label>
            <input type="number" step="0.01" value={pyramidFees} onChange={(e) => setPyramidFees(e.target.value)}
              className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0" />
          </div>
          <div>
            <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Stop Price (optional)</label>
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

      {sellTradeId !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card shadow-2xl animate-card-in">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-text-heading font-display">Sell Position</h3>
                <p className="mt-0.5 text-xs text-text-muted">{sellTrade?.symbol ?? 'Open trade'} · {isFullSell ? 'Full sell' : 'Partial sell'}</p>
              </div>
              <button onClick={closeSellTrade} className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-heading transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {sellTrade && (
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-bg-elevated/30 p-3 text-xs">
                  <div>
                    <div className="text-text-faint">Entry</div>
                    <div className="font-data text-text-heading">{formatPrice(Number(sellTrade.entry_price))}</div>
                  </div>
                  <div>
                    <div className="text-text-faint">Remaining</div>
                    <div className="font-data text-text-heading">{sellMaxQty != null ? formatQuantity(String(sellMaxQty)) : '—'}</div>
                  </div>
                  <div>
                    <div className="text-text-faint">Mode</div>
                    <div className={isFullSell ? 'font-data text-loss' : 'font-data text-accent'}>{isFullSell ? 'Full' : 'Partial'}</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Qty to sell</label>
                  <input type="number" step="1" value={sellQty} onChange={(e) => setSellQty(e.target.value)} max={sellMaxQty ?? undefined}
                    className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder={sellMaxQty != null ? `max ${sellMaxQty}` : '0'} />
                </div>
                <div>
                  <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Sell Price (₹)</label>
                  <input type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
                </div>
              </div>
              {isInvalidSellQty && (
                <div className="rounded-lg border border-loss/30 bg-loss-muted/15 px-3 py-2 text-xs text-loss">
                  Qty must be between 1 and remaining shares.
                </div>
              )}
              <div>
                <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Reason</label>
                <select value={sellReason} onChange={(e) => setSellReason(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all appearance-none cursor-pointer">
                  <option value="">Auto-detect / manual</option>
                  {['target', 'stop_loss', 'manual', 'trailing', 'system'].map(r => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Exit Date & Time</label>
                <input type="datetime-local" value={sellDate} onChange={(e) => setSellDate(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" />
              </div>
              {isFullSell && (
                <div>
                  <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Fees & Charges (optional)</label>
                  <input type="number" step="0.01" value={sellFees} onChange={(e) => setSellFees(e.target.value)}
                    className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading focus:outline-none focus:border-accent/50 transition-all" placeholder="0.00" />
                </div>
              )}
              <div>
                <label className="block text-[length:var(--text-xs)] font-medium text-text-muted mb-1">Note (optional)</label>
                <textarea value={sellNote} onChange={(e) => setSellNote(e.target.value)} rows={2}
                  className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all resize-none" placeholder="Why sell here?" />
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-4">
              <button onClick={closeSellTrade} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text-heading hover:bg-bg-elevated transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => handleSellTrade(sellTradeId, sellMaxQty)} disabled={sellSubmitting || !sellQty || !sellPrice || isInvalidSellQty}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-all cursor-pointer disabled:opacity-50">
                {sellSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Selling...</> : <><ArrowDownToLine className="w-4 h-4" /> {isFullSell ? 'Sell Full' : 'Sell Partial'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <BrokerImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={() => {
        void invalidateRisk(queryClient)
        void invalidateAnalytics(queryClient)
        void invalidatePlaybook(queryClient)
        void invalidateTradeList(queryClient)
      }} />
    </div>
    </PullToRefresh>
  )
}

function TradeCard({
  trade,
  onTap,
  isSelected,
  onToggleSelect,
  onSellTrade,
}: {
  trade: ApiTrade
  onTap: () => void
  isSelected: boolean
  onToggleSelect: () => void
  onSellTrade: () => void
}) {
  const pnlNum = trade.pnl != null ? Number(trade.pnl) : 0
  const isProfitable = pnlNum >= 0
  const isOpen = !trade.exit_price
  return (
    <button
      onClick={onTap}
      className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${isSelected ? 'border-accent/40 bg-accent-faint/30' : 'border-border bg-bg-elevated/30 hover:border-text-muted/30'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-text-heading truncate">{trade.symbol}</span>
            <span className={`shrink-0 inline-flex items-center px-1.5 py-px rounded-full text-[9px] font-medium ${isOpen ? 'bg-border text-text-muted' : isProfitable ? 'bg-profit-muted text-profit' : 'bg-loss-muted text-loss'}`}>
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <span>{formatDateTime(trade.entry_time)}</span>
            {trade.setup && <span className="px-1 py-px rounded bg-accent-faint text-accent font-medium">{trade.setup}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-data font-bold ${pnlNum >= 0 ? 'text-profit' : 'text-loss'}`}>
            {pnlNum >= 0 ? '+' : ''}{formatCurrency(Math.abs(pnlNum))}
          </div>
          {trade.r_multiple != null && (
            <div className={`text-[10px] font-data ${Number(trade.r_multiple) >= 0 ? 'text-profit' : 'text-loss'}`}>
              {Number(trade.r_multiple) >= 0 ? '+' : ''}{Number(trade.r_multiple).toFixed(2)}R
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px]">
        <div className="flex items-center gap-1">
          <span className="text-text-faint">Entry</span>
          <span className="text-text-heading font-data font-medium">{formatPrice(Number(trade.entry_price))}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-faint">{isOpen ? 'LTP' : 'Exit'}</span>
          <span className="text-text-heading font-data font-medium">{trade.exit_price ? formatPrice(Number(trade.weighted_avg_exit_price ?? trade.exit_price)) : '—'}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-faint">Qty</span>
          <span className="text-text-heading font-data font-medium">{formatQuantity(trade.quantity)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <button onClick={(e) => { e.stopPropagation(); onToggleSelect() }} className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${isSelected ? 'text-accent bg-accent-faint' : 'text-text-faint hover:text-text-muted'}`}>
          {isSelected ? 'Selected' : 'Select'}
        </button>
        {isOpen && (
          <button onClick={(e) => { e.stopPropagation(); onSellTrade() }} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded text-profit bg-profit-muted hover:text-profit transition-colors">
            <ArrowDownToLine className="w-3 h-3" />
            Sell
          </button>
        )}
      </div>
    </button>
  )
}

function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] font-data uppercase tracking-wider text-text-muted mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border-strong bg-bg-elevated/50 px-3 py-2 text-xs text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 transition-all"
      />
    </div>
  )
}

function FilterToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-all ${checked ? 'border-accent/30 bg-accent-muted text-accent' : 'border-border bg-bg-elevated text-text-muted hover:text-text-heading'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {checked ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      {label}
    </label>
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
  openDetailTrade: (id: number) => void
   setPyramidingTradeId: (id: number | null) => void
   onPyramidOpen: () => void
  openSellTrade: (trade: ApiTrade) => void
  netEquity: string | null
  quoteMap: Map<string, LiveQuote>
  activeColumns: TradeColumnId[]
  density: TableDensity
}

const STOP_TYPE_OPTIONS = [
  { value: 'manual', label: 'Manual' },
  { value: 'trailing', label: 'Trailing' },
  { value: 'breakeven', label: 'Breakeven' },
]

function TradeRow({ trade, selectedIds, toggleSelect, openEditTrade, openDetailTrade, setPyramidingTradeId, onPyramidOpen, openSellTrade, netEquity, quoteMap, activeColumns, density }: TradeRowProps) {
  const entryCost = Number(trade.entry_price) * Number(trade.quantity)
  const pnlNum = trade.pnl != null ? Number(trade.pnl) : 0
  const capPct = computeCapPct(pnlNum, Number(netEquity))
  const quote = quoteMap.get(trade.symbol)
  const ltp = quote?.ltp ? parseFloat(quote.ltp) : null
  const ltpChg = quote?.change_pct ? parseFloat(quote.change_pct) : null
  const quoteStatus = getLiveQuoteDisplayStatus(quote)
  const isOpen = !trade.exit_price
  const remainingQty = trade.remaining_qty ? Number(trade.remaining_qty) : Number(trade.quantity)
  const partialRealized = trade.partial_realized_pnl ? Number(trade.partial_realized_pnl) : null
  const hasPartials = partialRealized != null
  const realizedPnl = hasPartials ? partialRealized : (trade.exit_price ? pnlNum : null)
  const livePnl = isOpen && ltp != null
    ? computeLivePnl(Number(trade.entry_price), ltp, Number(trade.quantity), remainingQty, Number(trade.fees))
    : null
  const livePnlPct = isOpen && entryCost > 0 && livePnl != null ? computeLivePnlPct(entryCost, livePnl) : null
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
          timestamp: nowIST() + ':00',
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
  const cellClass = density === 'compact' ? 'px-2 py-2' : 'px-[var(--cell-px)] py-[var(--cell-py)]'

  const renderCell = (column: TradeColumnId) => {
    if (column === 'symbol') {
      return (
        <td key={column} className={cellClass}>
          <button onClick={() => openDetailTrade(trade.id)} className="font-medium text-text-heading hover:text-accent transition-colors cursor-pointer">
            {trade.symbol}
          </button>
        </td>
      )
    }
    if (column === 'entry') {
      return (
        <td key={column} className={cellClass}>
          <div className="text-text-heading text-xs">{formatPrice(Number(trade.entry_price))}</div>
          <div className="text-[10px] text-text-muted mt-0.5">{formatDateTime(trade.entry_time)}</div>
        </td>
      )
    }
    if (column === 'exit') {
      return (
        <td key={column} className={cellClass}>
          {trade.exit_price ? (
            <>
              <div className="text-text-heading text-xs">{formatPrice(Number(trade.weighted_avg_exit_price ?? trade.exit_price))}</div>
              <div className="text-[10px] text-text-muted mt-0.5">{trade.exit_time ? formatDateTime(trade.exit_time) : '—'}</div>
            </>
          ) : (
            <span className="text-text-muted text-xs">Open</span>
          )}
        </td>
      )
    }
    if (column === 'ltp') {
      return (
        <td key={column} className={cellClass}>
          {ltp != null ? (
            <div>
              <div className="text-text-heading text-xs font-data">{formatPrice(ltp)}</div>
              {ltpChg != null && <div className={`text-[10px] font-data ${(ltpChg >= 0) ? 'text-profit' : 'text-loss'}`}>{ltpChg >= 0 ? '+' : ''}{ltpChg.toFixed(2)}%</div>}
              <div className={`text-[10px] font-data ${getLiveQuoteDisplayClass(quoteStatus)}`}>{quoteStatus}</div>
            </div>
          ) : (
            <span className={`text-xs font-data ${getLiveQuoteDisplayClass(quoteStatus)}`}>{quoteStatus}</span>
          )}
        </td>
      )
    }
    if (column === 'sl') {
      return (
        <td key={column} className={cellClass}>
          {slEditing ? (
            <div className="flex items-center gap-1 min-w-[140px]">
              <input ref={slRef} type="number" step="0.01" value={slPrice} onChange={(e) => setSlPrice(e.target.value)} className="w-20 px-1.5 py-1 rounded text-[10px] bg-bg-card border border-border text-text-heading" placeholder="Price" />
              <select value={slType} onChange={(e) => setSlType(e.target.value)} className="w-16 px-1 py-1 rounded text-[10px] bg-bg-card border border-border text-text-heading">
                {STOP_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={handleSlSave} disabled={!slPrice || createStopHistory.isPending} className="px-1.5 py-1 rounded text-[10px] font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer">
                {createStopHistory.isPending ? '…' : 'Set'}
              </button>
              <button onClick={() => setSlEditing(false)} className="px-1 py-1 rounded text-[10px] text-text-muted hover:text-text-heading transition-colors cursor-pointer">×</button>
            </div>
          ) : (
            <button onClick={() => { setSlPrice(trade.stop_price ?? ''); setSlEditing(true) }} className={`font-data text-xs transition-colors cursor-pointer ${trade.stop_price ? 'text-text-heading hover:text-accent' : 'text-text-faint hover:text-text-muted'}`} title="Click to set trailing stop">
              {trade.stop_price ? formatPrice(Number(trade.stop_price)) : '—'}
            </button>
          )}
        </td>
      )
    }
    if (column === 'maxRisk') {
      return (
        <td key={column} className={cellClass}>
          {trade.stop_price ? (() => {
            const risk = computeMaxRisk(Number(trade.entry_price), Number(trade.stop_price), remainingQty)
            return <span className={`font-data text-xs ${risk == null ? 'text-text-faint' : risk < 0 ? 'text-profit' : risk > 0 ? 'text-loss' : 'text-text-muted'}`}>{risk == null ? '—' : risk < 0 ? '-' : ''}{risk != null ? formatCurrency(Math.abs(risk)) : ''}</span>
          })() : <span className="text-text-faint text-xs">—</span>}
        </td>
      )
    }
    if (column === 'quantity') return <td key={column} className={`${cellClass} text-text-heading text-xs`}>{formatQuantity(trade.quantity)}</td>
    if (column === 'remaining') {
      return <td key={column} className={cellClass}><span className={`font-data text-xs ${remainingQty < Number(trade.quantity) ? 'text-accent' : 'text-text-heading'}`}>{formatQuantity(String(remainingQty))}</span></td>
    }
    if (column === 'setup') return <td key={column} className={`${cellClass} text-text-muted text-xs`}>{trade.setup || '—'}</td>
    if (column === 'status') {
      return <td key={column} className={cellClass}><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadgeClass(trade)}`}>{getStatusLabel(trade)}</span></td>
    }
    if (column === 'realized') {
      return (
        <td key={column} className={cellClass}>
          {realizedPnl != null ? <span className={`font-data text-xs font-medium ${realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl)}</span> : <span className="text-text-muted text-xs">—</span>}
        </td>
      )
    }
    if (column === 'unrealized') {
      return (
        <td key={column} className={cellClass}>
          {isOpen && livePnl != null ? (
            <div>
              <span className={`font-data text-xs font-medium ${livePnl >= 0 ? 'text-profit' : 'text-loss'}`}>{livePnl >= 0 ? '+' : ''}{formatCurrency(livePnl)}</span>
              {livePnlPct != null && <div className={`text-[10px] font-data ${livePnlPct >= 0 ? 'text-profit' : 'text-loss'}`}>{livePnlPct >= 0 ? '+' : ''}{livePnlPct.toFixed(2)}%</div>}
            </div>
          ) : <span className="text-text-faint text-xs">—</span>}
        </td>
      )
    }
    return (
      <td key={column} className={cellClass}>
        <span className={`font-data text-xs ${capPct == null ? 'text-text-faint' : pnlNum >= 0 ? 'text-profit' : 'text-loss'}`}>
          {capPct != null ? `${pnlNum >= 0 ? '+' : ''}${capPct.toFixed(2)}%` : '—'}
        </span>
      </td>
    )
  }

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
      {activeColumns.map(renderCell)}
      <td className={`${cellClass} text-right`}>
        <div className="flex items-center justify-end gap-0.5">
          {!trade.exit_price && (
            <>
              <button
                onClick={() => { openSellTrade(trade) }}
                className="p-1.5 rounded-md text-text-muted hover:text-profit hover:bg-profit-muted transition-colors cursor-pointer"
                title="Sell"
              >
                <ArrowDownToLine className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setPyramidingTradeId(trade.id); onPyramidOpen() }}
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
