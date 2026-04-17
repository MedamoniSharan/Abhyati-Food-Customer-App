import { useState } from 'react'

type AuthView = 'welcome' | 'login' | 'signup'

type Props = {
  onAuthenticated: () => void
}

export function AuthScreen({ onAuthenticated }: Props) {
  const [view, setView] = useState<AuthView>('welcome')

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

        {view === 'signup' ? <input className="auth-input" placeholder="Full Name" /> : null}
        <input className="auth-input" placeholder="Email Address" type="email" />
        <input className="auth-input" placeholder="Password" type="password" />

        <button type="button" className="auth-primary-btn" onClick={onAuthenticated}>
          {view === 'login' ? 'Log In' : 'Create Account'}
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
