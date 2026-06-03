import { Button, Chip, Stack, TableShell } from '@/new-ui'
import type { DailyChargesDaySummary } from '@/types'
import { formatChargesDateLabel, formatCurrencyValue } from '../utils/chargesFormUtils'

interface RecordedChargesLedgerProps {
  days: DailyChargesDaySummary[]
  onEdit: (date: string) => void
  onDelete: (date: string) => void
}

export function RecordedChargesLedger({ days, onEdit, onDelete }: RecordedChargesLedgerProps) {
  const recorded = days.filter((d) => d.charges_recorded)

  if (recorded.length === 0) return null

  return (
    <Stack gap="md">
      <div className="tjv3-section-header">
        <h3 className="tjv3-section-title">Recorded charges</h3>
        <Chip variant="success">{recorded.length} day(s)</Chip>
      </div>
      <TableShell compact>
        <table className="tjv3-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Gross P&L</th>
              <th>Total charges</th>
              <th>Net P&L</th>
              <th>Mode</th>
              <th>Broker</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recorded.map((day) => (
              <RecordedRow key={day.trade_date} day={day} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </TableShell>
    </Stack>
  )
}

function RecordedRow({
  day,
  onEdit,
  onDelete,
}: {
  day: DailyChargesDaySummary
  onEdit: (date: string) => void
  onDelete: (date: string) => void
}) {
  return (
    <tr className="tjv3-table__row">
      <td>{formatChargesDateLabel(day.trade_date)}</td>
      <td>₹{formatCurrencyValue(day.gross_realized_pnl)}</td>
      <td>₹{formatCurrencyValue(day.total_charges)}</td>
      <td>₹{formatCurrencyValue(day.net_realized_pnl)}</td>
      <td>
        <Chip variant="neutral">{day.entry_mode === 'total_only' ? 'Total only' : 'Breakdown'}</Chip>
      </td>
      <td>{day.broker || '—'}</td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={() => onEdit(day.trade_date)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(day.trade_date)}>Delete</Button>
        </div>
      </td>
    </tr>
  )
}
