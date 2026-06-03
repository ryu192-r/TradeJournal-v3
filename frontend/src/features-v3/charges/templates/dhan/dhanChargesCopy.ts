/**
 * Dhan charges estimate UI copy.
 * Keeps all user-facing strings in one place for consistency.
 */

export const DHAN_ESTIMATE_COPY = {
  panelTitle: 'Estimate with Dhan template',
  panelDescription:
    'Use Dhan\'s published tariff to estimate charges. This is a helper only — your contract note remains the final source of truth.',
  productLabel: 'Product type',
  exchangeLabel: 'Exchange',
  buyTurnoverLabel: 'Buy turnover (₹)',
  sellTurnoverLabel: 'Sell turnover (₹)',
  orderCountLabel: 'Executed orders',
  includeIpftLabel: 'Include IPFT',
  calculateButton: 'Calculate estimate',
  useAsDraftButton: 'Use estimate as draft',
  disclaimer: 'Estimate only. Verify against contract note before saving.',
  contractNoteReminder: 'Contract note remains the source of truth.',

  comparison: {
    title: 'Estimate vs actual',
    noActual: 'No actual charges recorded for this day.',
    close: 'Close match — within 2%.',
    review: 'Slight difference — within 10%. Review recommended.',
    large: 'Large difference — over 10%. Verify contract note.',
    differenceLabel: 'Difference',
    actualLabel: 'Actual',
    estimatedLabel: 'Estimated',
    normalNote: 'A difference is normal. Contract note remains final.',
  },

  warnings: {
    estimateOnly: 'Estimate only — verify with contract note.',
    brokerageApprox:
      'Brokerage estimate uses aggregate turnover and order count. Contract note remains final.',
    bseScrip: 'Special BSE scrip group charges are not included.',
    etfExemption: 'ETF/STT exemptions are not automatically detected.',
    fnoStatutory: 'F&O statutory charges are not fully supported yet.',
    pricingChange: 'Actual Dhan charges may change.',
  },
} as const
