import { useMemo, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Badge, Button, Divider, Panel, Stack } from '@/new-ui'
import { tradeFormSchema, type TradeFormData, formDataToApiPayload } from '@/schemas/tradeForm'
import { useSetupsQuery } from '@/hooks/useSetupPlaybookQuery'
import { useToastStore } from '@/store/toastStore'
import { formatCurrency } from '@/utils/format'
import type { ApiTrade } from '@/types'
import { FormInput, FormSelect, FormTextarea } from './components/FormControls'
import {
  EXCHANGE_OPTIONS,
  SEGMENT_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  emptyTradeFormValues,
  apiTradeToFormValues,
} from './utils/tradeFormV3Defaults'
import { computeRiskPreview } from './utils/tradeFormV3RiskPreview'
import './trade-form.css'

interface TradeFormV3BodyProps {
  mode: 'create' | 'edit'
  initialData?: ApiTrade
  submitFn: (payload: Record<string, unknown>) => Promise<ApiTrade>
  onSubmitSuccess?: () => void
  onCancel?: () => void
}

const TACTIC_OPTIONS = [
  { value: '', label: '— Select tactic —' },
  { value: 'ORB', label: 'ORB' },
  { value: 'PDH', label: 'PDH' },
  { value: '10-DMA Touch', label: '10-DMA Touch' },
  { value: 'Intraday Reversal', label: 'Intraday Reversal' },
  { value: 'Custom', label: 'Custom' },
]

function money(n: number | null | undefined): string {
  if (n == null) return 'Unavailable'
  return formatCurrency(Math.abs(n))
}

