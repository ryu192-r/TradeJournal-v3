import { Stack } from '@/new-ui'
import { Sparkles } from 'lucide-react'
import { SettingsSectionCard } from './SettingsSectionCard'
import type { UseAiSettingsState } from '../hooks/useAiSettingsState'

interface AiPersonalityPanelProps {
  state: UseAiSettingsState
}

export function AiPersonalityPanel({ state }: AiPersonalityPanelProps) {
  if (!state.loaded || state.mentors.length === 0) {
    return null
  }

  return (
    <SettingsSectionCard
      title="AI coach personality"
      description="Blend mentor influences. Saved with the AI provider settings above."
      icon={<Sparkles size={16} aria-hidden="true" />}
    >
      <Stack gap="md">
        {state.mentors.map((mentor) => {
          const value = state.form.personality[mentor.key] ?? 50
          return (
            <div key={mentor.key}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{mentor.name}</div>
                  {mentor.description && (
                    <p
                      style={{
                        margin: '0.125rem 0 0',
                        color: 'var(--color-text-muted)',
                        fontSize: '0.6875rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {mentor.description}
                    </p>
                  )}
                </div>
                <span
                  aria-live="polite"
                  style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.75rem', minWidth: '2.5rem', textAlign: 'right' }}
                >
                  {value}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={value}
                onChange={(e) => state.setPersonality(mentor.key, Number(e.target.value))}
                aria-label={`${mentor.name} influence`}
                style={{ width: '100%' }}
              />
            </div>
          )
        })}
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.6875rem', lineHeight: 1.4 }}>
          These weights influence how each mentor's perspective shapes the AI coach output. They are saved together with the AI provider configuration.
        </p>
      </Stack>
    </SettingsSectionCard>
  )
}
