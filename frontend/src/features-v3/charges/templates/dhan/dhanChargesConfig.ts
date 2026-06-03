// Dhan charges template configuration
// Source: https://dhan.co/pricing/
// Reviewed: 2025-06-03
// IMPORTANT: Dhan pricing can change. These values are tariff-based estimates.
// Always verify against your contract note before saving.

export type DhanProductType =
  | 'equity_delivery'
  | 'equity_intraday'
  | 'equity_mtf'
  | 'equity_fno'
  | 'commodity_fno'

export type DhanExchange = 'NSE' | 'BSE'

export interface DhanProductConfig {
  name: string
  brokerage: {
    type: 'zero' | 'flat_per_order' | 'percentage_cap'
    flatAmount?: number // ₹ per order
    percentage?: number // % of trade value
    cap?: number // min of flat vs percentage
    description: string
  }
  transactionCharges: {
    nse: number // percentage
    bse: number // percentage
  }
  stt: {
    type: 'both_sides' | 'sell_only'
    rate: number // percentage
    appliesTo: 'all' | 'sell_turnover'
    exemptionsNote: string
  }
  gstRate: number // 18%
  sebiRate: number // 0.0001%
  stampDuty: {
    rate: number // percentage
    appliesTo: 'buy_turnover'
  }
  ipftRate: number // 0.0000001%
  statutoryNotes: string[]
  supported: boolean
  supportedMessage?: string
}

// ────────────────────────── Rates ──────────────────────────

export const DHAN_GST_RATE = 0.18
export const DHAN_SEBI_RATE = 0.0001 / 100 // 0.0001%
export const DHAN_IPFT_RATE = 0.0000001 / 100 // 0.0000001%

export const DHAN_TRANSACTION_NSE = 0.0030699 / 100 // NSE equity
export const DHAN_TRANSACTION_BSE = 0.00375 / 100 // BSE equity

export const DHAN_STT_DELIVERY = 0.1 / 100 // 0.1% on buy + sell
export const DHAN_STT_INTRADAY = 0.025 / 100 // 0.025% on sell only
export const DHAN_STT_MTF = 0.1 / 100 // 0.1% on buy + sell

export const DHAN_STAMP_DUTY_DELIVERY = 0.015 / 100 // 0.015% on buy
export const DHAN_STAMP_DUTY_INTRADAY = 0.003 / 100 // 0.003% on buy
export const DHAN_STAMP_DUTY_MTF = 0.015 / 100 // 0.015% on buy

// F&O brokerage: ₹20 per executed order
export const DHAN_FNO_BROKERAGE_FLAT = 20

// Intraday/MTF brokerage cap
export const DHAN_INTRADAY_BROKERAGE_FLAT = 20
export const DHAN_INTRADAY_BROKERAGE_PCT = 0.03 / 100 // 0.03%

// ────────────────────────── Product Configs ──────────────────────────

