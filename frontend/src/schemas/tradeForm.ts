import { z } from 'zod'

// Form input schema: all fields stay as strings to match HTML input values.
// Numeric conversion happens in formDataToApiPayload before API submission.

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
  r_multiple: z.string().optional(),
  notes: z.string().optional(),
})

export type TradeFormData = z.infer<typeof tradeFormSchema>

// Convert ISO datetime string to datetime-local input value (YYYY-MM-DDTHH:MM)
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

// Convert datetime-local value to ISO-ish string for API (append seconds)
export function datetimeLocalToIso(local: string | undefined): string | undefined {
  if (!local) return undefined
  return local + ':00'
}

// Transform form data to API payload (convert numeric strings to numbers)
export function formDataToApiPayload(data: TradeFormData): Record<string, unknown> {
  return {
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
    stop_price: data.stop_price || null,
    target_price: data.target_price || null,
    r_multiple: data.r_multiple || null,
    notes: data.notes || null,
  }
}
