import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import {
  tradeFormSchema,
  type TradeFormData,
  isoToDatetimeLocal,
  formDataToApiPayload,
} from '@/schemas/tradeForm'
import { useToastStore } from '@/store/toastStore'
import type { ApiTrade } from '@/types'
import { useSetupsQuery } from '@/hooks/useSetupPlaybookQuery'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save, Loader2, Target, ShieldAlert, Info } from 'lucide-react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { calculateTradeMetrics } from '@/utils/calculations'
import { formatCurrency } from '@/utils/format'
import { useMemo } from 'react'

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
    stop_price: trade.stop_price != null ? String(trade.stop_price) : undefined,
    target_price: trade.target_price != null ? String(trade.target_price) : undefined,
    notes: trade.notes || undefined,
  }
}

function parseInput(v: string | undefined): number | undefined {
  if (v == null || v === '') return undefined
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return formatCurrency(Math.abs(n))
}

function fmtRatio(n: number | null): string {
  if (n == null) return '—'
  return `1:${n.toFixed(2)}`
}

function fmtR(n: number | null): string {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}R`
}

const CARD = 'bg-card rounded-2xl border border-border p-[var(--page-px)] animate-card-in'

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
        entry_time: isoToDatetimeLocal(new Date().toISOString()),
        exit_time: undefined,
        fees: '0',
        setup: undefined,
        tactic: undefined,
        stop_price: undefined,
        target_price: undefined,
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
    return calculateTradeMetrics({
      entryPrice: parseInput(entryPrice as string | undefined),
      exitPrice: parseInput(exitPrice as string | undefined),
      quantity: parseInput(quantity as string | undefined),
      fees: parseInput(fees as string | undefined),
      stopPrice: parseInput(stopPrice as string | undefined),
      targetPrice: parseInput(targetPrice as string | undefined),
      direction: 'LONG',
    })
  }, [entryPrice, exitPrice, quantity, fees, stopPrice, targetPrice])

  const hasEntryQty = parseInput(entryPrice as string | undefined) != null && parseInput(quantity as string | undefined) != null
  const hasExit = parseInput(exitPrice as string | undefined) != null
  const hasStop = parseInput(stopPrice as string | undefined) != null
  const hasTarget = parseInput(targetPrice as string | undefined) != null
  const hasRiskReward = hasStop && hasTarget
  const hasPnl = hasEntryQty && hasExit

  const onSubmit = async (data: TradeFormData) => {
    if (!submitFn) {
      addToast({
        title: 'Error',
        message: 'No submit function provided',
        variant: 'error',
      })
      return
    }
    try {
      const payload = formDataToApiPayload(data)
      await submitFn(payload)
      addToast({
        title: mode === 'create' ? 'Trade created' : 'Trade updated',
          message:
            mode === 'create'
              ? `${data.symbol} trade saved.`
              : `${data.symbol} trade updated successfully.`,
        variant: 'success',
      })
      if (mode === 'create') {
        reset()
      }
      onSubmitSuccess?.()
    } catch (err: unknown) {
      let message = 'Something went wrong. Please try again.'
      if (err instanceof Error) {
        message = err.message
      }
      addToast({ title: 'Error', message, variant: 'error' })
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-text-heading">
            {mode === 'create' ? 'New Trade' : 'Edit Trade'}
          </h2>
          {onCancel && (
            <GlassButton variant="ghost" size="sm" onClick={onCancel} type="button">
              Cancel
            </GlassButton>
          )}
        </div>

        {/* Core Trade Details */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-accent">Core Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassInput
              label="Symbol"
              placeholder="e.g. RELIANCE"
              {...register('symbol')}
              error={errors.symbol?.message}
            />
            <GlassInput
              label="Entry Price (₹)"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('entry_price')}
              error={errors.entry_price?.message}
            />
            <GlassInput
              label="Quantity"
              type="number"
              step="1"
              placeholder="0"
              {...register('quantity')}
              error={errors.quantity?.message}
            />
            <GlassInput
              label="Entry Time"
              type="datetime-local"
              {...register('entry_time')}
              error={errors.entry_time?.message}
            />
            <GlassInput
              label="Exit Time (optional)"
              type="datetime-local"
              {...register('exit_time')}
              error={errors.exit_time?.message}
            />
          </div>
        </div>

        {/* Risk & Reward */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-accent">Risk & Reward</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassInput
              label="Stop Price (₹)"
              type="number"
              step="0.01"
              placeholder="Optional"
              {...register('stop_price')}
              error={errors.stop_price?.message}
            />
            <GlassInput
              label="Target Price (₹)"
              type="number"
              step="0.01"
              placeholder="Optional"
              {...register('target_price')}
              error={errors.target_price?.message}
            />
            <GlassInput
              label="Exit Price (₹)"
              type="number"
              step="0.01"
              placeholder="Optional"
              {...register('exit_price')}
              error={errors.exit_price?.message}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GlassInput
              label="Fees & Charges (₹)"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('fees')}
              error={errors.fees?.message}
            />
          </div>
        </div>

        {/* ── Live Calculation Preview ── */}
        {hasEntryQty && (
          <div className={CARD}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-xs text-accent flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Calculated Metrics (Live Preview)
              </h3>
              {!hasPnl && !hasRiskReward && (
                <span className="text-[10px] text-text-muted font-data">
                  Enter exit, stop &amp; target for more
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
              {/* Planned Risk */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1 text-[9px] tracking-wider uppercase text-text-muted">
                  <ShieldAlert className="w-3 h-3 text-loss" />
                  Risk Amount
                </div>
                <span className={`text-xs font-data font-medium ${hasStop && liveMetrics.riskAmount != null ? 'text-loss' : 'text-text-faint'}`}>
                  {hasStop ? fmt(liveMetrics.riskAmount) : 'Not enough data'}
                </span>
              </div>

              {/* Planned Reward */}
              <div className="flex flex-col gap-0.5">
                <div className="text-[9px] tracking-wider uppercase text-text-muted">
                  Planned Reward
                </div>
                <span className={`text-xs font-data font-medium ${hasTarget && liveMetrics.plannedRewardAmount != null ? 'text-profit' : 'text-text-faint'}`}>
                  {hasTarget ? fmt(liveMetrics.plannedRewardAmount) : 'Not enough data'}
                </span>
              </div>

              {/* Planned Risk:Reward */}
              <div className="flex flex-col gap-0.5">
                <div className="text-[9px] tracking-wider uppercase text-text-muted">
                  Planned Risk:Reward
                </div>
                <span className={`text-xs font-data font-medium ${liveMetrics.isValidForRiskReward ? 'text-text-heading' : 'text-text-faint'}`}>
                  {liveMetrics.isValidForRiskReward ? fmtRatio(liveMetrics.riskRewardRatio) : 'Not enough data'}
                </span>
              </div>

              {/* Gross P&L (only when exit is present) */}
              <div className="flex flex-col gap-0.5">
                <div className="text-[9px] tracking-wider uppercase text-text-muted">
                  Gross P&amp;L
                </div>
                <span className={`text-xs font-data font-medium ${hasPnl && liveMetrics.grossPnl != null ? (liveMetrics.grossPnl >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
                  {hasPnl ? fmt(liveMetrics.grossPnl) : 'Not enough data'}
                </span>
              </div>

              {/* Net P&L */}
              <div className="flex flex-col gap-0.5">
                <div className="text-[9px] tracking-wider uppercase text-text-muted">
                  Net P&amp;L
                </div>
                <span className={`text-xs font-data font-medium ${hasPnl && liveMetrics.netPnl != null ? (liveMetrics.netPnl >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
                  {hasPnl ? fmt(liveMetrics.netPnl) : 'Not enough data'}
                </span>
              </div>

              {/* Actual R-Multiple */}
              <div className="flex flex-col gap-0.5">
                <div className="text-[9px] tracking-wider uppercase text-text-muted">
                  Actual R Multiple
                </div>
                <span className={`text-xs font-data font-medium ${liveMetrics.rMultiple != null ? (liveMetrics.rMultiple >= 0 ? 'text-profit' : 'text-loss') : 'text-text-faint'}`}>
                  {liveMetrics.rMultiple != null ? fmtR(liveMetrics.rMultiple) : hasStop && hasPnl ? 'Stop invalid' : 'Not enough data'}
                </span>
              </div>
            </div>

            {/* Warnings */}
            {liveMetrics.warnings.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {liveMetrics.warnings.map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <Info className="w-2.5 h-2.5" />
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Setup & Tactic */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-accent">Setup & Tactic</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              name="setup"
              control={control}
              render={({ field }) => (
                setupsLoading ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated/50 text-xs text-text-muted">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading setups...
                  </div>
                ) : (
                  <GlassSelect
                    label="Setup Type"
                    options={setupOptions}
                    placeholder="Select setup..."
                    {...field}
                    value={field.value || ''}
                    error={errors.setup?.message}
                  />
                )
              )}
            />
            <Controller
              name="tactic"
              control={control}
              render={({ field }) => (
                <GlassSelect
                  label="Tactic"
                  options={TACTIC_OPTIONS}
                  placeholder="Select tactic..."
                  {...field}
                  value={field.value || ''}
                  error={errors.tactic?.message}
                />
              )}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-accent">Notes</h3>
          <GlassTextarea
            label=""
            rows={4}
            placeholder="Trade notes, observations, lessons learned..."
            {...register('notes')}
            error={errors.notes?.message}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {mode === 'create' && (
            <GlassButton
              variant="ghost"
              size="md"
              type="button"
              onClick={() => reset()}
              disabled={isSubmitting}
            >
              Reset
            </GlassButton>
          )}
          <GlassButton
            variant="accent"
            size="md"
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            <Save className="w-4 h-4" />
            {isSubmitting
              ? 'Saving...'
              : mode === 'create'
              ? 'Save Trade'
              : 'Update Trade'}
          </GlassButton>
        </div>
      </form>
    </div>
  )
}
