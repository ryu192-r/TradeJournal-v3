import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import { FormActions, SubmitButton } from '@/components/ui/FormComponents'
import {
  tradeFormSchema,
  type TradeFormData,
  isoToDatetimeLocal,
  nowIST,
  formDataToApiPayload,
} from '@/schemas/tradeForm'
import { useToastStore } from '@/store/toastStore'
import type { ApiTrade } from '@/types'
import { useSetupsQuery } from '@/hooks/useSetupPlaybookQuery'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, ShieldAlert, Info, ArrowUpRight, DollarSign, Tag, NotebookPen, TrendingUp } from 'lucide-react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { calculateTradeMetrics } from '@/utils/calculations'
import { formatCurrency } from '@/utils/format'
import { useMemo, type ComponentType, type ReactNode } from 'react'

const TACTIC_OPTIONS = [
  { value: '', label: '— Select Tactic —' },
  { value: 'ORB', label: 'ORB' },
  { value: 'PDH', label: 'PDH' },
  { value: '10-DMA Touch', label: '10-DMA Touch' },
  { value: 'Intraday Reversal', label: 'Intraday Reversal' },
  { value: 'Custom', label: 'Custom' },
]

interface TradeEntryFormProps {
  mode?: 'create' | 'edit'
  initialData?: ApiTrade
  onSubmitSuccess?: () => void
  onCancel?: () => void
  submitFn?: (payload: Record<string, unknown>) => Promise<ApiTrade>
}

function apiTradeToFormData(trade: ApiTrade): TradeFormData {
  const tagsStr = trade.tags ? trade.tags.join(', ') : undefined
  const currentStop = trade.current_stop_price ?? trade.stop_price ?? trade.original_stop_price
  return {
    symbol: trade.symbol,
    entry_price: String(trade.entry_price),
    exit_price: trade.exit_price != null ? String(trade.exit_price) : undefined,
    quantity: String(Number(trade.quantity)),
    entry_time: isoToDatetimeLocal(trade.entry_time),
    exit_time: isoToDatetimeLocal(trade.exit_time),
    fees: String(trade.fees ?? 0),
    setup: trade.setup || undefined,
    tactic: trade.tactic || undefined,
    stop_price: currentStop != null ? String(currentStop) : undefined,
    target_price: trade.target_price != null ? String(trade.target_price) : undefined,
    tags: tagsStr,
    notes: trade.notes || undefined,
  }
}

function parseInput(v: string | undefined): number | undefined {
  if (v == null || v === '') return undefined
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

function formatSignCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return sign + formatCurrency(Math.abs(n))
}

/* ── Section Header ── */

function SectionTitle({ icon: Icon, title, subtitle }: { icon: ComponentType<{ className?: string }>; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon className="w-3.5 h-3.5 text-accent shrink-0" />}
      <div>
        <h3 className="font-display text-[length:var(--text-sm)] text-text-heading">{title}</h3>
        {subtitle && <p className="text-[10px] text-text-muted font-data leading-tight">{subtitle}</p>}
      </div>
    </div>
  )
}

/* ── Metrics Preview ── */

function MetricCell({ label, children, tone }: { label: string; children: ReactNode; tone?: 'profit' | 'loss' | 'warning' | 'neutral' }) {
  const color = tone === 'profit' ? 'text-profit' : tone === 'loss' ? 'text-loss' : tone === 'warning' ? 'text-gold' : tone === 'neutral' ? 'text-text-heading' : 'text-text-faint'
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[9px] tracking-wider uppercase text-text-muted">{label}</span>
      <span className={`text-xs font-data font-medium ${color}`}>{children}</span>
    </div>
  )
}

