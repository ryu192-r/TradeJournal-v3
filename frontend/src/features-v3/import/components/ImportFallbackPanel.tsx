import { Button, Panel, Stack } from '@/new-ui'

interface ImportFallbackPanelProps {
  onOpenLegacy: () => void
}

export function ImportFallbackPanel({ onOpenLegacy }: ImportFallbackPanelProps) {
  return (
    <Panel
      title="Legacy import"
      description="Need the original modal-based flow? It is still available unchanged."
      action={
        <Button variant="ghost" size="sm" onClick={onOpenLegacy}>
          Open legacy import
        </Button>
      }
    >
      <Stack gap="sm">
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          The V3 import page reuses the same broker parser and API endpoints as the legacy flow — opening the legacy modal does not change behavior.
        </p>
      </Stack>
    </Panel>
  )
}
