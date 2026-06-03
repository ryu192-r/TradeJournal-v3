/**
 * Dhan charges estimate calculator.
 *
 * IMPORTANT DISCLAIMER:
 * This is a tariff-based estimate helper, NOT the source of accounting truth.
 * Actual contract note charges saved by the user remain the final source of truth.
 * Dhan pricing can change. Always verify against your contract note.
 *
 * Source: https://dhan.co/pricing/
 * Reviewed: 2025-06-03
 */

import {
  DHAN_PRODUCTS,
  type DhanProductType,
  type DhanExchange,
} from './dhanChargesConfig'
import type { DhanEstimateInput, DhanEstimateResult, DhanEstimateValidation } from './dhanChargesTypes'

// ────────────────────────── Rounding ──────────────────────────

function roundToNearestRupee(n: number): number {
  return Math.round(n)
}

function roundTo2Decimals(n: number): number {
  return Math.round(n * 100) / 100
}

// ────────────────────────── Validation ──────────────────────────

export function validateDhanEstimateInput(input: DhanEstimateInput): DhanEstimateValidation {
  const errors: Record<string, string> = {}
  if (!input.product_type) {
    errors.product_type = 'Product type is required'
  }
  if (input.buy_turnover < 0) {
    errors.buy_turnover = 'Buy turnover cannot be negative'
  }
  if (input.sell_turnover < 0) {
    errors.sell_turnover = 'Sell turnover cannot be negative'
  }
  if (Number.isNaN(input.buy_turnover)) {
    errors.buy_turnover = 'Invalid buy turnover'
  }
  if (Number.isNaN(input.sell_turnover)) {
    errors.sell_turnover = 'Invalid sell turnover'
  }
  if (input.executed_order_count < 0) {
    errors.executed_order_count = 'Order count cannot be negative'
  }
  if (!Number.isFinite(input.executed_order_count)) {
    errors.executed_order_count = 'Invalid order count'
  }
  return { valid: Object.keys(errors).length === 0, errors }
}

// ────────────────────────── Brokerage ──────────────────────────

function computeBrokerage(
  product: DhanProductType,
  turnover: number,
  orderCount: number,
): { value: number; note: string } {
  const cfg = DHAN_PRODUCTS[product]
  const bk = cfg.brokerage

  if (bk.type === 'zero') {
    return { value: 0, note: 'Delivery brokerage is ₹0' }
  }

  if (bk.type === 'flat_per_order' && bk.flatAmount) {
    return { value: bk.flatAmount * orderCount, note: `₹${bk.flatAmount} × ${orderCount} orders` }
  }

  if (bk.type === 'percentage_cap' && bk.percentage && bk.flatAmount) {
    // Option C: aggregate approximation
    const pctValue = turnover * bk.percentage
    const flatValue = bk.flatAmount * orderCount
    const value = Math.min(pctValue, flatValue)
    return {
      value: roundTo2Decimals(value),
      note: `min(₹${bk.flatAmount}×${orderCount}=${roundTo2Decimals(flatValue)}, ${(bk.percentage * 100).toFixed(3)}%×${turnover}=${roundTo2Decimals(pctValue)}) = ${roundTo2Decimals(value)}`,
    }
  }

  return { value: 0, note: 'Brokerage not applicable' }
}

// ────────────────────────── Transaction Charges ──────────────────────────

function computeTransactionCharges(
  product: DhanProductType,
  exchange: DhanExchange,
  turnover: number,
): { value: number; note: string } {
  const cfg = DHAN_PRODUCTS[product]
  const rate = exchange === 'BSE' ? cfg.transactionCharges.bse : cfg.transactionCharges.nse
  if (rate === 0) {
    return { value: 0, note: 'Transaction charges: verify contract note' }
  }
  const value = turnover * rate
  return {
    value: roundTo2Decimals(value),
    note: `${(rate * 100).toFixed(4)}% of ₹${turnover}`,
  }
}

