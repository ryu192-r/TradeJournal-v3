import { GlassButton } from '@/components/ui/GlassButton'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassSelect } from '@/components/ui/GlassSelect'
import { GlassTagInput } from '@/components/ui/GlassTagInput'
import { GlassTextarea } from '@/components/ui/GlassTextarea'
import {
  tradeFormSchema,
  type TradeFormData,
  isoToDatetimeLocal,
  formDataToApiPayload,
} from '@/schemas/tradeForm'
import { useToastStore } from '@/store/toastStore'
import type { ApiTrade, BackendTradeStatus } from '@/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Save } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'

const DIRECTION_OPTIONS = [
  { value: 'LONG', label: 'LONG' },
  { value: 'SHORT', label: 'SHORT' },
]

const SETUP_OPTIONS = [
  { value: '', label: '— Select Setup —' },
  { value: 'EP', label: 'EP' },
  { value: 'Momentum Burst', label: 'Momentum Burst' },
  { value: 'Pullback', label: 'Pullback' },
  { value: 'Reversal', label: 'Reversal' },
  { value: 'IPO', label: 'IPO' },
  { value: 'Gap Up', label: 'Gap Up' },
  { value: 'Parabolic Long', label: 'Parabolic Long' },
  { value: 'Custom', label: 'Custom' },
]

const TACTIC_OPTIONS = [
  { value: '', label: '— Select Tactic —' },
  { value: 'ORB', label: 'ORB' },
  { value: 'PDH', label: 'PDH' },
  { value: '10-DMA Touch', label: '10-DMA Touch' },
  { value: 'Intraday Reversal', label: 'Intraday Reversal' },
  { value: 'Custom', label: 'Custom' },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'analytics', label: 'Analytics' },
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
    direction: trade.direction as 'LONG' | 'SHORT',
    entry_price: String(trade.entry_price),
    exit_price: trade.exit_price != null ? String(trade.exit_price) : undefined,
    quantity: String(trade.quantity),
    entry_time: isoToDatetimeLocal(trade.entry_time),
    exit_time: isoToDatetimeLocal(trade.exit_time),
    fees: String(trade.fees ?? 0),
    setup: trade.setup || undefined,
    tactic: trade.tactic || undefined,
    stop_price: trade.stop_price != null ? String(trade.stop_price) : undefined,
    target_price: trade.target_price != null ? String(trade.target_price) : undefined,
    r_multiple: trade.r_multiple != null ? String(trade.r_multiple) : undefined,
    notes: trade.notes || undefined,
    tags: trade.tags || [],
    status: (trade.status as BackendTradeStatus) ?? 'draft',
  }
}

export function TradeEntryForm({
  mode = 'create',
  initialData,
  onSubmitSuccess,
  onCancel,
  submitFn,
}: TradeEntryFormProps) {
  const addToast = useToastStore((s) => s.addToast)

  const defaultValues: TradeFormData = initialData
    ? apiTradeToFormData(initialData)
    : {
        symbol: '',
        direction: 'LONG',
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
        r_multiple: undefined,
        notes: undefined,
        tags: [],
        status: 'draft',
      }

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeFormSchema) as never,
    defaultValues,
  })

  const direction = watch('direction')

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
            ? `${data.symbol} ${data.direction} trade saved.`
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
            <Controller
              name="direction"
              control={control}
              render={({ field }) => (
                <GlassSelect
                  label="Direction"
                  options={DIRECTION_OPTIONS}
                  {...field}
                  error={errors.direction?.message}
                />
              )}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <GlassInput
              label="R-Multiple"
              type="number"
              step="0.01"
              placeholder="Auto or manual"
              {...register('r_multiple')}
              error={errors.r_multiple?.message}
            />
            <GlassInput
              label="Fees (₹)"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('fees')}
              error={errors.fees?.message}
            />
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <GlassSelect
                  label="Status"
                  options={STATUS_OPTIONS}
                  {...field}
                  error={errors.status?.message}
                />
              )}
            />
          </div>
        </div>

        {/* Setup & Tactic */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-accent">Setup & Tactic</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              name="setup"
              control={control}
              render={({ field }) => (
                <GlassSelect
                  label="Setup Type"
                  options={SETUP_OPTIONS}
                  placeholder="Select setup..."
                  {...field}
                  value={field.value || ''}
                  error={errors.setup?.message}
                />
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

        {/* Tags */}
        <div className="space-y-4">
          <h3 className="font-display text-sm text-accent">Tags</h3>
          <Controller
            name="tags"
            control={control}
            render={({ field }) => (
              <GlassTagInput
                value={field.value}
                onChange={field.onChange}
                placeholder="Add tags..."
                error={errors.tags?.message}
              />
            )}
          />
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

        {/* Direction summary hint */}
        {direction && (
          <div className="rounded-lg border border-border bg-bg-elevated/40 px-4 py-3 text-sm text-text">
            <span className="font-medium text-text-heading">Direction summary: </span>
            {direction === 'LONG'
              ? 'Profit when price goes UP. Stop loss should be BELOW entry.'
              : 'Profit when price goes DOWN. Stop loss should be ABOVE entry.'}
          </div>
        )}

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
