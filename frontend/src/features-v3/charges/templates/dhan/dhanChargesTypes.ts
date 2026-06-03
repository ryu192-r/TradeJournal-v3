import type { DhanProductType, DhanExchange } from './dhanChargesConfig'

// ────────────────────────── Estimate Inputs ──────────────────────────

export interface DhanEstimateInput {
  product_type: DhanProductType
  exchange: DhanExchange
  buy_turnover: number // must be >= 0
  sell_turnover: number // must be >= 0
  executed_order_count: number // must be >= 0
  include_ipft: boolean // default true
}

// ────────────────────────── Estimate Result ──────────────────────────

export interface DhanEstimateResult {
  brokerage: number
  stt: number
  exchange_txn_charges: number
  sebi_charges: number
  stamp_duty: number
  gst: number
  ipft: number
  other_charges: number // includes ipft + any unsupported line items
  total_charges: number

  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
  assumptions: string[]

  // Raw breakdown for display
  breakdown: {
    label: string
    value: number
    note?: string
  }[]
}

// ────────────────────────── Validation ──────────────────────────

export interface DhanEstimateValidation {
  valid: boolean
  errors: Record<string, string>
}