export function TradeFormV3Body({ mode, initialData, submitFn, onSubmitSuccess, onCancel }: TradeFormV3BodyProps) {
  const addToast = useToastStore((s) => s.addToast)
  const { data: setupsData, isLoading: setupsLoading } = useSetupsQuery('active')
  const [serverError, setServerError] = useState<string | null>(null)

  const setupOptions = [
    { value: '', label: '— Select setup —' },
    ...(setupsData?.items?.map((s) => ({ value: s.name, label: s.name })) ?? []),
    { value: 'Custom', label: 'Custom' },
  ]

  const defaultValues = useMemo<TradeFormData>(
    () => (initialData ? apiTradeToFormValues(initialData) : emptyTradeFormValues()),
    [initialData],
  )

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeFormSchema) as never,
    defaultValues,
  })

  const watched = useWatch({
    control,
    name: ['symbol', 'entry_price', 'exit_price', 'quantity', 'fees', 'stop_price', 'target_price', 'exchange', 'product_type'],
  })
  const [symbol, entry_price, exit_price, quantity, fees, stop_price, target_price, exchange, product_type] = watched

  const preview = useMemo(
    () => computeRiskPreview({ entry_price, exit_price, quantity, fees, stop_price, target_price }),
    [entry_price, exit_price, quantity, fees, stop_price, target_price],
  )

  const originalStop = mode === 'edit' ? initialData?.original_stop_price : undefined
  const stopFieldLabel = mode === 'edit' ? 'Current protection stop (₹)' : 'Original stop loss (₹)'
  const stopFieldHelp = mode === 'edit'
    ? 'Updates current/live protection SL only. Original risk SL remains unchanged.'
    : 'Planning/risk SL — seeds original risk and current protection SL.'

  const onSubmit = async (data: TradeFormData) => {
    setServerError(null)
    try {
      await submitFn(formDataToApiPayload(data, { mode }))
      addToast({
        title: mode === 'create' ? 'Trade created' : 'Trade updated',
        message: `${data.symbol} saved.`,
        variant: 'success',
      })
      onSubmitSuccess?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setServerError(message)
      addToast({ title: 'Error', message, variant: 'error' })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="tjv3-tradeform" data-testid="trade-form-v3">
      <div className="tjv3-tradeform__main">
        {serverError && (
          <Panel variant="muted">
            <span style={{ color: 'var(--color-loss)', fontSize: '0.8125rem' }} role="alert">{serverError}</span>
          </Panel>
        )}

        {/* 1. Trade Identity */}
        <Panel title="Trade identity" description="What instrument was traded.">
          <div className="tjv3-formgrid">
            <FormInput label="Symbol" required placeholder="e.g. RELIANCE" {...register('symbol')} error={errors.symbol?.message} />
            <FormInput label="Entry time" type="datetime-local" required {...register('entry_time')} error={errors.entry_time?.message} />
            <Controller
              name="setup"
              control={control}
              render={({ field }) => (
                <FormSelect label="Setup" options={setupOptions} {...field} value={field.value || ''} disabled={setupsLoading} error={errors.setup?.message} />
              )}
            />
          </div>
        </Panel>

        {/* 2. Execution */}
        <Panel title="Execution" description="Entry, size, and exit (LONG only).">
          <div className="tjv3-formgrid">
            <FormInput label="Entry price (₹)" required type="number" step="0.01" placeholder="0.00" {...register('entry_price')} error={errors.entry_price?.message} />
            <FormInput label="Quantity" required type="number" step="1" placeholder="0" {...register('quantity')} error={errors.quantity?.message} />
            <FormInput label="Exit price (₹)" type="number" step="0.01" placeholder="Optional" {...register('exit_price')} error={errors.exit_price?.message} />
            <FormInput label="Exit time" type="datetime-local" {...register('exit_time')} error={errors.exit_time?.message} />
            <FormInput label="Fees & charges (₹)" type="number" step="0.01" placeholder="0.00" {...register('fees')} error={errors.fees?.message} />
          </div>
        </Panel>

        {/* 3. Risk & Plan */}
        <Panel title="Risk & plan" description={mode === 'edit' ? 'Current protection stop and original risk reference.' : 'Original planned stop and target.'}>
          <div className="tjv3-formgrid">
            <FormInput label={stopFieldLabel} type="number" step="0.01" placeholder="e.g. 95" help={stopFieldHelp} {...register('stop_price')} error={errors.stop_price?.message} />
            <FormInput label="Target price (₹)" type="number" step="0.01" placeholder="e.g. 120" {...register('target_price')} error={errors.target_price?.message} />
          </div>
          {mode === 'edit' && originalStop != null && (
            <>
              <Divider />
              <div className="tjv3-tradeform__metarow">
                <span>Original SL (read-only)</span>
                <span>{formatCurrency(Number(originalStop))}</span>
              </div>
              <span className="tjv3-formfield__help">Original risk plan is preserved on edit.</span>
            </>
          )}
        </Panel>

        {/* 4. Market Details */}
        <Panel title="Market details" description="Used for broker charge estimates and reporting. Does not change trade P&L.">
          <div className="tjv3-formgrid">
            <Controller name="exchange" control={control} render={({ field }) => (
              <FormSelect label="Exchange" options={EXCHANGE_OPTIONS} {...field} value={field.value || 'UNKNOWN'} />
            )} />
            <Controller name="segment" control={control} render={({ field }) => (
              <FormSelect label="Segment" options={SEGMENT_OPTIONS} {...field} value={field.value || 'UNKNOWN'} />
            )} />
            <Controller name="product_type" control={control} render={({ field }) => (
              <FormSelect label="Product type" options={PRODUCT_TYPE_OPTIONS} {...field} value={field.value || 'UNKNOWN'} />
            )} />
            <FormInput label="Executed order count" type="number" min={1} step={1} placeholder="Optional" help="Optional. Use if broker order count differs." {...register('executed_order_count')} error={errors.executed_order_count?.message} />
          </div>
        </Panel>

        {/* 5. Setup & Notes */}
        <Panel title="Setup & notes" description="Journal context.">
          <Stack gap="md">
            <div className="tjv3-formgrid">
              <Controller name="tactic" control={control} render={({ field }) => (
                <FormSelect label="Tactic" options={TACTIC_OPTIONS} {...field} value={field.value || ''} error={errors.tactic?.message} />
              )} />
              <FormInput label="Tags (comma-separated)" placeholder="e.g. A+, breakout" {...register('tags')} error={errors.tags?.message} />
            </div>
            <FormTextarea label="Notes" rows={4} placeholder="Thesis, observations, lessons…" {...register('notes')} error={errors.notes?.message} />
          </Stack>
        </Panel>

        <div className="tjv3-tradeform__actions">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>}
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting && <Loader2 size={16} className="tjv3-spin" />}
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Save trade' : 'Update trade'}
          </Button>
        </div>
      </div>

      {/* Preview panel */}
      <div className="tjv3-tradeform__preview">
        <Panel title="Preview" description="Live plan summary." variant="elevated">
          <Stack gap="sm">
            <Row label="Symbol" value={symbol || 'Unavailable'} />
            <Row label="Direction" value="LONG" />
            <Row label="Entry" value={entry_price ? formatCurrency(Number(entry_price)) : 'Unavailable'} />
            <Row label="Quantity" value={quantity || 'Unavailable'} />
            <Row label={mode === 'edit' ? 'Current protection' : 'Original SL'} value={stop_price ? formatCurrency(Number(stop_price)) : 'Not set'} />
            <Row label="Target" value={target_price ? formatCurrency(Number(target_price)) : 'Not set'} />
            <Divider />
            <Row label="Planned risk" value={preview.hasEntryQty && preview.hasStop ? money(preview.riskAmount) : 'Unavailable'} />
            <Row label="Planned reward" value={preview.hasEntryQty && preview.hasTarget ? money(preview.plannedRewardAmount) : 'Unavailable'} />
            <Row label="Risk : reward" value={preview.riskRewardRatio != null ? `1:${preview.riskRewardRatio.toFixed(2)}` : 'Unavailable'} />
            <Divider />
            <Row label="Market" value={[exchange, product_type].filter((v) => v && v !== 'UNKNOWN').join(' · ') || 'Not set'} />
          </Stack>
          {preview.warnings.length > 0 && (
            <Stack gap="sm" style={{ marginTop: '0.75rem' }}>
              {preview.warnings.map((w, i) => <Badge key={i} variant="warning">{w}</Badge>)}
            </Stack>
          )}
        </Panel>
      </div>
    </form>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="tjv3-tradeform__metarow">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
