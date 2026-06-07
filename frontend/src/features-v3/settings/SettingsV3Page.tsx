import { Page, Stack } from '@/new-ui'
import { AccountSettingsPanel } from './components/AccountSettingsPanel'
import { AppPreferencesPanel } from './components/AppPreferencesPanel'
import { SystemStatusPanel } from './components/SystemStatusPanel'
import { AiProviderSettingsPanel } from './components/AiProviderSettingsPanel'
import { useAiSettingsState } from './hooks/useAiSettingsState'

export function SettingsV3Page() {
  const aiState = useAiSettingsState(true)

  return (
    <Page
      title="Settings"
      subtitle="Profile, preferences, and AI provider in one place."
    >
      <Stack gap="lg">
        <AccountSettingsPanel />
        <AppPreferencesPanel />
        <SystemStatusPanel />
        <AiProviderSettingsPanel state={aiState} />
      </Stack>
    </Page>
  )
}
