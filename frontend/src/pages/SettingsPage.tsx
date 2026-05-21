// Settings page — account info, preferences, connection status
import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { User, Database, Palette, LogOut, Sun, Moon, Cpu, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react'
import { getAiConfig, getAiProviders, saveAiConfig, testAiConnection, getAiMentors } from '@/lib/endpoints'
import type { AIProviderInfo } from '@/types/ai'

const inputStyle = 'w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-[length:var(--text-sm)] text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all'
const primaryBtnStyle = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const ghostBtnStyle = 'inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[length:var(--text-sm)] font-medium text-text hover:text-text-heading hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer'
const testBtnStyle = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium text-accent border border-accent/20 hover:bg-accent-faint transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

export function SettingsPage() {
  const { user, logout } = useAuthStore()
  const { theme, toggleTheme } = useAppStore()

  // AI Settings state
  const [providers, setProviders] = useState<Record<string, AIProviderInfo>>({})
  const [aiProvider, setAiProvider] = useState('')
  const [aiBaseUrl, setAiBaseUrl] = useState('')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [aiCustomModels, setAiCustomModels] = useState('')
  const [aiTimeout, setAiTimeout] = useState(60)
  const [aiMaxRetries, setAiMaxRetries] = useState(3)
  const [aiTemperature, setAiTemperature] = useState(0.3)
  const [aiCollapsed, setAiCollapsed] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [mentors, setMentors] = useState<{ key: string; name: string; description: string }[]>([])
  const [personality, setPersonality] = useState<Record<string, number>>({})

  useEffect(() => {
    const init = async () => {
      const [providersData, configData, mentorsData] = await Promise.all([
        getAiProviders().catch(() => ({}) as Record<string, AIProviderInfo>),
        getAiConfig().catch(() => null),
        getAiMentors().catch(() => []),
      ])
      setProviders(providersData)
      setMentors(mentorsData)

      const providerKeys = Object.keys(providersData)
      const defaultProvider = providerKeys.length > 0 ? providerKeys[0] : ''

      if (configData) {
        setAiProvider(configData.provider || defaultProvider)
        setAiBaseUrl(configData.base_url || '')
        setAiApiKey(configData.api_key || '')
        setAiModel(configData.model || '')
        setAiTimeout(configData.timeout ?? 60)
        setAiMaxRetries(configData.max_retries ?? 3)
        setAiTemperature(configData.temperature ?? 0.3)
        setPersonality(configData.personality ?? {})
        if (configData.personality && mentorsData.length > 0) {
          const merged: Record<string, number> = {}
          for (const m of mentorsData) {
            merged[m.key] = configData.personality[m.key] ?? 50
          }
          setPersonality(merged)
        }
      } else {
        setAiProvider(defaultProvider)
        const prov = providersData[defaultProvider]
        if (prov) {
          setAiBaseUrl(prov.default_url)
          setAiModel(prov.models.length > 0 ? prov.models[0] : '')
        }
      }
      setLoaded(true)
    }
    init()
  }, [])

  const currentProvider = providers[aiProvider]

  const needsApiKey = currentProvider?.needs_api_key ?? true
  const isCustomProvider = aiProvider === 'custom'
  const providerModels = currentProvider?.models ?? []

  useEffect(() => {
    if (aiProvider === 'custom') return
    const provider = providers[aiProvider]
    if (!provider) return

    setAiBaseUrl(provider.default_url)
    setAiModel((current) => (
      current && provider.models.includes(current) ? current : provider.models[0] || ''
    ))
  }, [aiProvider, providers])

  const handleTestConnection = useCallback(async () => {
    setTestingConnection(true)
    setTestResult(null)
    try {
      const result = await testAiConnection()
      setTestResult({ status: result.status, message: result.response || result.error || (result.status === 'ok' ? 'Connection successful' : 'Connection failed') })
    } catch {
      setTestResult({ status: 'error', message: 'Test request failed' })
    } finally {
      setTestingConnection(false)
    }
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      const effectiveModel = aiModel
      const effectiveUrl = isCustomProvider ? aiBaseUrl : (currentProvider?.default_url ?? aiBaseUrl)
      await saveAiConfig({
        provider: aiProvider,
        base_url: effectiveUrl,
        api_key: needsApiKey ? aiApiKey || null : null,
        model: effectiveModel,
        timeout: aiTimeout,
        max_retries: aiMaxRetries,
        temperature: aiTemperature,
        personality,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // error handled by caller if needed
    } finally {
      setSaving(false)
    }
  }, [aiProvider, aiBaseUrl, aiApiKey, aiModel, aiTimeout, aiMaxRetries, aiTemperature, isCustomProvider, currentProvider, needsApiKey, personality])

  return (
    <div className="px-[var(--page-px)] py-[var(--page-py)] space-y-[var(--page-gap)]">
      <div>
        <h1 className="font-display text-[length:var(--heading-size)] text-text-heading">Settings</h1>
        <p className="text-[length:var(--text-sm)] text-text-muted mt-1">Your profile, connection, and display preferences</p>
      </div>

      {/* Account Section */}
      <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
            <User className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-medium text-text-heading">Account</h2>
            <p className="text-[length:var(--text-sm)] text-text-muted">Your profile and session</p>
          </div>
        </div>

        {user ? (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-muted">Email</span>
                <span className="text-text-heading">{user.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-muted">Name</span>
                <span className="text-text-heading">{user.full_name || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-muted">Status</span>
                <span className={user.is_active ? 'text-profit' : 'text-loss'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="mt-[var(--page-gap)] pt-[var(--page-gap)] border-t border-border">
              <button
                onClick={logout}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-[length:var(--text-sm)] font-medium bg-loss text-white hover:bg-loss/80 transition-all duration-[150ms] ease-out cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </>
        ) : (
          <div className="py-4 text-center">
            <p className="text-text-muted text-sm">
              No user profile loaded.
            </p>
          </div>
        )}
      </div>

      {/* Connection Section */}
      <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-profit-muted flex items-center justify-center">
            <Database className="w-5 h-5 text-profit" />
          </div>
          <div>
            <h2 className="font-medium text-text-heading">Connection</h2>
            <p className="text-[length:var(--text-sm)] text-text-muted">API and database status</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-text-muted">API Base URL</span>
            <span className="font-data text-xs text-text-heading">
              {import.meta.env.VITE_API_URL ?? '/api/v1'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-text-muted">Version</span>
            <span className="font-data text-text-heading">v3.0</span>
          </div>
        </div>
      </div>

      {/* Display Section */}
      <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gold-faint flex items-center justify-center">
            <Palette className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="font-medium text-text-heading">Display</h2>
            <p className="text-[length:var(--text-sm)] text-text-muted">Appearance preferences</p>
          </div>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-text-muted text-sm">Theme</span>
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[length:var(--text-sm)] font-medium transition-all duration-[150ms] ease-out cursor-pointer border"
            style={{
              backgroundColor: theme === 'dark' ? 'var(--accent-muted)' : 'var(--profit-faint)',
              color: theme === 'dark' ? 'var(--accent)' : 'var(--profit)',
              borderColor: theme === 'dark' ? 'var(--accent)' : 'var(--profit)',
            }}
          >
            {theme === 'dark' ? (
              <><Sun className="w-4 h-4" /> Light Mode</>
            ) : (
              <><Moon className="w-4 h-4" /> Dark Mode</>
            )}
          </button>
        </div>
      </div>

      {/* AI Provider Section */}
      <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent-faint flex items-center justify-center">
            <Cpu className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-medium text-text-heading">AI Provider</h2>
            <p className="text-[length:var(--text-sm)] text-text-muted">Configure your AI coach connection</p>
          </div>
        </div>

        {loaded ? (
          <div className="space-y-[var(--page-gap)]">
            {/* Provider Selection */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className={inputStyle}
              >
                {!aiProvider && <option value="" disabled>Select a provider</option>}
                {Object.entries(providers).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Base URL</label>
              {isCustomProvider ? (
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.your-provider.com/v1"
                  className={inputStyle}
                />
              ) : (
                <input
                  type="text"
                  value={currentProvider?.default_url ?? ''}
                  readOnly
                  className={`${inputStyle} opacity-70 cursor-not-allowed`}
                />
              )}
            </div>

            {/* Custom Models (only for custom provider) */}
            {isCustomProvider && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Custom Models</label>
                <input
                  type="text"
                  value={aiCustomModels}
                  onChange={(e) => setAiCustomModels(e.target.value)}
                  placeholder="model-1, model-2, model-3"
                  className={inputStyle}
                />
              </div>
            )}

            {/* API Key */}
            {needsApiKey && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">API Key</label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={aiApiKey}
                    onChange={(e) => setAiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className={`${inputStyle} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text-heading transition-colors cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Model Selection */}
            {!isCustomProvider && providerModels.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Model</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className={inputStyle}
                >
                  {providerModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">Custom Model</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="Enter model name"
                className={inputStyle}
              />
            </div>

            {/* Advanced Settings */}
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setAiCollapsed(!aiCollapsed)}
                className={ghostBtnStyle + ' w-full justify-between'}
              >
                <span className="text-xs font-medium text-text-muted">Advanced Settings</span>
                {aiCollapsed ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronUp className="w-4 h-4 text-text-muted" />}
              </button>

              {!aiCollapsed && (
                <div className="px-4 pb-4 space-y-[var(--page-gap)]">
                  {/* Timeout */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Timeout (seconds)</label>
                    <input
                      type="number"
                      value={aiTimeout}
                      onChange={(e) => setAiTimeout(Number(e.target.value))}
                      min={1}
                      max={300}
                      className={inputStyle}
                    />
                  </div>

                  {/* Max Retries */}
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Max Retries</label>
                    <input
                      type="number"
                      value={aiMaxRetries}
                      onChange={(e) => setAiMaxRetries(Number(e.target.value))}
                      min={0}
                      max={10}
                      className={inputStyle}
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium text-text-muted">Temperature</label>
                      <span className="text-xs font-data text-text-heading">{aiTemperature.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={aiTemperature}
                      onChange={(e) => setAiTemperature(Number(e.target.value))}
                      className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-xs text-text-faint mt-1">
                      <span>0.0</span>
                      <span>1.0</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Test Result Indicator */}
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${testResult.status === 'ok' ? 'text-profit' : 'text-loss'}`}>
                {testResult.status === 'ok' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className={testBtnStyle}
              >
                {testingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Cpu className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={primaryBtnStyle + ' relative'}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save AI Settings
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        )}
      </div>

      {/* AI Coach Personality Section */}
      {loaded && mentors.length > 0 && (
        <div className="bg-card rounded-2xl border border-border p-[var(--page-px)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-faint flex items-center justify-center">
              <Cpu className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-medium text-text-heading">Coach Personality</h2>
              <p className="text-[length:var(--text-sm)] text-text-muted">Blend mentor influences to match your style</p>
            </div>
          </div>
          <div className="space-y-[var(--page-gap)]">
            {mentors.map((m) => (
              <div key={m.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div>
                    <label className="text-xs font-medium text-text-heading">{m.name}</label>
                    <p className="text-[10px] text-text-muted">{m.description}</p>
                  </div>
                  <span className="text-xs font-data text-text-heading w-8 text-right">{personality[m.key] ?? 50}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={personality[m.key] ?? 50}
                  onChange={(e) => setPersonality({ ...personality, [m.key]: Number(e.target.value) })}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[10px] text-text-faint mt-0.5">
                  <span>Minimal</span>
                  <span>Strong</span>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-text-muted leading-relaxed pt-2 border-t border-border">
              These weights determine how much each mentor&apos;s perspective influences the AI coach&apos;s feedback.
              Adjust to match the coaching style that resonates with you.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
