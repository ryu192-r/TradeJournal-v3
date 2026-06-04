import { useState, useCallback } from 'react'
import { Button, Drawer, Stack, Badge, Divider } from '@/new-ui'
import { createPartialExit, updateTrade, createStopHistory, pyramidTrade } from '@/lib/endpoints'
import { invalidateTradeDomain } from '@/lib/queryInvalidation'
import { useQueryClient } from '@tanstack/react-query'
import { useToastStore } from '@/store/toastStore'
import { formatCurrency } from '@/utils/format'
import type { ApiTrade } from '@/types'
import { FormInput, FormSelect, FormTextarea } from '../trade-form/components/FormControls'
import '../trade-form/trade-form.css'

export type PositionAction = 'partial_exit' | 'close' | 'protection_stop' | 'pyramid'

interface PositionActionDrawerProps {
  open: boolean
  onClose: () => void
  trade: ApiTrade
  initialAction?: PositionAction
}

function getRemainingQty(trade: ApiTrade): number {
  const v = trade.remaining_qty ?? trade.quantity
  return Math.max(0, Number(v) || 0)
}

function nowLocal(): string {
  const d = new Date()
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const y = ist.getFullYear()
  const m = String(ist.getMonth() + 1).padStart(2, '0')
  const day = String(ist.getDate()).padStart(2, '0')
  const h = String(ist.getHours()).padStart(2, '0')
  const min = String(ist.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

export function PositionActionDrawer({ open, onClose, trade, initialAction }: PositionActionDrawerProps) {
  const [action, setAction] = useState<PositionAction>(initialAction ?? 'partial_exit')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const remaining = getRemainingQty(trade)
  const isOpen = !trade.exit_price && remaining > 0

  // Partial exit state
  const [peQty, setPeQty] = useState('')
  const [pePrice, setPePrice] = useState('')
  const [peTime, setPeTime] = useState(nowLocal)
  const [peNote, setPeNote] = useState('')

  // Close state
  const [closePrice, setClosePrice] = useState('')
  const [closeTime, setCloseTime] = useState(nowLocal)

  // Stop state
  const [stopPrice, setStopPrice] = useState('')
  const [stopType, setStopType] = useState('manual')

  // Pyramid state
  const [pyrPrice, setPyrPrice] = useState('')
  const [pyrQty, setPyrQty] = useState('')
  const [pyrTime, setPyrTime] = useState(nowLocal)
  const [pyrFees, setPyrFees] = useState('')
  const [pyrStop, setPyrStop] = useState('')

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
    setPeQty('')
    setPePrice('')
    setPeTime(nowLocal())
    setPeNote('')
    setClosePrice('')
    setCloseTime(nowLocal())
    setStopPrice('')
    setStopType('manual')
    setPyrPrice('')
    setPyrQty('')
    setPyrTime(nowLocal())
    setPyrFees('')
    setPyrStop('')
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleSuccess = useCallback(() => {
    setSuccess(true)
    void invalidateTradeDomain(qc, trade.id)
    addToast({ title: 'Action completed', message: `${trade.symbol} updated.`, variant: 'success' })
    setTimeout(handleClose, 800)
  }, [qc, addToast, trade.symbol, trade.id, handleClose])

  const submitPartialExit = async () => {
    const qty = Number(peQty)
    const price = Number(pePrice)
    if (!qty || qty <= 0 || qty >= remaining) {
      setError(`Quantity must be between 1 and ${remaining - 1} (partial only).`)
      return
    }
    if (!price || price <= 0) { setError('Exit price must be positive.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await createPartialExit(trade.id, { qty: String(qty), exit_price: String(price), exit_time: peTime + ':00', note: peNote || null })
      handleSuccess()
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Failed') }
    finally { setSubmitting(false) }
  }

  const submitClose = async () => {
    const price = Number(closePrice)
    if (!price || price <= 0) { setError('Close price required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await updateTrade(trade.id, { exit_price: String(price), exit_time: closeTime + ':00' })
      handleSuccess()
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Failed') }
    finally { setSubmitting(false) }
  }

  const submitStop = async () => {
    const price = Number(stopPrice)
    if (!price || price <= 0) { setError('Stop price required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await createStopHistory(trade.id, { stop_type: stopType, price: String(price), timestamp: nowLocal() + ':00' })
      handleSuccess()
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Failed') }
    finally { setSubmitting(false) }
  }

  const submitPyramid = async () => {
    const price = Number(pyrPrice)
    const qty = Number(pyrQty)
    if (!price || price <= 0) { setError('Entry price required.'); return }
    if (!qty || qty <= 0) { setError('Quantity required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await pyramidTrade(trade.id, {
        entry_price: price,
        quantity: qty,
        entry_time: pyrTime ? pyrTime + ':00' : undefined,
        fees: pyrFees ? Number(pyrFees) : undefined,
        stop_price: pyrStop ? Number(pyrStop) : undefined,
      })
      handleSuccess()
    } catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Failed') }
    finally { setSubmitting(false) }
  }

  const STOP_TYPE_OPTIONS = [
    { value: 'manual', label: 'Manual' },
    { value: 'breakeven', label: 'Breakeven' },
    { value: 'trailing', label: 'Trailing' },
  ]

  return (
    <Drawer open={open} onClose={handleClose} title="Position actions" description={`${trade.symbol} · ${remaining} remaining`} side="right">
      <Stack gap="md">
        {!isOpen && (
          <Badge variant="neutral">Trade is closed — view only</Badge>
        )}

        {isOpen && !success && (
          <>
            {/* Action selector */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <ActionTab active={action === 'partial_exit'} onClick={() => { setAction('partial_exit'); setError(null) }}>Partial exit</ActionTab>
              <ActionTab active={action === 'close'} onClick={() => { setAction('close'); setError(null) }}>Close trade</ActionTab>
              <ActionTab active={action === 'protection_stop'} onClick={() => { setAction('protection_stop'); setError(null) }}>Move stop</ActionTab>
              <ActionTab active={action === 'pyramid'} onClick={() => { setAction('pyramid'); setError(null) }}>Pyramid</ActionTab>
            </div>
            <Divider />

            {/* Context */}
            <div className="tjv3-tradeform__metarow"><span>Entry</span><span>{formatCurrency(Number(trade.entry_price))}</span></div>
            <div className="tjv3-tradeform__metarow"><span>Original SL</span><span>{trade.original_stop_price ? formatCurrency(Number(trade.original_stop_price)) : trade.stop_price ? formatCurrency(Number(trade.stop_price)) : 'Not set'}</span></div>
            <div className="tjv3-tradeform__metarow"><span>Current protection</span><span>{trade.current_stop_price ?? trade.stop_price ? formatCurrency(Number(trade.current_stop_price ?? trade.stop_price)) : 'Not set'}{trade.stop_loss_status && trade.stop_loss_status !== 'original' ? ` · ${trade.stop_loss_status}` : ''}</span></div>
            <div className="tjv3-tradeform__metarow"><span>Remaining qty</span><span>{remaining}</span></div>
            <Divider />

            {/* Forms */}
            {action === 'partial_exit' && (
              <Stack gap="sm">
                <FormInput label="Exit quantity" type="number" min={1} max={remaining - 1} step={1} value={peQty} onChange={(e) => setPeQty(e.target.value)} help={`Max: ${remaining - 1} (use Close for full exit)`} required />
                <FormInput label="Exit price (₹)" type="number" step="0.01" value={pePrice} onChange={(e) => setPePrice(e.target.value)} required />
                <FormInput label="Exit time" type="datetime-local" value={peTime} onChange={(e) => setPeTime(e.target.value)} />
                <FormTextarea label="Note" value={peNote} onChange={(e) => setPeNote(e.target.value)} rows={2} placeholder="Optional" />
              </Stack>
            )}

            {action === 'close' && (
              <Stack gap="sm">
                <FormInput label="Close price (₹)" type="number" step="0.01" value={closePrice} onChange={(e) => setClosePrice(e.target.value)} required help={`Closing all ${remaining} remaining shares.`} />
                <FormInput label="Close time" type="datetime-local" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </Stack>
            )}

            {action === 'protection_stop' && (
              <Stack gap="sm">
                <FormSelect label="Stop type" options={STOP_TYPE_OPTIONS} value={stopType} onChange={(e) => setStopType(e.target.value)} />
                <FormInput label="New stop price (₹)" type="number" step="0.01" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} required help="Updates current protection stop. Original SL remains unchanged." />
              </Stack>
            )}

            {action === 'pyramid' && (
              <Stack gap="sm">
                <FormInput label="Entry price (₹)" type="number" step="0.01" value={pyrPrice} onChange={(e) => setPyrPrice(e.target.value)} required help="Price at which you added more shares." />
                <FormInput label="Quantity" type="number" min={1} step={1} value={pyrQty} onChange={(e) => setPyrQty(e.target.value)} required />
                <FormInput label="Entry time" type="datetime-local" value={pyrTime} onChange={(e) => setPyrTime(e.target.value)} />
                <FormInput label="Fees (₹)" type="number" step="0.01" value={pyrFees} onChange={(e) => setPyrFees(e.target.value)} help="Optional" />
                <FormInput label="New stop price (₹)" type="number" step="0.01" value={pyrStop} onChange={(e) => setPyrStop(e.target.value)} help="Optional — updates stop if provided." />
              </Stack>
            )}

            {error && <span style={{ color: 'var(--color-loss)', fontSize: '0.8125rem' }} role="alert">{error}</span>}

            <Button
              variant="primary"
              disabled={submitting}
              onClick={action === 'partial_exit' ? submitPartialExit : action === 'close' ? submitClose : action === 'pyramid' ? submitPyramid : submitStop}
            >
              {submitting ? 'Saving…' : action === 'partial_exit' ? 'Add partial exit' : action === 'close' ? 'Close trade' : action === 'pyramid' ? 'Add pyramid entry' : 'Update stop'}
            </Button>
          </>
        )}

        {success && <Badge variant="success">Done — refreshing data…</Badge>}
      </Stack>
    </Drawer>
  )
}

function ActionTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.375rem 0.75rem',
        borderRadius: '0.5rem',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: active ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
