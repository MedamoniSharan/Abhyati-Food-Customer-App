import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import { loginCustomer, signupCustomer } from '../services/authApi'
import type { AuthUser } from '../services/authApi'

type AuthView = 'welcome' | 'login' | 'signup'

export type AuthSuccessPayload = {
  message: string
  user: AuthUser
}

type Props = {
  onAuthenticated: (payload: AuthSuccessPayload) => void
}

export function AuthScreen({ onAuthenticated }: Props) {
  const { showToast } = useToast()
  const [view, setView] = useState<AuthView>('welcome')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submitAuth() {
    setLoading(true)

    try {
      if (view === 'signup') {
        const result = await signupCustomer({ fullName, email, password })
        onAuthenticated({ message: `Welcome ${result.user.fullName}`, user: result.user })
        return
      }

      const result = await loginCustomer({ email, password })
      onAuthenticated({ message: `Welcome back ${result.user.fullName}`, user: result.user })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      showToast(message, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (view === 'welcome') {
    return (
      <section className="auth-shell auth-welcome">
        <div className="auth-overlay" />
        <div className="auth-content">
          <img src="/app-logo.png" alt="Abhyati food logo" className="auth-logo" />
          <h1>Abhyati food</h1>
          <p className="auth-welcome-hint">Shop and order from our catalog</p>
          <div className="auth-welcome-actions">
            <button type="button" className="auth-primary-btn" onClick={() => setView('login')}>
              Get started
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="auth-shell auth-form-shell">
      <div className="auth-overlay" />
      <div className="auth-form-card">
        <img src="/app-logo.png" alt="Abhyati food logo" className="auth-logo auth-logo-top" />
        <h2>{view === 'login' ? 'Welcome Back !' : 'Create Account'}</h2>
        <p>
          {view === 'login' ? 'Your world of living colors awaits' : 'Join Abhyati food today'}
        </p>

        {view === 'signup' ? (
          <input
            className="auth-input"
            placeholder="Full Name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        ) : null}
        <input
          className="auth-input"
          placeholder="Email Address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div className="auth-password-field">
          <input
            className="auth-input"
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>

        <button type="button" className="auth-primary-btn" onClick={() => void submitAuth()} disabled={loading}>
          {loading ? 'Please wait...' : view === 'signup' ? 'Create Account' : 'Log In'}
        </button>

        <button
          type="button"
          className="auth-link-btn"
          onClick={() => setView((prev) => (prev === 'login' ? 'signup' : 'login'))}
        >
          {view === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
        </button>
      </div>
    </section>
  )
}