// ────────────────────────── STT ──────────────────────────

function computeSTT(
  product: DhanProductType,
  buyTurnover: number,
  sellTurnover: number,
): { value: number; note: string } {
  const cfg = DHAN_PRODUCTS[product]
  const stt = cfg.stt

  if (stt.rate === 0) {
    return { value: 0, note: 'STT: verify contract note' }
  }

  if (stt.appliesTo === 'all') {
    const value = (buyTurnover + sellTurnover) * stt.rate
    return {
      value: roundToNearestRupee(value),
      note: `${(stt.rate * 100).toFixed(3)}% of buy+sell turnover = ${roundToNearestRupee(value)} (rounded to nearest rupee)`,
    }
  }

  // sell_only
  const value = sellTurnover * stt.rate
  return {
    value: roundToNearestRupee(value),
    note: `${(stt.rate * 100).toFixed(3)}% of sell turnover = ${roundToNearestRupee(value)} (rounded to nearest rupee)`,
  }
}

// ────────────────────────── SEBI ──────────────────────────

function computeSebi(turnover: number, rate: number): number {
  return roundTo2Decimals(turnover * rate)
}

// ────────────────────────── Stamp Duty ──────────────────────────

function computeStampDuty(
  product: DhanProductType,
  buyTurnover: number,
): { value: number; note: string } {
  const cfg = DHAN_PRODUCTS[product]
  const rate = cfg.stampDuty.rate
  if (rate === 0) {
    return { value: 0, note: 'Stamp duty: verify contract note' }
  }
  const value = buyTurnover * rate
  return {
    value: roundToNearestRupee(value),
    note: `${(rate * 100).toFixed(3)}% of buy turnover = ${roundToNearestRupee(value)} (rounded to nearest rupee)`,
  }
}

// ────────────────────────── IPFT ──────────────────────────

function computeIpft(turnover: number, rate: number): number {
  return roundTo2Decimals(turnover * rate)
}

// ────────────────────────── GST ──────────────────────────

function computeGst(
  gstRate: number,
  base: number,
): { value: number; note: string } {
  const value = base * gstRate
  return {
    value: roundTo2Decimals(value),
    note: `${(gstRate * 100).toFixed(0)}% of taxable base = ${roundTo2Decimals(value)}`,
  }
}

// ────────────────────────── Main Calculator ──────────────────────────

