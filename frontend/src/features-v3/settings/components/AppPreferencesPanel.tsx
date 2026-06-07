import { Stack } from '@/new-ui'
import { Sun, Moon, LayoutGrid } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { SettingsSectionCard } from './SettingsSectionCard'

export function AppPreferencesPanel() {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  return (
    <SettingsSectionCard
      title="App preferences"
      description="Theme is stored in your browser only."
      icon={<LayoutGrid size={16} aria-hidden="true" />}
    >
      <Stack gap="md">
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Theme</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                Currently {theme === 'dark' ? 'dark' : 'light'}.
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              style={{
                display: 'inline-flex',
                gap: '0.375rem',
                alignItems: 'center',
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text)',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </Stack>
    </SettingsSectionCard>
  )
}