export const DHAN_PRODUCTS: Record<DhanProductType, DhanProductConfig> = {
  equity_delivery: {
    name: 'Equity Delivery',
    brokerage: {
      type: 'zero',
      description: '₹0 — no brokerage for delivery trades',
    },
    transactionCharges: { nse: DHAN_TRANSACTION_NSE, bse: DHAN_TRANSACTION_BSE },
    stt: {
      type: 'both_sides',
      rate: DHAN_STT_DELIVERY,
      appliesTo: 'all',
      exemptionsNote: 'STT does not apply to some ETFs.',
    },
    gstRate: DHAN_GST_RATE,
    sebiRate: DHAN_SEBI_RATE,
    stampDuty: { rate: DHAN_STAMP_DUTY_DELIVERY, appliesTo: 'buy_turnover' },
    ipftRate: DHAN_IPFT_RATE,
    statutoryNotes: [
      'BSE transaction charges vary for certain scrip groups.',
      'STT does not apply to some ETFs.',
      'Physical delivery of derivatives has additional charges.',
    ],
    supported: true,
  },
  equity_intraday: {
    name: 'Equity Intraday',
    brokerage: {
      type: 'percentage_cap',
      flatAmount: DHAN_INTRADAY_BROKERAGE_FLAT,
      percentage: DHAN_INTRADAY_BROKERAGE_PCT,
      cap: DHAN_INTRADAY_BROKERAGE_FLAT,
      description:
        '₹20 or 0.03% of trade value per executed order, whichever is lower. Estimate uses aggregate approximation.',
    },
    transactionCharges: { nse: DHAN_TRANSACTION_NSE, bse: DHAN_TRANSACTION_BSE },
    stt: {
      type: 'sell_only',
      rate: DHAN_STT_INTRADAY,
      appliesTo: 'sell_turnover',
      exemptionsNote: 'STT does not apply to some ETFs.',
    },
    gstRate: DHAN_GST_RATE,
    sebiRate: DHAN_SEBI_RATE,
    stampDuty: { rate: DHAN_STAMP_DUTY_INTRADAY, appliesTo: 'buy_turnover' },
    ipftRate: DHAN_IPFT_RATE,
    statutoryNotes: [
      'Brokerage estimate uses aggregate turnover and order count. Contract note remains final.',
      'BSE transaction charges vary for certain scrip groups.',
      'STT does not apply to some ETFs.',
    ],
    supported: true,
  },
  equity_mtf: {
    name: 'Equity MTF',
    brokerage: {
      type: 'percentage_cap',
      flatAmount: DHAN_INTRADAY_BROKERAGE_FLAT,
      percentage: DHAN_INTRADAY_BROKERAGE_PCT,
      cap: DHAN_INTRADAY_BROKERAGE_FLAT,
      description:
        '₹20 or 0.03% of trade value per executed order, whichever is lower. Estimate uses aggregate approximation.',
    },
    transactionCharges: { nse: DHAN_TRANSACTION_NSE, bse: DHAN_TRANSACTION_BSE },
    stt: {
      type: 'both_sides',
      rate: DHAN_STT_MTF,
      appliesTo: 'all',
      exemptionsNote: 'STT does not apply to some ETFs.',
    },
    gstRate: DHAN_GST_RATE,
    sebiRate: DHAN_SEBI_RATE,
    stampDuty: { rate: DHAN_STAMP_DUTY_MTF, appliesTo: 'buy_turnover' },
    ipftRate: DHAN_IPFT_RATE,
    statutoryNotes: [
      'Brokerage estimate uses aggregate turnover and order count. Contract note remains final.',
      'BSE transaction charges vary for certain scrip groups.',
      'Physical delivery of derivatives has additional charges.',
    ],
    supported: true,
  },
  equity_fno: {
    name: 'Equity F&O',
    brokerage: {
      type: 'flat_per_order',
      flatAmount: DHAN_FNO_BROKERAGE_FLAT,
      description: '₹20 per executed order for equity F&O.',
    },
    transactionCharges: { nse: 0, bse: 0 }, // Not safely known from reference; will warn
    stt: {
      type: 'sell_only',
      rate: 0,
      appliesTo: 'sell_turnover',
      exemptionsNote: 'F&O STT rates differ from equity. Verify contract note.',
    },
    gstRate: DHAN_GST_RATE,
    sebiRate: DHAN_SEBI_RATE,
    stampDuty: { rate: 0, appliesTo: 'buy_turnover' }, // F&O stamp duty differs
    ipftRate: DHAN_IPFT_RATE,
    statutoryNotes: [
      'F&O statutory charges (transaction, STT, stamp duty) are not fully supported yet. Verify contract note for all statutory components.',
      'Expired/exercised/assigned options may have additional brokerage.',
    ],
    supported: true,
    supportedMessage:
      'Brokerage estimate only. F&O statutory charges must be verified against contract note.',
  },
  commodity_fno: {
    name: 'Commodity F&O',
    brokerage: {
      type: 'flat_per_order',
      flatAmount: DHAN_FNO_BROKERAGE_FLAT,
      description: '₹20 per executed order for commodity F&O.',
    },
    transactionCharges: { nse: 0, bse: 0 },
    stt: {
      type: 'sell_only',
      rate: 0,
      appliesTo: 'sell_turnover',
      exemptionsNote: 'Commodity F&O charges are not available in current reference.',
    },
    gstRate: DHAN_GST_RATE,
    sebiRate: 0,
    stampDuty: { rate: 0, appliesTo: 'buy_turnover' },
    ipftRate: 0,
    statutoryNotes: [
      'Commodity F&O charges are not fully supported yet. Verify contract note.',
    ],
    supported: false,
    supportedMessage:
      'Commodity F&O not yet supported. Please use manual entry or contract note.',
  },
}

// ────────────────────────── Helpers ──────────────────────────

export function getProductConfig(product: DhanProductType): DhanProductConfig {
  return DHAN_PRODUCTS[product]
}

export function isProductSupported(product: DhanProductType): boolean {
  return DHAN_PRODUCTS[product].supported
}

export const DHAN_PRODUCT_OPTIONS: { value: DhanProductType; label: string }[] = [
  { value: 'equity_delivery', label: 'Equity Delivery' },
  { value: 'equity_intraday', label: 'Equity Intraday' },
  { value: 'equity_mtf', label: 'Equity MTF' },
  { value: 'equity_fno', label: 'Equity F&O (brokerage only)' },
]
