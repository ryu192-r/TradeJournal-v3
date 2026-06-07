import { Page, Stack } from '@/new-ui'
import { AccountSettingsPanel } from './components/AccountSettingsPanel'
import { AppPreferencesPanel } from './components/AppPreferencesPanel'
import { SystemStatusPanel } from './components/SystemStatusPanel'
import { AiProviderSettingsPanel } from './components/AiProviderSettingsPanel'
import { SettingsFallbackPanel } from './components/SettingsFallbackPanel'
import { useAiSettingsState } from './hooks/useAiSettingsState'

interface SettingsV3PageProps {
  /** Optional callback to switch the V3 shell to the legacy SettingsPage. */
  onOpenLegacy?: () => void
}

export function SettingsV3Page({ onOpenLegacy }: SettingsV3PageProps) {
  const aiState = useAiSettingsState(true)

  return (
    <Page
      title="Settings"
      subtitle="Profile, preferences, and AI provider in one place. Backend behavior unchanged from V2."
    >
      <Stack gap="lg">
        <AccountSettingsPanel />
        <AppPreferencesPanel />
        <SystemStatusPanel />
        <AiProviderSettingsPanel state={aiState} />
        {onOpenLegacy && <SettingsFallbackPanel onOpenLegacy={onOpenLegacy} />}
      </Stack>
    </Page>
  )
}
