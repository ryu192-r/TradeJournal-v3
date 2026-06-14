import { AppCanvas, Badge, Button, Panel, Stack } from '@/new-ui'
import { LockKeyhole } from 'lucide-react'
import { useState, type FormEvent } from 'react'

export const V3_PREVIEW_DEMO_EMAIL = 'demo@tradejournal.local'
export const V3_PREVIEW_DEMO_PASSWORD = 'Preview@123'

interface V3PreviewDemoLoginProps {
  onUnlock: () => void
}

export function V3PreviewDemoLogin({ onUnlock }: V3PreviewDemoLoginProps) {
  const [email, setEmail] = useState(V3_PREVIEW_DEMO_EMAIL)
  const [password, setPassword] = useState(V3_PREVIEW_DEMO_PASSWORD)
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (email.trim() !== V3_PREVIEW_DEMO_EMAIL || password !== V3_PREVIEW_DEMO_PASSWORD) {
      setError('Use the V3 preview demo credentials shown below.')
      return
    }

    localStorage.setItem('tjv3_preview_demo', 'enabled')
    onUnlock()
  }

  return (
    <AppCanvas className="tjv3-ui">
      <div style={{ maxWidth: '28rem' }}>
        <Panel
          title="V3 Shell Preview"
          description="Demo access for local preview only. This does not log into the production app."
          action={<Badge variant="accent">Preview only</Badge>}
        >
          <form onSubmit={handleSubmit}>
            <Stack>
              <div className="tjv3-empty-state__icon">
                <LockKeyhole aria-hidden="true" />
              </div>

              <label>
                <span className="tjv3-metric-card__label">Demo email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  style={inputStyle}
                />
              </label>

              <label>
                <span className="tjv3-metric-card__label">Demo password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                  style={inputStyle}
                />
              </label>

              {error && (
                <div role="alert" style={errorStyle}>
                  {error}
                </div>
              )}

              <Button type="submit" variant="primary">
                Open V3 preview
              </Button>

              <div className="tjv3-preview-table-note">
                ID: {V3_PREVIEW_DEMO_EMAIL}
                <br />
                Pass: {V3_PREVIEW_DEMO_PASSWORD}
              </div>
            </Stack>
          </form>
        </Panel>
      </div>
    </AppCanvas>
  )
}

const inputStyle = {
  width: '100%',
  minHeight: '2.6rem',
  marginTop: '0.4rem',
  border: '1px solid var(--tj-border)',
  borderRadius: 'var(--tj-radius-md)',
  background: 'color-mix(in srgb, var(--tj-text-secondary) 8%, transparent)',
  color: 'var(--tj-text-primary)',
  padding: '0.6rem 0.7rem',
} as const

const errorStyle = {
  border: '1px solid color-mix(in srgb, var(--tj-loss) 32%, transparent)',
  borderRadius: 'var(--tj-radius-md)',
  background: 'color-mix(in srgb, var(--tj-loss) 10%, transparent)',
  color: 'var(--tj-loss)',
  padding: '0.6rem 0.7rem',
} as const
