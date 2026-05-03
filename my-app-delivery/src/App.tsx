import { useEffect, useState } from 'react'
import { useToast } from './contexts/ToastContext'
import { DeliveryDriverApp } from './screens/delivery/DeliveryDriverApp'
import { DriverAuthScreen } from './screens/DriverAuthScreen'
import type { AuthUser } from './services/authApi'
import { checkBackendReachable } from './utils/backendHealth'
import { clearSignedIn, readSessionUser, readSignedIn, writeSignedIn } from './utils/authSession'

function App() {
  const { showToast } = useToast()
  const [isAuthenticated, setIsAuthenticated] = useState(readSignedIn)
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(() => (readSignedIn() ? readSessionUser() : null))
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)

  useEffect(() => {
    document.body.dataset.toastLayout = isAuthenticated ? 'main' : 'auth'
  }, [isAuthenticated])

  useEffect(() => {
    let cancelled = false
    void checkBackendReachable().then((ok) => {
      if (!cancelled) setBackendReachable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell">
      {backendReachable === false ? (
        <div className="api-offline-banner" role="status">
          Cannot reach the server. Check your connection or try again later.
        </div>
      ) : null}
      {!isAuthenticated ? (
        <DriverAuthScreen
          onAuthenticated={({ message, user }) => {
            writeSignedIn(user)
            setSessionUser(user)
            setIsAuthenticated(true)
            showToast(message, { variant: 'success' })
          }}
        />
      ) : (
        <DeliveryDriverApp
          user={sessionUser ?? { id: 'local', fullName: 'Driver', email: '' }}
          onLogout={() => {
            clearSignedIn()
            setIsAuthenticated(false)
            setSessionUser(null)
            showToast('Logged out successfully', { variant: 'success' })
          }}
          onNotify={(msg) => showToast(msg, { variant: 'info' })}
        />
      )}
    </div>
  )
}

export default App