export function TradeEntryForm({
  mode = 'create',
  initialData,
  onSubmitSuccess,
  onCancel,
  submitFn,
}: TradeEntryFormProps) {
  const addToast = useToastStore((s) => s.addToast)
  const { data: setupsData, isLoading: setupsLoading } = useSetupsQuery('active')

  const setupOptions = [
    { value: '', label: '— Select Setup —' },
    ...(setupsData?.items?.map((s) => ({ value: s.name, label: s.name })) ?? []),
    { value: 'Custom', label: 'Custom' },
  ]

  const defaultValues: TradeFormData = initialData
    ? apiTradeToFormData(initialData)
    : {
        symbol: '',
        entry_price: '',
        exit_price: undefined,
        quantity: '',
        entry_time: nowIST(),
        exit_time: undefined,
        fees: '0',
        setup: undefined,
        tactic: undefined,
        stop_price: undefined,
        target_price: undefined,
        tags: undefined,
        notes: undefined,
      }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeFormSchema) as never,
    defaultValues,
  })

  const [entryPrice, exitPrice, quantity, fees, stopPrice, targetPrice] = useWatch({
    control,
    name: ['entry_price', 'exit_price', 'quantity', 'fees', 'stop_price', 'target_price'],
  })

  const liveMetrics = useMemo(() => {
    const currentStop = parseInput(stopPrice as string | undefined)
    const plannedStop = mode === 'edit'
      ? parseInput(initialData?.original_stop_price ?? initialData?.stop_price ?? undefined) ?? currentStop
      : currentStop
    return calculateTradeMetrics({
      entryPrice: parseInput(entryPrice as string | undefined),
      exitPrice: parseInput(exitPrice as string | undefined),
      quantity: parseInput(quantity as string | undefined),
      fees: parseInput(fees as string | undefined),
      plannedStopPrice: plannedStop,
      currentStopPrice: currentStop,
      targetPrice: parseInput(targetPrice as string | undefined),
      direction: 'LONG',
    })
  }, [entryPrice, exitPrice, quantity, fees, stopPrice, targetPrice, mode, initialData])

  const hasEntry = parseInput(entryPrice as string | undefined) != null
  const hasQty = parseInput(quantity as string | undefined) != null
  const hasEntryQty = hasEntry && hasQty
  const hasExit = parseInput(exitPrice as string | undefined) != null
  const hasStop = parseInput(stopPrice as string | undefined) != null
  const hasTarget = parseInput(targetPrice as string | undefined) != null

  const onSubmit = async (data: TradeFormData) => {
    if (!submitFn) {
      addToast({ title: 'Error', message: 'No submit function provided', variant: 'error' })
      return
    }
    try {
      const payload = formDataToApiPayload(data, { mode })
      await submitFn(payload)
      addToast({
        title: mode === 'create' ? 'Trade created' : 'Trade updated',
        message: mode === 'create'
          ? `${data.symbol} trade saved.`
          : `${data.symbol} trade updated successfully.`,
        variant: 'success',
      })
      if (mode === 'create') reset()
      onSubmitSuccess?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      addToast({ title: 'Error', message, variant: 'error' })
    }
  }

  const inputGrid = 'grid grid-cols-1 sm:grid-cols-2 gap-3'
  const inputGrid3 = 'grid grid-cols-1 sm:grid-cols-3 gap-3'

  return (
    <div className="bg-card rounded-2xl border border-border p-[var(--page-px)] sm:p-6 max-w-4xl mx-auto animate-card-in">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg sm:text-xl text-text-heading">
            {mode === 'create' ? 'New Trade' : 'Edit Trade'}
          </h2>
          {onCancel && (
            <GlassButton variant="ghost" size="sm" onClick={onCancel} type="button">
              Cancel
            </GlassButton>
          )}
        </div>

        {/* ── 1. Trade Basics ── */}
        <div>
          <SectionTitle icon={DollarSign} title="Trade Basics" subtitle="Symbol, entry, and position size" />
          <div className={inputGrid}>
            <GlassInput label="Symbol" placeholder="e.g. RELIANCE" {...register('symbol')} error={errors.symbol?.message} />
            <GlassInput label="Entry Price (₹)" type="number" step="0.01" placeholder="0.00" {...register('entry_price')} error={errors.entry_price?.message} />
            <GlassInput label="Quantity" type="number" step="1" placeholder="0" {...register('quantity')} error={errors.quantity?.message} />
            <GlassInput label="Entry Time" type="datetime-local" {...register('entry_time')} error={errors.entry_time?.message} />
          </div>
        </div>

        {/* ── 2. Risk Plan ── */}
        <div>
          <SectionTitle icon={ShieldAlert} title="Risk Plan" subtitle="Stop loss and target are optional — add when ready" />
          <div className={inputGrid}>
            <GlassInput label="Stop Loss (₹)" type="number" step="0.01" placeholder="e.g. 95" {...register('stop_price')} error={errors.stop_price?.message} />
            <GlassInput label="Target Price (₹)" type="number" step="0.01" placeholder="e.g. 120" {...register('target_price')} error={errors.target_price?.message} />
          </div>
        </div>

        {/* ── 3. Result ── */}
        <div>
          <SectionTitle icon={ArrowUpRight} title="Result" subtitle="Exit price, fees, and exit time — when the trade is finished" />
          <div className={inputGrid3}>
            <GlassInput label="Exit Price (₹)" type="number" step="0.01" placeholder="Optional" {...register('exit_price')} error={errors.exit_price?.message} />
            <GlassInput label="Fees & Charges (₹)" type="number" step="0.01" placeholder="0.00" {...register('fees')} error={errors.fees?.message} />
            <GlassInput label="Exit Time" type="datetime-local" {...register('exit_time')} error={errors.exit_time?.message} />
          </div>
        </div>

        {/* ── 4. Live Metrics Preview ── */}
        <div>
          <SectionTitle icon={TrendingUp} title="Calculated Metrics" subtitle="Updates as you type" />
          {!hasEntryQty ? (
            <div className="rounded-xl border border-border bg-bg-elevated/20 p-3 text-center">
              <p className="text-[length:var(--text-xs)] text-text-faint">Enter symbol, entry price, and quantity to see metrics</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-bg-elevated/20 p-[var(--page-px)]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
                <MetricCell label="Planned Risk" tone="loss">
                  {hasStop && liveMetrics.riskAmount != null ? formatCurrency(Math.abs(liveMetrics.riskAmount)) : 'Enter stop'}
                </MetricCell>
                <MetricCell label="Planned Reward" tone="profit">
                  {hasTarget && liveMetrics.plannedRewardAmount != null ? formatCurrency(liveMetrics.plannedRewardAmount) : 'Enter target'}
                </MetricCell>
                <MetricCell label="Planned Risk:Reward" tone="neutral">
                  {liveMetrics.isValidForRiskReward ? `1:${liveMetrics.riskRewardRatio!.toFixed(2)}` : 'Need stop + target'}
                </MetricCell>
                <MetricCell label="Gross P&L" tone={hasExit && liveMetrics.grossPnl != null ? (liveMetrics.grossPnl >= 0 ? 'profit' : 'loss') : undefined}>
                  {hasExit ? formatSignCurrency(liveMetrics.grossPnl) : 'Enter exit'}
                </MetricCell>
                <MetricCell label="Net P&L" tone={hasExit && liveMetrics.netPnl != null ? (liveMetrics.netPnl >= 0 ? 'profit' : 'loss') : undefined}>
                  {hasExit ? formatSignCurrency(liveMetrics.netPnl) : 'Enter exit'}
                </MetricCell>
                <MetricCell label="Actual R Multiple" tone={liveMetrics.rMultiple != null ? (liveMetrics.rMultiple >= 0 ? 'profit' : 'loss') : undefined}>
                  {liveMetrics.rMultiple != null
                    ? `${liveMetrics.rMultiple >= 0 ? '+' : ''}${liveMetrics.rMultiple.toFixed(2)}R`
                    : hasStop && hasExit ? 'Invalid stop' : 'Need stop + exit'}
                </MetricCell>
              </div>
              {liveMetrics.warnings.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {liveMetrics.warnings.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      <Info className="w-2 h-2" />{w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 5. Classification ── */}
        <div>
          <SectionTitle icon={Tag} title="Classification" subtitle="Setup, tactic, and tags" />
          <div className={inputGrid}>
            <Controller
              name="setup"
              control={control}
              render={({ field }) => (
                setupsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated/50 text-xs text-text-muted">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading setups...
                  </div>
                ) : (
                  <GlassSelect label="Setup" options={setupOptions} placeholder="Select setup..." {...field} value={field.value || ''} error={errors.setup?.message} />
                )
              )}
            />
            <Controller
              name="tactic"
              control={control}
              render={({ field }) => (
                <GlassSelect label="Tactic" options={TACTIC_OPTIONS} placeholder="Select tactic..." {...field} value={field.value || ''} error={errors.tactic?.message} />
              )}
            />
            <div className="sm:col-span-2">
              <GlassInput label="Tags (comma-separated)" placeholder="e.g. A+, earnings, breakout" {...register('tags')} error={errors.tags?.message} />
            </div>
          </div>
        </div>

        {/* ── 6. Notes ── */}
        <div>
          <SectionTitle icon={NotebookPen} title="Notes & Review" subtitle="Trade thesis, observations, mistakes, lessons learned" />
          <GlassTextarea label="Notes" rows={4} placeholder="What was your thesis? What went well? What would you change?..." {...register('notes')} error={errors.notes?.message} />
        </div>

        {/* Actions */}
        <FormActions sticky>
          {mode === 'create' && (
            <GlassButton variant="ghost" size="md" type="button" onClick={() => reset()} disabled={isSubmitting}>
              Reset
            </GlassButton>
          )}
          <SubmitButton
            isSubmitting={isSubmitting}
            label={mode === 'create' ? 'Save Trade' : 'Update Trade'}
            submittingLabel="Saving..."
          />
        </FormActions>
      </form>
    </div>
  )
}
