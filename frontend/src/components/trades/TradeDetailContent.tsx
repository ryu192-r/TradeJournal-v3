import { useState, useEffect, useMemo, type ReactNode } from 'react'
import {
  Target, Loader2, Edit3, Trash2, ShieldAlert, Info,
  CalendarClock, NotebookPen, Tag, AlertTriangle, BarChart3, Image, ClipboardCheck,
} from 'lucide-react'
import { ChartImageGallery } from '@/components/trades/ChartImageGallery'
import { TradeLightweightChart } from '@/components/charts/TradeLightweightChart'
import { LifecycleReviewPanel } from '@/components/lifecycle/LifecycleReviewPanel'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { generateTradeReview } from '@/lib/endpoints'
import { useDeleteTradeMutation } from '@/hooks/useTradeMutation'
import { useAppStore } from '@/store/appStore'
import { useToastStore } from '@/store/toastStore'
import { formatCurrency, formatPrice, formatQuantity, formatDateTime } from '@/utils/format'
import { calculateTradeMetrics } from '@/utils/calculations'
import { StatusBadge, SectionHeader, ResponsiveTabs, EmptyState } from '@/components/ui'
import { CARD, SECTION_LABEL } from '@/components/layout/layoutTokens'
import type { ApiTrade } from '@/types'
import type { TradeReviewResponse } from '@/types/coach'
import type { LucideIcon } from 'lucide-react'

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section className={CARD}>
      <SectionHeader title={title} icon={Icon} />
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  )
}

/* ── helpers ── */

function fmtMoney(n: number | null): string {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return sign + formatCurrency(Math.abs(n))
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function durationToString(ms: number): string {
  if (ms <= 0) return '—'
  const totalMinutes = Math.floor(ms / 60000)
  if (totalMinutes < 60) return plural(totalMinutes, 'min')
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours < 24) return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim()
  const days = Math.floor(hours / 24)
  const remHours = hours % 24
  return `${plural(days, 'day')}${remHours > 0 ? ` ${remHours}h` : ''}`
}

/* ── SummaryHeader ── */

