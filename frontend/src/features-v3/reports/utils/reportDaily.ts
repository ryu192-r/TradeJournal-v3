import type { DailyChargesDaySummary } from '@/types'

export interface DailyReportRow {
  date: string
  tradeCount: number
  grossPnl: number | null
  chargesRecorded: boolean
  totalCharges: number | null
  netPnl: number | null
  status: 'complete' | 'pending' | 'no_trades'
}

function num(v: string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function buildDailyRows(days: DailyChargesDaySummary[]): DailyReportRow[] {
  return days
    .map((d) => {
      const gross = num(d.gross_realized_pnl)
      const charges = num(d.total_charges)
      const net = num(d.net_realized_pnl)
      let status: DailyReportRow['status'] = 'no_trades'
      if (d.trade_count > 0) {
        status = d.charges_recorded ? 'complete' : 'pending'
      }
      return {
        date: d.trade_date,
        tradeCount: d.trade_count,
        grossPnl: gross,
        chargesRecorded: d.charges_recorded,
        totalCharges: d.charges_recorded ? charges : null,
        netPnl: d.charges_recorded ? net : null,
        status,
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export interface DailySummary {
  totalDays: number
  tradingDays: number
  completeDays: number
  pendingDays: number
}

export function summarizeDaily(rows: DailyReportRow[]): DailySummary {
  const trading = rows.filter((r) => r.tradeCount > 0)
  return {
    totalDays: rows.length,
    tradingDays: trading.length,
    completeDays: trading.filter((r) => r.status === 'complete').length,
    pendingDays: trading.filter((r) => r.status === 'pending').length,
  }
}
