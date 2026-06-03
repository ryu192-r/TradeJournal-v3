import { useState } from 'react'
import { Badge, Button, LoadingState, Stack } from '@/new-ui'
import { Cpu, Eye, EyeOff, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { SettingsSectionCard } from './SettingsSectionCard'
import type { UseAiSettingsState } from '../hooks/useAiSettingsState'
import { describeStoredSecret } from '../utils/secretMasking'

interface AiProviderSettingsPanelProps {
  state: UseAiSettingsState
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.625rem',
  borderRadius: '0.5rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-muted)',
  color: 'var(--color-text)',
  fontSize: '0.8125rem',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: 'var(--color-text-muted)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export function AiProviderSettingsPanel({ state }: AiProviderSettingsPanelProps) {
  const [showKey, setShowKey] = useState(false)

  const provider = state.providers[state.form.provider]
  const needsKey = provider?.needs_api_key ?? state.form.provider !== 'custom'
  const isCustom = state.form.provider === 'custom'
  const providerModels = provider?.models ?? []
  const storedSecret = describeStoredSecret(state.form.hasStoredKey)

  return (
    <SettingsSectionCard
      title="AI provider"
      description="Endpoint, model, and credentials for the AI coach. Keys are stored server-side and never returned to the browser."
      icon={<Cpu size={16} aria-hidden="true" />}
    >
      {state.loading && !state.loaded ? (
        <LoadingState label="Loading AI configuration…" />
      ) : (
        <Stack gap="md">
          {state.loadError && (
            <div
              role="alert"
              style={{
                color: 'var(--color-loss)',
                fontSize: '0.8125rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-loss)',
                background: 'color-mix(in srgb, var(--color-loss) 10%, transparent)',
              }}
            >
              {state.loadError}{' '}
              <button
                type="button"
                onClick={state.reload}
                style={{
                  marginLeft: '0.25rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-loss)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div>
            <label htmlFor="ai-provider" style={labelStyle}>Provider</label>
            <select
              id="ai-provider"
              value={state.form.provider}
              onChange={(e) => state.setProvider(e.target.value)}
              style={inputStyle}
            >
              {!state.form.provider && <option value="" disabled>Select a provider</option>}
              {Object.entries(state.providers).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-base-url" style={labelStyle}>Base URL</label>
            <input
              id="ai-base-url"
              type="text"
              value={state.form.baseUrl}
              onChange={(e) => state.setBaseUrl(e.target.value)}
              readOnly={!isCustom}
              style={{
                ...inputStyle,
                opacity: isCustom ? 1 : 0.7,
                cursor: isCustom ? 'text' : 'not-allowed',
              }}
            />
          </div>

          {needsKey && (
            <div>
              <label htmlFor="ai-api-key" style={labelStyle}>API key</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="ai-api-key"
                  type={showKey ? 'text' : 'password'}
                  value={state.form.apiKey}
                  onChange={(e) => state.setApiKey(e.target.value)}
                  placeholder={state.form.hasStoredKey ? `${storedSecret.displayText} stored — leave blank to keep` : 'sk-…'}
                  autoComplete="off"
                  style={{ ...inputStyle, paddingRight: '2.25rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Hide entered API key' : 'Show entered API key'}
                  style={{
                    position: 'absolute',
                    inset: '0 0.25rem 0 auto',
                    width: '2rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {showKey ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  marginTop: '0.375rem',
                  fontSize: '0.6875rem',
                  color: 'var(--color-text-muted)',
                }}
              >
                <span>
                  Stored key:{' '}
                  <Badge variant={state.form.hasStoredKey ? 'success' : 'neutral'}>
                    {storedSecret.displayText}
                  </Badge>
                </span>
                {state.form.hasStoredKey && !state.form.apiKey && (
                  <label style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={state.form.removeStoredKey}
                      onChange={(e) => state.setRemoveStoredKey(e.target.checked)}
                    />
                    Remove on save
                  </label>
                )}
              </div>
            </div>
          )}

          {!isCustom && providerModels.length > 0 && (
            <div>
              <label htmlFor="ai-model" style={labelStyle}>Model</label>
              <select
                id="ai-model"
                value={state.form.model}
                onChange={(e) => state.setModel(e.target.value)}
                style={inputStyle}
              >
                {providerModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {(isCustom || providerModels.length === 0) && (
            <div>
              <label htmlFor="ai-model-custom" style={labelStyle}>Model name</label>
              <input
                id="ai-model-custom"
                type="text"
                value={state.form.model}
                onChange={(e) => state.setModel(e.target.value)}
                placeholder="model-name"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))' }}>
            <div>
              <label htmlFor="ai-timeout" style={labelStyle}>Timeout (s)</label>
              <input
                id="ai-timeout"
                type="number"
                min={1}
                max={300}
                value={state.form.timeout}
                onChange={(e) => state.setTimeout(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="ai-retries" style={labelStyle}>Max retries</label>
              <input
                id="ai-retries"
                type="number"
                min={0}
                max={10}
                value={state.form.maxRetries}
                onChange={(e) => state.setMaxRetries(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="ai-temp" style={labelStyle}>Temperature ({state.form.temperature.toFixed(1)})</label>
              <input
                id="ai-temp"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={state.form.temperature}
                onChange={(e) => state.setTemperature(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {state.testResult && (
            <div
              role="status"
              style={{
                display: 'inline-flex',
                gap: '0.375rem',
                alignItems: 'center',
                fontSize: '0.8125rem',
                color:
                  state.testResult.status === 'ok' ? 'var(--color-profit)' : 'var(--color-loss)',
              }}
            >
              {state.testResult.status === 'ok' ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <AlertCircle size={14} aria-hidden="true" />
              )}
              <span>
                {state.testResult.status === 'ok'
                  ? state.testResult.response || 'Connection successful.'
                  : state.testResult.error || 'Connection failed.'}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="secondary" size="sm" onClick={() => void state.test()} disabled={state.testing}>
              {state.testing ? 'Testing…' : 'Test connection'}
            </Button>
            <Button variant="primary" size="sm" onClick={() => void state.save()} disabled={state.saving}>
              <Save size={14} aria-hidden="true" />
              {state.saving ? 'Saving…' : state.saved ? 'Saved' : 'Save AI settings'}
            </Button>
          </div>
        </Stack>
      )}
    </SettingsSectionCard>
  )
}
