import { z } from 'zod'

export const tradeFormSchema = z.object({
  symbol: z
    .string()
    .min(1, 'Symbol is required')
    .max(20, 'Symbol too long')
    .toUpperCase(),
  entry_price: z.string().min(1, 'Entry price is required'),
  exit_price: z.string().optional(),
  quantity: z.string().min(1, 'Quantity is required'),
  entry_time: z.string().min(1, 'Entry time is required'),
  exit_time: z.string().optional(),
  fees: z.string().optional().default('0'),
  setup: z.string().optional(),
  tactic: z.string().optional(),
  stop_price: z.string().optional(),
  target_price: z.string().optional(),
  tags: z.string().optional(),
  notes: z.string().optional(),
})

export type TradeFormData = z.infer<typeof tradeFormSchema>

/**
 * Returns current IST time formatted for datetime-local input (YYYY-MM-DDTHH:mm).
 * Uses Intl.DateTimeFormat with Asia/Kolkata for correct IST regardless of browser timezone.
 */
export function nowIST(): string {
  const d = new Date()
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const year = ist.getFullYear()
  const month = String(ist.getMonth() + 1).padStart(2, '0')
  const day = String(ist.getDate()).padStart(2, '0')
  const hours = String(ist.getHours()).padStart(2, '0')
  const mins = String(ist.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}

/**
 * Convert a backend naive IST datetime string to a datetime-local input value.
 * Backend stores naive IST (e.g. "2025-05-21T09:16:00").
 * We strip any timezone suffix and keep only YYYY-MM-DDTHH:mm for the input.
 * No conversion — naive IST in, naive IST out.
 */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  // Strip timezone suffix (Z, +05:30, etc.) — backend returns naive IST strings
  const stripped = iso.replace(/[Zz]$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
  // Keep only YYYY-MM-DDTHH:mm for datetime-local input
  return stripped.slice(0, 16)
}

/**
 * Convert a datetime-local input value (YYYY-MM-DDTHH:mm) to a backend naive IST string.
 * No timezone conversion — we store and send exactly what the user entered.
 * Append seconds (:00) since datetime-local doesn't include them.
 */
export function datetimeLocalToIso(local: string | undefined): string | undefined {
  if (!local) return undefined
  // Ensure seconds are present: YYYY-MM-DDTHH:mm → YYYY-MM-DDTHH:mm:00
  return local.length === 16 ? local + ':00' : local
}

export function formDataToApiPayload(
  data: TradeFormData,
  options?: { mode?: 'create' | 'edit' },
): Record<string, unknown> {
  const tagsStr = (data.tags ?? '').trim()
  const tagsList = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : null
  const stopPrice = data.stop_price || null
  const basePayload = {
    symbol: data.symbol,
    direction: 'LONG',
    entry_price: data.entry_price,
    exit_price: data.exit_price || null,
    quantity: data.quantity,
    entry_time: datetimeLocalToIso(data.entry_time),
    exit_time: datetimeLocalToIso(data.exit_time),
    fees: data.fees || '0',
    setup: data.setup || null,
    tactic: data.tactic || null,
    original_stop_price: stopPrice,
    target_price: data.target_price || null,
    tags: tagsList,
    notes: data.notes || null,
  }
  if (options?.mode === 'edit') {
    return basePayload
  }
  return {
    ...basePayload,
    stop_price: stopPrice,
    stop_loss_status: stopPrice ? 'original' : null,
  }
}
