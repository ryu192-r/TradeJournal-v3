import { Button, Chip, Stack, TableShell } from '@/new-ui'
import type { DailyChargesDaySummary } from '@/types'
import { formatChargesDateLabel, formatCurrencyValue } from '../utils/chargesFormUtils'

interface MissingChargesQueueProps {
  days: DailyChargesDaySummary[]
  onAddCharges: (date: string) => void
}

export function MissingChargesQueue({ days, onAddCharges }: MissingChargesQueueProps) {
  const missing = days.filter((d) => !d.charges_recorded)

  if (missing.length === 0) return null

  return (
    <Stack gap="md">
      <div className="tjv3-section-header">
        <h3 className="tjv3-section-title">Missing charges</h3>
        <Chip variant="warning">{missing.length} day(s)</Chip>
      </div>
      <TableShell compact>
        <table className="tjv3-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Gross P&L</th>
              <th>Trades</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {missing.map((day) => (
              <MissingRow key={day.trade_date} day={day} onAdd={onAddCharges} />
            ))}
          </tbody>
        </table>
      </TableShell>
    </Stack>
  )
}

function MissingRow({ day, onAdd }: { day: DailyChargesDaySummary; onAdd: (date: string) => void }) {
  return (
    <tr className="tjv3-table__row">
      <td>{formatChargesDateLabel(day.trade_date)}</td>
      <td>₹{formatCurrencyValue(day.gross_realized_pnl)}</td>
      <td>{day.trade_count}</td>
      <td>
        <Chip variant="warning">Missing</Chip>
      </td>
      <td style={{ textAlign: 'right' }}>
        <Button variant="primary" size="sm" onClick={() => onAdd(day.trade_date)}>Add charges</Button>
      </td>
    </tr>
  )
}
