import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Loader2, BarChart3 } from 'lucide-react'

export function LoginPage() {
  const { login, register, isLoading, error, clearError } = useAuthStore()
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    clearError()

    if (isSignup) {
      if (password !== confirmPassword) {
        setFormError('Passwords do not match')
        return
      }
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters')
        return
      }
      try {
        await register(email, password, fullName)
      } catch {
        // Error handled by store
      }
    } else {
      try {
        await login(email, password)
      } catch {
        // Error handled by store
      }
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '160px',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent-muted mb-4">
            <BarChart3 className="w-6 h-6 text-accent" />
          </div>
          <h1 className="font-display text-2xl text-text-heading">TradeJournal</h1>
          <p className="text-[length:var(--text-sm)] text-text-muted mt-1">
            {isSignup ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border p-[var(--page-px)] space-y-[var(--page-gap)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (signup only) */}
            {isSignup && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>

            {/* Confirm Password (signup only) */}
            {isSignup && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border-medium bg-bg-elevated/50 px-3 py-2 text-sm text-text-heading placeholder:text-text-faint focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>
            )}

            {/* Error message */}
            {(formError || error) && (
              <div className="rounded-lg bg-loss-muted border border-loss/20 px-3 py-2 text-sm text-loss">
                {formError || error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[length:var(--text-sm)] font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-[150ms] ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSignup ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Switch between login/signup */}
          <div className="text-center">
            <span className="text-[length:var(--text-sm)] text-text-muted">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup)
                setFormError('')
                clearError()
              }}
              className="text-[length:var(--text-sm)] font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer"
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
