import { useState } from 'react'
import { useToast } from '../contexts/ToastContext'
import type { AuthUser } from '../services/authApi'

type Props = {
  onAuthenticated: (payload: { message: string; user: AuthUser }) => void
}

export function DriverAuthScreen({ onAuthenticated }: Props) {
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  function submit() {
    setLoading(true)
    try {
      const e = email.trim()
      const localPart = e.includes('@') ? e.slice(0, e.indexOf('@')) : e
      const displayName = localPart ? localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Driver'
      onAuthenticated({
        message: `Signed in as ${displayName}`,
        user: {
          id: 'driver_local',
          fullName: displayName,
          email: e || 'driver@local',
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed'
      showToast(message, { variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="auth-shell auth-form-shell">
      <div className="auth-overlay" />
      <div className="auth-form-card">
        <img src="/app-logo.png" alt="Abhyati food logo" className="auth-logo auth-logo-top" />
        <h2>Driver sign in</h2>
        <p>Local demo: sign in without the server (email optional).</p>

        <input
          className="auth-input"
          placeholder="Email Address"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <button type="button" className="auth-primary-btn" onClick={submit} disabled={loading}>
          {loading ? 'Please wait...' : 'Log In'}
        </button>
      </div>
    </section>
  )
}
