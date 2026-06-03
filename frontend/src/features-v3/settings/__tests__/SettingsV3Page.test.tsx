import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { SettingsV3Page } from '../SettingsV3Page'
import type { AIProviderInfo, AiConfigResponse, MentorInfo } from '@/types/ai'

const mocks = vi.hoisted(() => ({
  getAiProviders: vi.fn(),
  getAiConfig: vi.fn(),
  getAiMentors: vi.fn(),
  saveAiConfig: vi.fn(),
  testAiConnection: vi.fn(),
  logout: vi.fn(),
  toggleTheme: vi.fn(),
  setNavMode: vi.fn(),
}))

vi.mock('@/lib/endpoints', () => ({
  getAiProviders: mocks.getAiProviders,
  getAiConfig: mocks.getAiConfig,
  getAiMentors: mocks.getAiMentors,
  saveAiConfig: mocks.saveAiConfig,
  testAiConnection: mocks.testAiConnection,
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 1, email: 'trader@example.com', full_name: 'Demo Trader', is_active: true },
    logout: mocks.logout,
  }),
}))

vi.mock('@/store/appStore', () => ({
  useAppStore: (sel: (s: {
    theme: 'dark' | 'light'
    toggleTheme: typeof mocks.toggleTheme
    navMode: 'simple' | 'pro'
    setNavMode: typeof mocks.setNavMode
  }) => unknown) =>
    sel({
      theme: 'dark',
      toggleTheme: mocks.toggleTheme,
      navMode: 'simple',
      setNavMode: mocks.setNavMode,
    }),
}))

function providers(): Record<string, AIProviderInfo> {
  return {
    openai: { label: 'OpenAI', default_url: 'https://api.openai.com/v1', needs_api_key: true, models: ['gpt-4o'] },
    anthropic: { label: 'Anthropic', default_url: 'https://api.anthropic.com/v1', needs_api_key: true, models: ['claude-3-opus'] },
  }
}

function config(overrides: Partial<AiConfigResponse> = {}): AiConfigResponse {
  return {
    provider: 'openai',
    base_url: 'https://api.openai.com/v1',
    has_api_key: true,
    model: 'gpt-4o',
    timeout: 60,
    max_retries: 3,
    temperature: 0.3,
    personality: { minervini: 60, manas: 40 },
    ...overrides,
  }
}

function mentors(): MentorInfo[] {
  return [
    { key: 'minervini', name: 'Minervini', description: 'Discipline-first stops.' },
    { key: 'manas', name: 'Manas Arora', description: 'Setup-first conviction.' },
  ]
}

function wrap(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => {
    if (typeof m.mockReset === 'function') m.mockReset()
  })
})

describe('SettingsV3Page', () => {
  it('renders all expected sections', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config())
    mocks.getAiMentors.mockResolvedValue(mentors())

    render(wrap(<SettingsV3Page />))

    expect(await screen.findByText('Settings')).toBeInTheDocument()
    expect(screen.getByText(/Account/i)).toBeInTheDocument()
    expect(screen.getByText(/App preferences/i)).toBeInTheDocument()
    expect(screen.getByText(/^System$/)).toBeInTheDocument()
    // "AI provider" appears in page subtitle and section title.
    expect(screen.getAllByText(/AI provider/i).length).toBeGreaterThan(0)
  })

  it('renders profile fields read-only honestly', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config())
    mocks.getAiMentors.mockResolvedValue(mentors())

    render(wrap(<SettingsV3Page />))
    expect(await screen.findByText('trader@example.com')).toBeInTheDocument()
    expect(screen.getByText('Demo Trader')).toBeInTheDocument()
    expect(screen.getAllByText(/Read-only/i).length).toBeGreaterThan(0)
  })

  it('masks the stored API key (no real value rendered)', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config({ has_api_key: true }))
    mocks.getAiMentors.mockResolvedValue(mentors())

    render(wrap(<SettingsV3Page />))
    // Wait for AI panel to load.
    await waitFor(() => expect(screen.getByLabelText(/^API key$/i)).toBeInTheDocument())
    const input = screen.getByLabelText(/^API key$/i) as HTMLInputElement
    expect(input.type).toBe('password')
    expect(input.value).toBe('')
    expect(input.placeholder).toMatch(/leave blank to keep/i)
    // Bullet badge present, no fake key text.
    expect(screen.queryByText(/sk-/)).toBeNull()
  })

  it('renders mentor personality sliders when mentors load', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config())
    mocks.getAiMentors.mockResolvedValue(mentors())

    render(wrap(<SettingsV3Page />))
    expect(await screen.findByLabelText(/Minervini influence/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Manas Arora influence/i)).toBeInTheDocument()
  })

  it('renders load error message when AI endpoints fail', async () => {
    mocks.getAiProviders.mockRejectedValue(new Error('boom'))
    mocks.getAiConfig.mockRejectedValue(new Error('boom'))
    mocks.getAiMentors.mockRejectedValue(new Error('boom'))

    render(wrap(<SettingsV3Page />))
    expect(await screen.findByText(/Failed to load AI configuration/i)).toBeInTheDocument()
  })

  it('renders legacy fallback when callback supplied', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config())
    mocks.getAiMentors.mockResolvedValue(mentors())

    const onOpenLegacy = vi.fn()
    render(wrap(<SettingsV3Page onOpenLegacy={onOpenLegacy} />))
    const button = await screen.findByText(/Open legacy settings/i)
    const user = userEvent.setup()
    await user.click(button)
    expect(onOpenLegacy).toHaveBeenCalled()
  })

  it('does not surface NaN/undefined/null/[object Object]', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config())
    mocks.getAiMentors.mockResolvedValue(mentors())

    render(wrap(<SettingsV3Page />))
    await screen.findByText('Settings')
    expect(screen.queryByText(/NaN/)).toBeNull()
    expect(screen.queryByText(/^undefined$/)).toBeNull()
    expect(screen.queryByText(/^null$/)).toBeNull()
    expect(screen.queryByText(/object Object/)).toBeNull()
  })

  it('does not render fake provider sync or AI status', async () => {
    mocks.getAiProviders.mockResolvedValue(providers())
    mocks.getAiConfig.mockResolvedValue(config())
    mocks.getAiMentors.mockResolvedValue(mentors())

    render(wrap(<SettingsV3Page />))
    await screen.findByText('Settings')
    // Test result is null until user clicks Test connection.
    expect(screen.queryByText(/Connection successful/i)).toBeNull()
    expect(screen.queryByText(/Connection failed/i)).toBeNull()
  })
})