function TradeSummaryHeader({
  trade, isOpen, pnlIsProfit, onEdit, onDelete, isDeleting,
}: {
  trade: ApiTrade
  isOpen: boolean
  pnlIsProfit: boolean
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const [confirming, setConfirming] = useState(false)

  const handleDeleteClick = () => {
    if (confirming) {
      onDelete()
      setConfirming(false)
    } else {
      setConfirming(true)
    }
  }

  return (
    <div className={CARD}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[length:var(--heading-size)] font-semibold text-text-heading font-display truncate">
                {trade.symbol}
              </h2>
              <StatusBadge
                status={isOpen ? 'Open' : 'Closed'}
                tone={isOpen ? 'neutral' : pnlIsProfit ? 'profit' : 'loss'}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {trade.setup && (
                <span className="text-[10px] px-1.5 py-px rounded bg-accent-faint text-accent font-medium">
                  {trade.setup}
                </span>
              )}
              {trade.tactic && (
                <span className="text-[10px] px-1.5 py-px rounded bg-bg-elevated text-text-muted">
                  {trade.tactic}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[length:var(--text-xs)] border border-border text-text-muted hover:text-text-heading hover:border-text-muted transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[length:var(--text-xs)] border transition-colors cursor-pointer disabled:opacity-50 ${
              confirming
                ? 'border-loss/50 bg-loss-muted/20 text-loss'
                : 'border-border text-text-muted hover:text-loss hover:border-loss/40'
            }`}
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            {confirming ? 'Confirm?' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── PnL Hero ── */

function PnLHero({
  pnlValue, pnlIsProfit, rMultiple, partialPnl, isOpen,
}: {
  pnlValue: number | null
  pnlIsProfit: boolean
  rMultiple: number | null
  partialPnl: number | null
  isOpen: boolean
}) {
  const pnlColor = pnlValue != null ? (pnlIsProfit ? 'text-profit' : 'text-loss') : 'text-text-muted'
  const pnlBg = pnlValue != null
    ? (pnlIsProfit ? 'border-profit/30 bg-profit-muted/20' : 'border-loss/30 bg-loss-muted/20')
    : 'border-border bg-bg-elevated/30'

  return (
    <div className={`rounded-2xl border p-[var(--page-px)] animate-card-in ${pnlBg}`}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display">
            {pnlValue != null ? 'Net P&amp;L' : 'Result'}
          </div>
          <div className={`font-data text-3xl sm:text-4xl font-bold mt-1 ${pnlColor}`}>
            {pnlValue != null ? `${pnlIsProfit ? '+' : ''}${formatCurrency(pnlValue)}` : '—'}
          </div>
          {rMultiple != null && (
            <div className={`text-sm font-data mt-1 ${rMultiple >= 0 ? 'text-profit' : 'text-loss'}`}>
              {rMultiple >= 0 ? '+' : ''}{rMultiple.toFixed(2)}R
            </div>
          )}
        </div>
        {partialPnl != null && isOpen && (
          <div className="text-right">
            <div className="text-[length:var(--text-xs)] text-text-muted">Partial Realized</div>
            <div className={`text-base font-data font-medium ${partialPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {partialPnl >= 0 ? '+' : ''}{formatCurrency(partialPnl)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── MetricGrid ── */

function MetricGrid({
  calc,
  originalStopPrice,
  currentStopPrice,
  protectionStatus,
}: {
  calc: ReturnType<typeof calculateTradeMetrics>
  originalStopPrice: number | null
  currentStopPrice: number | null
  protectionStatus: string | null
}) {
  const protectionLabel = (() => {
    if (calc.currentProtectionStatus === 'profit_locked') return 'Profit Locked'
    if (calc.currentProtectionStatus === 'breakeven') return 'Breakeven / Risk-Free'
    if (calc.currentProtectionStatus === 'active_risk') return 'Active Risk'
    if (protectionStatus === 'risk_free') return 'Risk-Free'
    if (protectionStatus) return protectionStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return 'No Stop'
  })()

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
        <MetricRow label="Original SL" value={originalStopPrice != null ? formatPrice(originalStopPrice) : null} tone="neutral" />
        <MetricRow label="Current SL" value={currentStopPrice != null ? formatPrice(currentStopPrice) : null} tone="neutral" />
        <MetricRow label="Gross P&amp;L" value={calc.isValidForPnl ? fmtMoney(calc.grossPnl) : null} tone={calc.isValidForPnl ? (calc.grossPnl! >= 0 ? 'profit' : 'loss') : null} />
        <MetricRow label="Net P&amp;L" value={calc.isValidForPnl ? fmtMoney(calc.netPnl) : null} tone={calc.isValidForPnl ? (calc.netPnl! >= 0 ? 'profit' : 'loss') : null} />
        <MetricRow label="Planned Risk" value={calc.riskAmount != null ? formatCurrency(Math.abs(calc.riskAmount)) : null} tone={calc.riskAmount != null ? 'loss' : null} icon />
        <MetricRow label="Current Risk" value={calc.currentRiskAmount != null ? formatCurrency(Math.abs(calc.currentRiskAmount)) : null} tone={calc.currentRiskAmount != null && calc.currentRiskAmount > 0 ? 'loss' : 'neutral'} />
        <MetricRow label="Locked Profit" value={calc.lockedProfitAmount != null ? formatCurrency(calc.lockedProfitAmount) : null} tone={calc.lockedProfitAmount != null ? 'profit' : null} />
        <MetricRow label="Protection Status" value={protectionLabel} tone={calc.currentIsRiskFree ? 'profit' : 'neutral'} />
        <MetricRow label="Planned Reward" value={calc.plannedRewardAmount != null ? formatCurrency(calc.plannedRewardAmount) : null} tone={calc.plannedRewardAmount != null ? 'profit' : null} />
        <MetricRow label="Planned Risk:Reward" value={calc.isValidForRiskReward ? `1:${calc.riskRewardRatio!.toFixed(2)}` : null} tone="neutral" />
        <MetricRow label="Actual R Multiple" value={calc.rMultiple != null ? `${calc.rMultiple >= 0 ? '+' : ''}${calc.rMultiple.toFixed(2)}R` : null} tone={calc.rMultiple != null ? (calc.rMultiple >= 0 ? 'profit' : 'loss') : null} />
        <MetricRow label="P&amp;L per Unit" value={calc.pnlPerUnit != null ? `${calc.pnlPerUnit >= 0 ? '+' : ''}${formatPrice(Math.abs(calc.pnlPerUnit))}` : null} tone={calc.pnlPerUnit != null ? (calc.pnlPerUnit >= 0 ? 'profit' : 'loss') : null} />
        <MetricRow label="Planned Risk/Unit" value={calc.riskPerUnit != null ? formatPrice(calc.riskPerUnit) : null} tone={calc.riskPerUnit != null ? 'loss' : null} />
      </div>

      {calc.warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {calc.warnings.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
              <Info className="w-2.5 h-2.5" />
              {w}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricRow({ label, value, tone, icon }: { label: string; value: string | null; tone: 'profit' | 'loss' | 'neutral' | null; icon?: boolean }) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : tone === 'neutral' ? 'text-text-heading' : 'text-text-faint'
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[length:var(--text-xs)] text-text-muted flex items-center gap-1">
        {icon && !value && <ShieldAlert className="w-2.5 h-2.5 text-loss/50" />}
        {label}
      </span>
      <span className={`text-sm font-data font-medium ${color}`}>
        {value ?? 'Not enough data'}
      </span>
    </div>
  )
}

/* ── StatCards ── */

function StatCards({ trade, isOpen, duration, showPartialInfo, remainingQty }: {
  trade: ApiTrade
  isOpen: boolean
  duration: string
  showPartialInfo: boolean
  remainingQty: number | null
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCell label="Entry" value={formatPrice(Number(trade.entry_price))} detail={formatDateTime(trade.entry_time)} />
      <StatCell label="Exit" value={trade.exit_price ? formatPrice(Number(trade.weighted_avg_exit_price ?? trade.exit_price)) : 'Open'} detail={isOpen ? '—' : (trade.exit_time ? formatDateTime(trade.exit_time) : '—')} />
      <StatCell
        label={`Quantity${showPartialInfo ? ' (rem.)' : ''}`}
        value={
          showPartialInfo
            ? <>{formatQuantity(trade.quantity)}<span className="text-text-muted text-[length:var(--text-sm)] ml-1.5">/ {formatQuantity(remainingQty!)}</span></>
            : formatQuantity(trade.quantity)
        }
        detail={null}
      />
      <StatCell label="Duration" value={duration} detail={trade.exit_reason ? trade.exit_reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : null} />
      <StatCell label="Current SL" value={trade.current_stop_price ? formatPrice(Number(trade.current_stop_price)) : (trade.stop_price ? formatPrice(Number(trade.stop_price)) : '—')} detail={null} />
      <StatCell label="Original SL" value={trade.original_stop_price ? formatPrice(Number(trade.original_stop_price)) : (trade.stop_price ? formatPrice(Number(trade.stop_price)) : '—')} detail={null} />
      <StatCell label="Target" value={trade.target_price ? formatPrice(Number(trade.target_price)) : '—'} detail={null} />
      <StatCell label="Fees" value={trade.fees != null && Number(trade.fees) > 0 ? formatCurrency(Number(trade.fees)) : '—'} detail={null} />
      <StatCell
        label="Setup / Tactic"
        value={
          <div className="flex items-center gap-1 flex-wrap text-[length:var(--text-sm)]">
            {trade.setup ? <span className="text-accent">{trade.setup}</span> : <span className="text-text-faint">—</span>}
            {trade.tactic && <>
              <span className="text-text-faint">/</span>
              <span className="text-text-muted">{trade.tactic}</span>
            </>}
          </div>
        }
        detail={null}
      />
    </div>
  )
}

function StatCell({ label, value, detail }: { label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-bg-elevated/20 p-3">
      <div className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display mb-1">{label}</div>
      <div className="font-data text-base sm:text-lg font-semibold text-text-heading">{value}</div>
      {detail && <div className="text-[length:var(--text-xs)] text-text-muted mt-1 font-data">{detail}</div>}
    </div>
  )
}

/* ── Tags ── */

function TagsRow({ tags }: { tags: string[] | null }) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="text-[length:var(--text-xs)] px-2.5 py-1 rounded-full bg-accent-faint text-accent">{tag}</span>
      ))}
    </div>
  )
}

/* ── AI Review ── */

function AiReviewCard({ review }: { review: TradeReviewResponse }) {
  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-[var(--page-px)] space-y-[var(--page-gap)] animate-card-in">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-accent" />
        <span className="text-[length:var(--text-sm)] font-medium text-text-heading">AI Trade Review</span>
        <span className={`text-[length:var(--text-sm)] font-bold ml-auto font-data ${
          review.discipline_score >= 70 ? 'text-profit' : review.discipline_score >= 40 ? 'text-gold' : 'text-loss'
        }`}>
          {review.discipline_score}/100
        </span>
      </div>
      <p className="text-[length:var(--text-sm)] text-text leading-relaxed">{review.summary}</p>
      <div className="flex flex-wrap gap-1.5">
        {review.strengths.slice(0, 3).map((s, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-profit-muted/20 text-profit">{s}</span>
        ))}
        {review.weaknesses.slice(0, 3).map((w, i) => (
          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-loss-muted/20 text-loss">{w}</span>
        ))}
      </div>
    </div>
  )
}

/* ── Chart Tabs ── */

type ChartTab = 'dynamic' | 'uploads'

function ChartTabs({ trade }: { trade: ApiTrade }) {
  const [tab, setTab] = useState<ChartTab>('dynamic')
  const items = [
    { id: 'dynamic', label: 'Dynamic Chart', icon: BarChart3 },
    { id: 'uploads', label: 'Uploaded Images', icon: Image },
  ]

  return (
    <div className="space-y-2">
      <ResponsiveTabs value={tab} onChange={(next) => setTab(next as ChartTab)} items={items} />
      {tab === 'dynamic' ? (
        <TradeLightweightChart trade={trade} />
      ) : (
        <ChartImageGallery tradeId={trade.id} images={trade.chart_images ?? []} />
      )}
    </div>
  )
}

/* ── Main ── */

interface TradeDetailContentProps {
  trade: ApiTrade
}

export function TradeDetailContent({ trade }: TradeDetailContentProps) {
  const [inlineReview, setInlineReview] = useState<TradeReviewResponse | null>(null)
  const qc = useQueryClient()
  const reviewMut = useMutation<TradeReviewResponse, Error, number>({
    mutationFn: generateTradeReview,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coach-reviews'] }),
  })
  const deleteMut = useDeleteTradeMutation()
  const openEditTrade = useAppStore((s) => s.openEditTrade)
  const closeTradeForm = useAppStore((s) => s.closeTradeForm)
  const addToast = useToastStore((s) => s.addToast)

  useEffect(() => { setInlineReview(null) }, [trade.id])

  const calc = useMemo(() => calculateTradeMetrics({
    entryPrice: Number(trade.entry_price),
    exitPrice: trade.exit_price != null ? Number(trade.exit_price) : undefined,
    quantity: Number(trade.quantity),
    fees: Number(trade.fees ?? 0),
    plannedStopPrice: trade.original_stop_price != null ? Number(trade.original_stop_price) : (trade.stop_price != null ? Number(trade.stop_price) : undefined),
    currentStopPrice: trade.current_stop_price != null ? Number(trade.current_stop_price) : (trade.stop_price != null ? Number(trade.stop_price) : undefined),
    targetPrice: trade.target_price != null ? Number(trade.target_price) : undefined,
    direction: trade.direction ?? 'LONG',
  }), [trade])

  const originalStopPrice = trade.original_stop_price != null ? Number(trade.original_stop_price) : (trade.stop_price != null ? Number(trade.stop_price) : null)
  const currentStopPrice = trade.current_stop_price != null ? Number(trade.current_stop_price) : (trade.stop_price != null ? Number(trade.stop_price) : null)

  const backendPnl = trade.pnl != null ? Number(trade.pnl) : null
  const pnlValue = backendPnl != null ? backendPnl : calc.netPnl
  const backendRMultiple = trade.r_multiple != null ? Number(trade.r_multiple) : null
  const displayedRMultiple = backendRMultiple != null ? backendRMultiple : calc.rMultiple
  const pnlIsProfit = pnlValue != null && pnlValue >= 0
  const remainingQty = trade.remaining_qty != null ? Number(trade.remaining_qty) : null
  const partialPnl = trade.partial_realized_pnl != null ? Number(trade.partial_realized_pnl) : null
  const showPartialInfo = remainingQty != null && remainingQty < Number(trade.quantity)
  const isOpen = trade.exit_price == null

  const duration = useMemo(() => {
    if (!trade.entry_time) return '—'
    const start = new Date(trade.entry_time).getTime()
    const end = trade.exit_time ? new Date(trade.exit_time).getTime() : Date.now()
    return durationToString(end - start)
  }, [trade.entry_time, trade.exit_time])

  const handleTradeReview = () => {
    reviewMut.mutate(trade.id, {
      onSuccess: (data: TradeReviewResponse) => setInlineReview(data),
    })
  }

  const handleDelete = () => {
    deleteMut.mutate(trade.id, {
      onSuccess: () => {
        addToast({ title: 'Deleted', message: `${trade.symbol} trade deleted.`, variant: 'info' })
        closeTradeForm()
      },
      onError: () => {
        addToast({ title: 'Error', message: 'Failed to delete trade.', variant: 'error' })
      },
    })
  }

  return (
    <div className="space-y-[var(--page-gap)] pb-[max(var(--page-py),env(safe-area-inset-bottom))]">
      <TradeSummaryHeader
        trade={trade}
        isOpen={isOpen}
        pnlIsProfit={pnlIsProfit}
        onEdit={() => openEditTrade(trade.id)}
        onDelete={handleDelete}
        isDeleting={deleteMut.isPending}
      />

      <PnLHero
        pnlValue={pnlValue}
        pnlIsProfit={pnlIsProfit}
        rMultiple={displayedRMultiple}
        partialPnl={partialPnl}
        isOpen={isOpen}
      />

      <DetailSection title="Entry &amp; Exit" icon={CalendarClock}>
        <StatCards
          trade={trade}
          isOpen={isOpen}
          duration={duration}
          showPartialInfo={showPartialInfo}
          remainingQty={remainingQty}
        />
      </DetailSection>

      <DetailSection title="Risk &amp; Reward" icon={Target}>
        <MetricGrid
          calc={calc}
          originalStopPrice={originalStopPrice}
          currentStopPrice={currentStopPrice}
          protectionStatus={trade.stop_loss_status ?? null}
        />
      </DetailSection>

      <DetailSection title="Chart" icon={BarChart3}>
        <ChartTabs trade={trade} />
      </DetailSection>

      <DetailSection title="Notes, Tags &amp; Mistakes" icon={NotebookPen}>
        <div className="space-y-4">
          <div>
            <div className={SECTION_LABEL}>
              <NotebookPen className="w-3.5 h-3.5" />
              Trade notes
            </div>
            <p className="text-[length:var(--text-sm)] text-text-heading whitespace-pre-wrap leading-relaxed">
              {trade.notes || <span className="text-text-faint italic">No notes recorded</span>}
            </p>
          </div>
          <div>
            <div className={SECTION_LABEL}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Review reflection
            </div>
            <p className="text-[length:var(--text-sm)] text-text-heading whitespace-pre-wrap leading-relaxed">
              {trade.review_notes || <span className="text-text-faint italic">No review notes yet</span>}
            </p>
          </div>
          <div>
            <div className={SECTION_LABEL}>
              <Tag className="w-3.5 h-3.5" />
              Tags
            </div>
            {trade.tags && trade.tags.length > 0 ? (
              <div className="mt-1">
                <TagsRow tags={trade.tags} />
              </div>
            ) : (
              <p className="text-[length:var(--text-sm)] text-text-faint italic mt-1">No tags</p>
            )}
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Review" icon={ClipboardCheck}>
        {!isOpen && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[length:var(--text-xs)] text-text-muted uppercase tracking-wider font-display">AI coaching</span>
              <button
                onClick={handleTradeReview}
                disabled={reviewMut.isPending}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[length:var(--text-xs)] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {reviewMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
                Generate
              </button>
            </div>
            {inlineReview ? (
              <AiReviewCard review={inlineReview} />
            ) : reviewMut.isPending ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
                <span className="ml-2 text-xs text-text-muted">Generating...</span>
              </div>
            ) : (
              <EmptyState title="No AI review yet" message="Generate coaching feedback for this closed trade." compact />
            )}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-border">
          <LifecycleReviewPanel trade={trade} />
        </div>
      </DetailSection>
    </div>
  )
}
