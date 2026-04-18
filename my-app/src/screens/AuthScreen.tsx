import { useState } from 'react'
import { loginCustomer, signupCustomer } from '../services/authApi'

type AuthView = 'welcome' | 'login' | 'signup'

type Props = {
  onAuthenticated: (message: string) => void
}

export function AuthScreen({ onAuthenticated }: Props) {
  const [view, setView] = useState<AuthView>('welcome')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function resetFormError() {
    if (error) setError(null)
  }

  async function submitAuth() {
    setLoading(true)
    setError(null)

    try {
      if (view === 'signup') {
        const result = await signupCustomer({ fullName, email, password })
        onAuthenticated(`Welcome ${result.user.fullName}`)
        return
      }

      const result = await loginCustomer({ email, password })
      onAuthenticated(`Welcome back ${result.user.fullName}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed'
      setError(message)
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
          <p>Fresh supplies for your kitchen and business.</p>
          <button type="button" className="auth-primary-btn" onClick={() => setView('login')}>
            Get Started
          </button>
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
        <p>{view === 'login' ? 'Your world of living colors awaits' : 'Join Abhyati food today'}</p>

        {view === 'signup' ? (
          <input
            className="auth-input"
            placeholder="Full Name"
            value={fullName}
            onChange={(event) => {
              resetFormError()
              setFullName(event.target.value)
            }}
          />
        ) : null}
        <input
          className="auth-input"
          placeholder="Email Address"
          type="email"
          value={email}
          onChange={(event) => {
            resetFormError()
            setEmail(event.target.value)
          }}
        />
        <input
          className="auth-input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => {
            resetFormError()
            setPassword(event.target.value)
          }}
        />

        {error ? <p className="auth-error-text">{error}</p> : null}

        <button type="button" className="auth-primary-btn" onClick={submitAuth} disabled={loading}>
          {loading ? 'Please wait...' : view === 'login' ? 'Log In' : 'Create Account'}
        </button>

        <button
          type="button"
          className="auth-link-btn"
          onClick={() => {
            setError(null)
            setView((prev) => (prev === 'login' ? 'signup' : 'login'))
          }}
        >
          {view === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
        </button>
      </div>
    </section>
  )
}
