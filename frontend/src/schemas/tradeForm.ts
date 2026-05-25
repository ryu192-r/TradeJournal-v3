import { z } from 'zod'

const IST_OFFSET = '+05:30'

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

function toIST(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000
  return new Date(utcMs + 5.5 * 3600000)
}

function fromIST(istDate: Date): Date {
  const istMs = istDate.getTime() - 5.5 * 3600000
  return new Date(istMs - istDate.getTimezoneOffset() * 60000)
}

export function nowIST(): Date {
  return toIST(new Date())
}

export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso.slice(0, 16)
    const ist = toIST(d)
    const year = ist.getFullYear()
    const month = String(ist.getMonth() + 1).padStart(2, '0')
    const day = String(ist.getDate()).padStart(2, '0')
    const hours = String(ist.getHours()).padStart(2, '0')
    const mins = String(ist.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${mins}`
  } catch {
    return iso.slice(0, 16)
  }
}

export function datetimeLocalToIso(local: string | undefined): string | undefined {
  if (!local) return undefined
  const ist = new Date(local)
  const utc = fromIST(ist)
  return utc.toISOString().replace('Z', IST_OFFSET)
}

export function formDataToApiPayload(data: TradeFormData): Record<string, unknown> {
  const tagsStr = (data.tags ?? '').trim()
  const tagsList = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : null
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
    tags: tagsList,
    notes: data.notes || null,
  }
}