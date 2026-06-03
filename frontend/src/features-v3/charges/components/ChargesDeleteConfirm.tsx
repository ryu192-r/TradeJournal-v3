import { Button, Card, Stack } from '@/new-ui'

interface ChargesDeleteConfirmProps {
  date: string
  onConfirm: () => void
  onCancel: () => void
}

export function ChargesDeleteConfirm({ date, onConfirm, onCancel }: ChargesDeleteConfirmProps) {
  return (
    <Card>
      <Stack gap="md">
        <p className="tjv3-text">
          <strong>Delete charges for {date}?</strong>
        </p>
        <p className="tjv3-text-muted">
          This will make net P&L pending again for this trading day. Trade P&L will not be changed.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </Stack>
    </Card>
  )
}
