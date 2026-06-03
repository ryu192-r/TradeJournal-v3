import { useCallback, useEffect, useState } from 'react'
import { getAiConfig, getAiMentors, getAiProviders, saveAiConfig, testAiConnection } from '@/lib/endpoints'
import type { AIProviderInfo, AiConfigSaveRequest, MentorInfo, TestResponse } from '@/types/ai'

export interface AiSettingsForm {
  provider: string
  baseUrl: string
  /** New key entered by user this session. Never populated from backend. */
  apiKey: string
  /** Backend-reported flag — `true` means a stored key exists server-side. */
  hasStoredKey: boolean
  /** User intent to remove stored key on save. */
  removeStoredKey: boolean
  model: string
  timeout: number
  maxRetries: number
  temperature: number
  personality: Record<string, number>
}

export interface UseAiSettingsState {
  form: AiSettingsForm
  providers: Record<string, AIProviderInfo>
  mentors: MentorInfo[]
  loaded: boolean
  loading: boolean
  loadError: string | null
  saving: boolean
  saved: boolean
  testing: boolean
  testResult: TestResponse | null
  setProvider: (provider: string) => void
  setBaseUrl: (url: string) => void
  setApiKey: (key: string) => void
  setRemoveStoredKey: (flag: boolean) => void
  setModel: (model: string) => void
  setTimeout: (n: number) => void
  setMaxRetries: (n: number) => void
  setTemperature: (n: number) => void
  setPersonality: (key: string, value: number) => void
  save: () => Promise<void>
  test: () => Promise<void>
  reload: () => void
}

const DEFAULT_FORM: AiSettingsForm = {
  provider: '',
  baseUrl: '',
  apiKey: '',
  hasStoredKey: false,
  removeStoredKey: false,
  model: '',
  timeout: 60,
  maxRetries: 3,
  temperature: 0.3,
  personality: {},
}

export function useAiSettingsState(enabled = true): UseAiSettingsState {
  const [form, setForm] = useState<AiSettingsForm>(DEFAULT_FORM)
  const [providers, setProviders] = useState<Record<string, AIProviderInfo>>({})
  const [mentors, setMentors] = useState<MentorInfo[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResponse | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setLoadError(null)
      let hadError = false
      const [providersData, configData, mentorsData] = await Promise.all([
        getAiProviders().catch(() => {
          hadError = true
          return {} as Record<string, AIProviderInfo>
        }),
        getAiConfig().catch(() => {
          hadError = true
          return null
        }),
        getAiMentors().catch(() => {
          hadError = true
          return [] as MentorInfo[]
        }),
      ])
      if (cancelled) return

      setProviders(providersData)
      setMentors(mentorsData)
      if (hadError) {
        setLoadError('Failed to load AI configuration. Backend may be unreachable.')
      }

      const providerKeys = Object.keys(providersData)
      const defaultProvider = providerKeys.length > 0 ? providerKeys[0] : ''
      const personality: Record<string, number> = {}
      const sourcePersonality = configData?.personality ?? null
      for (const m of mentorsData) {
        const value = sourcePersonality?.[m.key]
        personality[m.key] = typeof value === 'number' && Number.isFinite(value) ? value : 50
      }

      setForm({
        provider: configData?.provider || defaultProvider,
        baseUrl: configData?.base_url || providersData[configData?.provider ?? defaultProvider]?.default_url || '',
        apiKey: '',
        hasStoredKey: Boolean(configData?.has_api_key),
        removeStoredKey: false,
        model:
          configData?.model ||
          providersData[configData?.provider ?? defaultProvider]?.models?.[0] ||
          '',
        timeout: configData?.timeout ?? 60,
        maxRetries: configData?.max_retries ?? 3,
        temperature: configData?.temperature ?? 0.3,
        personality,
      })
      setLoaded(true)
      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

  // When provider changes (after initial load), align base URL & default model
  // for non-custom providers without overriding intentional user choices.
  useEffect(() => {
    if (!loaded) return
    if (form.provider === 'custom') return
    const next = providers[form.provider]
    if (!next) return
    setForm((prev) => ({
      ...prev,
      baseUrl: next.default_url,
      model: next.models.includes(prev.model) ? prev.model : next.models[0] ?? prev.model,
    }))
  }, [form.provider, providers, loaded])

  const setProvider = useCallback((provider: string) => {
    setForm((prev) => ({ ...prev, provider }))
  }, [])
  const setBaseUrl = useCallback((url: string) => setForm((p) => ({ ...p, baseUrl: url })), [])
  const setApiKey = useCallback((key: string) => {
    setForm((p) => ({ ...p, apiKey: key, removeStoredKey: key ? false : p.removeStoredKey }))
  }, [])
  const setRemoveStoredKey = useCallback((flag: boolean) => {
    setForm((p) => ({ ...p, removeStoredKey: flag }))
  }, [])
  const setModel = useCallback((model: string) => setForm((p) => ({ ...p, model })), [])
  const setTimeoutValue = useCallback((n: number) => setForm((p) => ({ ...p, timeout: n })), [])
  const setMaxRetries = useCallback((n: number) => setForm((p) => ({ ...p, maxRetries: n })), [])
  const setTemperature = useCallback((n: number) => setForm((p) => ({ ...p, temperature: n })), [])
  const setPersonality = useCallback((key: string, value: number) => {
    setForm((p) => ({ ...p, personality: { ...p.personality, [key]: value } }))
  }, [])

  const save = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      const provider = providers[form.provider]
      const needsKey = provider?.needs_api_key ?? form.provider !== 'custom'
      const payload: AiConfigSaveRequest = {
        provider: form.provider,
        base_url: form.baseUrl,
        api_key: needsKey && form.apiKey.trim() ? form.apiKey.trim() : undefined,
        remove_api_key: needsKey && form.removeStoredKey,
        model: form.model,
        timeout: form.timeout,
        max_retries: form.maxRetries,
        temperature: form.temperature,
        personality: form.personality,
      }
      await saveAiConfig(payload)
      setForm((prev) => ({
        ...prev,
        apiKey: '',
        hasStoredKey: needsKey
          ? prev.removeStoredKey
            ? false
            : prev.apiKey.trim()
              ? true
              : prev.hasStoredKey
          : prev.hasStoredKey,
        removeStoredKey: false,
      }))
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [form, providers])

  const test = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testAiConnection()
      setTestResult(result)
    } catch {
      setTestResult({ status: 'error', error: 'Test request failed' })
    } finally {
      setTesting(false)
    }
  }, [])

  const reload = useCallback(() => {
    setLoaded(false)
    setLoadError(null)
    setReloadToken((n) => n + 1)
  }, [])

  return {
    form,
    providers,
    mentors,
    loaded,
    loading,
    loadError,
    saving,
    saved,
    testing,
    testResult,
    setProvider,
    setBaseUrl,
    setApiKey,
    setRemoveStoredKey,
    setModel,
    setTimeout: setTimeoutValue,
    setMaxRetries,
    setTemperature,
    setPersonality,
    save,
    test,
    reload,
  }
}
