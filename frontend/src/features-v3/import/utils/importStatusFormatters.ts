import type { BrokerImportResult } from '@/types'

export interface ImportRowSummary {
  added: number
  updated: number
  skipped: number
  total: number
  errorCount: number
  /** Computed convenience: total - skipped - errors. */
  effectivelyImported: number
}

export function summarizeImportResult(result: BrokerImportResult | null): ImportRowSummary | null {
  if (!result) return null
  const added = Number.isFinite(result.added) ? result.added : 0
  const updated = Number.isFinite(result.updated) ? result.updated : 0
  const skipped = Number.isFinite(result.skipped) ? result.skipped : 0
  const total = Number.isFinite(result.total) ? result.total : 0
  const errorCount = Array.isArray(result.errors) ? result.errors.length : 0
  return {
    added,
    updated,
    skipped,
    total,
    errorCount,
    effectivelyImported: added + updated,
  }
}

/**
 * Plain-language description of broker support; data origin is the backend
 * /trades/brokers response (no fake claims).
 */
export function describeBroker(brokerId: string): string {
  switch (brokerId) {
    case 'zerodha':
      return 'Kite tradebook CSV export.'
    case 'dhan':
      return 'Dhan tradebook CSV export.'
    case 'generic':
      return 'Generic CSV using the app template.'
    default:
      return 'Broker CSV import.'
  }
}

/**
 * Returns true if the backend parsers known to map C5 metadata
 * (exchange, segment, product_type, executed_order_count) for this broker.
 * Generic CSV does not map automatically.
 */
export function brokerMapsMetadata(brokerId: string): boolean {
  return brokerId === 'zerodha' || brokerId === 'dhan'
}