export function computeDhanEstimate(input: DhanEstimateInput): DhanEstimateResult {
  const cfg = DHAN_PRODUCTS[input.product_type]
  const turnover = input.buy_turnover + input.sell_turnover

  const warnings: string[] = []
  const assumptions: string[] = []

  if (!cfg.supported) {
    warnings.push(cfg.supportedMessage || 'This product type is not supported yet.')
    return {
      brokerage: 0,
      stt: 0,
      exchange_txn_charges: 0,
      sebi_charges: 0,
      stamp_duty: 0,
      gst: 0,
      ipft: 0,
      other_charges: 0,
      total_charges: 0,
      confidence: 'low',
      warnings,
      assumptions: ['Product type unsupported. No estimate available.'],
      breakdown: [],
    }
  }

  // Defaults
  assumptions.push('Estimate only — verify with contract note.')
  assumptions.push('Dhan pricing can change.')

  // Brokerage
  const bk = computeBrokerage(input.product_type, turnover, input.executed_order_count)
  if (cfg.brokerage.type === 'percentage_cap') {
    warnings.push('Brokerage estimate uses aggregate turnover and order count. Contract note remains final.')
  }

  // Transaction charges
  const txn = computeTransactionCharges(input.product_type, input.exchange, turnover)
  if (txn.value === 0 && cfg.transactionCharges.nse === 0) {
    warnings.push('Transaction charges not estimated for this product. Verify contract note.')
  }

  // STT
  const stt = computeSTT(input.product_type, input.buy_turnover, input.sell_turnover)
  if (stt.value === 0 && cfg.stt.rate === 0) {
    warnings.push('STT not estimated for this product. Verify contract note.')
  }

  // SEBI
  const sebi = computeSebi(turnover, cfg.sebiRate)

  // Stamp duty
  const stamp = computeStampDuty(input.product_type, input.buy_turnover)
  if (stamp.value === 0 && cfg.stampDuty.rate === 0) {
    warnings.push('Stamp duty not estimated for this product. Verify contract note.')
  }

  // IPFT
  const ipft = input.include_ipft ? computeIpft(turnover, cfg.ipftRate) : 0
  if (ipft > 0) {
    assumptions.push('IPFT included in estimate.')
  }

  // GST base = brokerage + transaction + sebi + ipft
  const gstBase = bk.value + txn.value + sebi + ipft
  const gst = computeGst(cfg.gstRate, gstBase)

  // Special warnings
  if (input.exchange === 'BSE') {
    warnings.push('BSE transaction charges vary for certain scrip groups.')
  }
  if (cfg.supportedMessage) {
    warnings.push(cfg.supportedMessage)
  }

  // Other charges: IPFT rolled in when no dedicated field
  const otherCharges = ipft

  // Total (sum of rounded components)
  const total =
    bk.value +
    stt.value +
    txn.value +
    sebi +
    stamp.value +
    gst.value +
    otherCharges

  const totalRounded = roundTo2Decimals(total)

  // Confidence
  let confidence: 'high' | 'medium' | 'low' = 'high'
  if (cfg.brokerage.type === 'percentage_cap') confidence = 'medium'
  if (warnings.length > 2) confidence = 'low'
  if (cfg.supportedMessage) confidence = 'low'

  const breakdown = [
    { label: 'Brokerage', value: bk.value, note: bk.note },
    { label: 'STT', value: stt.value, note: stt.note },
    { label: 'Exchange txn charges', value: txn.value, note: txn.note },
    { label: 'SEBI charges', value: sebi, note: `${(cfg.sebiRate * 100).toFixed(4)}% of turnover` },
    { label: 'Stamp duty', value: stamp.value, note: stamp.note },
    { label: 'GST', value: gst.value, note: gst.note },
    ...(ipft > 0 ? [{ label: 'IPFT', value: ipft, note: `${(cfg.ipftRate * 100).toFixed(7)}% of turnover` }] : []),
  ]

  return {
    brokerage: bk.value,
    stt: stt.value,
    exchange_txn_charges: txn.value,
    sebi_charges: sebi,
    stamp_duty: stamp.value,
    gst: gst.value,
    ipft,
    other_charges: otherCharges,
    total_charges: totalRounded,
    confidence,
    warnings,
    assumptions,
    breakdown,
  }
}

// ────────────────────────── Estimate vs Actual ──────────────────────────

export interface EstimateVsActual {
  estimated: number
  actual: number
  difference: number
  differencePct: number | null
  status: 'close' | 'review' | 'large' | 'no_actual'
}

export function compareEstimateToActual(
  estimatedTotal: number,
  actualTotal: number | null | undefined,
): EstimateVsActual {
  if (actualTotal === null || actualTotal === undefined || Number.isNaN(actualTotal)) {
    return {
      estimated: estimatedTotal,
      actual: 0,
      difference: 0,
      differencePct: null,
      status: 'no_actual',
    }
  }
  const diff = estimatedTotal - actualTotal
  const absDiff = Math.abs(diff)
  const diffPct = actualTotal > 0 ? (absDiff / actualTotal) * 100 : estimatedTotal > 0 ? 100 : 0

  let status: EstimateVsActual['status']
  if (diffPct <= 2) status = 'close'
  else if (diffPct <= 10) status = 'review'
  else status = 'large'

  return {
    estimated: estimatedTotal,
    actual: actualTotal,
    difference: diff,
    differencePct: diffPct,
    status,
  }
}
