import { Button, Stack } from '@/new-ui'
import { SettingsSectionCard } from './SettingsSectionCard'

interface SettingsFallbackPanelProps {
  onOpenLegacy: () => void
}

export function SettingsFallbackPanel({ onOpenLegacy }: SettingsFallbackPanelProps) {
  return (
    <SettingsSectionCard
      title="Legacy settings"
      description="Sections not yet rebuilt in V3 are reachable via the legacy settings page (same endpoints, no behavior change)."
      action={
        <Button size="sm" variant="ghost" onClick={onOpenLegacy}>
          Open legacy settings
        </Button>
      }
    >
      <Stack gap="sm">
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Capital and risk preferences live in the dedicated Capital page. Broker-account credentials are not exposed in this app — broker imports remain CSV-based.
        </p>
      </Stack>
    </SettingsSectionCard>
  )
}
