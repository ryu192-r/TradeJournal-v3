import { Stack } from '@/new-ui'
import { Sun, Moon, LayoutGrid, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { interfaceModeLabel } from '@/app/interfaceMode'
import type { NavMode } from '@/app/navigation'
import { SettingsSectionCard } from './SettingsSectionCard'

const MODE_DESCRIPTIONS: Record<NavMode, string> = {
  simple: 'Dashboard, Trades, Review, Analytics, Playbook, Settings only.',
  pro: 'Adds Edge Center, Capital, deep analytics, lifecycle, and research views.',
}

export function AppPreferencesPanel() {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  const navMode = useAppStore((s) => s.navMode)
  const setNavMode = useAppStore((s) => s.setNavMode)

  return (
    <SettingsSectionCard
      title="App preferences"
      description="Theme and navigation mode are stored in your browser only."
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

        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.375rem' }}>Interface mode</div>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {(['simple', 'pro'] as NavMode[]).map((mode) => {
              const active = navMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setNavMode(mode)}
                  aria-pressed={active}
                  style={{
                    textAlign: 'left',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: active
                      ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                      : 'transparent',
                    color: active ? 'var(--color-accent)' : 'var(--color-text)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600, fontSize: '0.8125rem' }}>
                    {mode === 'pro' ? (
                      <Sparkles size={14} aria-hidden="true" />
                    ) : (
                      <LayoutGrid size={14} aria-hidden="true" />
                    )}
                    {interfaceModeLabel(mode)}
                  </div>
                  <p
                    style={{
                      margin: '0.25rem 0 0',
                      color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                      fontSize: '0.6875rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {MODE_DESCRIPTIONS[mode]}
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      </Stack>
    </SettingsSectionCard>
  )
}
