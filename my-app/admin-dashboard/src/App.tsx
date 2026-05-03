import { useCallback, useEffect, useState } from 'react'
import { adminFetch, adminLogin, getAdminToken, setAdminToken } from './adminApi'

type Page = 'dashboard' | 'customers' | 'drivers' | 'products' | 'deliveries' | 'settings'

type Overview = {
  invoiceCount: number
  salesOrderCount: number
  appCustomerCount: number
  revenueApprox: number
  currency: string
}

type AuthUser = { id: string; fullName: string; email: string }

type DeliveryRow = {
  id: string
  orderId: string
  customerName: string
  statusTag: string
  amount: number
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => getAdminToken())
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [page, setPage] = useState<Page>('dashboard')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [customers, setCustomers] = useState<AuthUser[]>([])
  const [drivers, setDrivers] = useState<
    Array<AuthUser & { zohoContactId?: string; disabled?: boolean }>
  >([])
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [items, setItems] = useState<Array<Record<string, unknown>>>([])
  const [newCustomer, setNewCustomer] = useState({ fullName: '', email: '', password: '', mobile: '' })
  const [newDriver, setNewDriver] = useState({ fullName: '', email: '', password: '' })

  const refreshOverview = useCallback(async () => {
    const o = await adminFetch<Overview>('/api/admin/overview')
    setOverview(o)
  }, [])

  const refreshCustomers = useCallback(async () => {
    const r = await adminFetch<{ customers: AuthUser[] }>('/api/admin/customers')
    setCustomers(r.customers || [])
  }, [])

  const refreshDrivers = useCallback(async () => {
    const r = await adminFetch<{ drivers: typeof drivers }>('/api/admin/drivers')
    setDrivers(r.drivers || [])
  }, [])

  const refreshDeliveries = useCallback(async () => {
    const r = await adminFetch<{ deliveries: DeliveryRow[] }>('/api/admin/deliveries')
    setDeliveries(r.deliveries || [])
  }, [])

  const refreshItems = useCallback(async () => {
    const r = await adminFetch<{ items?: Array<Record<string, unknown>> }>('/api/admin/items?per_page=50')
    setItems(Array.isArray(r.items) ? r.items : [])
  }, [])

  const loadPageData = useCallback(async () => {
    setLoadErr('')
    try {
      if (page === 'dashboard') await refreshOverview()
      if (page === 'customers') await refreshCustomers()
      if (page === 'drivers') await refreshDrivers()
      if (page === 'deliveries') await refreshDeliveries()
      if (page === 'products') await refreshItems()
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load')
      if (String(e).includes('401') || String(e).includes('Invalid')) {
        setAdminToken(null)
        setTokenState(null)
      }
    }
  }, [page, refreshCustomers, refreshDeliveries, refreshDrivers, refreshItems, refreshOverview])

  useEffect(() => {
    if (!token) return
    void loadPageData()
  }, [token, page, loadPageData])

  async function onLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const t = await adminLogin(loginEmail.trim(), loginPassword)
      setTokenState(t)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoginLoading(false)
    }
  }

  function logout() {
    setAdminToken(null)
    setTokenState(null)
  }

  if (!token) {
    return (
      <div className="admin-login">
        <form className="admin-login-card" onSubmit={onLogin}>
          <h1>Abhyati Admin</h1>
          <p>Sign in with your administrator account.</p>
          {loginError ? <div className="admin-error">{loginError}</div> : null}
          <input
            className="admin-input"
            type="email"
            autoComplete="username"
            placeholder="Admin email"
            value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)}
            required
          />
          <input
            className="admin-input"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
          <button className="admin-btn" type="submit" disabled={loginLoading}>
            {loginLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Abhyati Admin</div>
        <nav className="admin-nav">
          {(
            [
              ['dashboard', 'Dashboard'],
              ['customers', 'Customers'],
              ['drivers', 'Drivers'],
              ['products', 'Products'],
              ['deliveries', 'Deliveries'],
              ['settings', 'Settings']
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <button type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <strong style={{ textTransform: 'capitalize' }}>{page}</strong>
          <span style={{ color: 'var(--admin-muted)', fontSize: '0.875rem' }}>Zoho Books connected</span>
        </header>
        <main className="admin-content">
          {loadErr ? <div className="admin-error">{loadErr}</div> : null}

          {page === 'dashboard' && overview ? (
            <div className="admin-kpis">
              <div className="admin-kpi">
                <h3>Invoices (sample)</h3>
                <p className="val">{overview.invoiceCount}</p>
              </div>
              <div className="admin-kpi">
                <h3>Sales orders</h3>
                <p className="val">{overview.salesOrderCount}</p>
              </div>
              <div className="admin-kpi">
                <h3>App customers</h3>
                <p className="val">{overview.appCustomerCount}</p>
              </div>
              <div className="admin-kpi">
                <h3>Revenue (first page sum)</h3>
                <p className="val">
                  {overview.currency} {overview.revenueApprox.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          ) : null}

          {page === 'customers' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Customers</h2>
              <p style={{ color: 'var(--admin-muted)' }}>Create app logins and Zoho customer contacts.</p>
              <div className="admin-form-row">
                <input
                  className="admin-input"
                  placeholder="Full name"
                  value={newCustomer.fullName}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, fullName: e.target.value }))}
                />
                <input
                  className="admin-input"
                  placeholder="Email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                />
                <input
                  className="admin-input"
                  placeholder="Password"
                  type="password"
                  value={newCustomer.password}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, password: e.target.value }))}
                />
                <input
                  className="admin-input"
                  placeholder="Mobile (optional)"
                  value={newCustomer.mobile}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, mobile: e.target.value }))}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-inline"
                  onClick={async () => {
                    try {
                      await adminFetch('/api/admin/customers', {
                        method: 'POST',
                        body: JSON.stringify({
                          fullName: newCustomer.fullName,
                          email: newCustomer.email,
                          password: newCustomer.password,
                          ...(newCustomer.mobile ? { mobile: newCustomer.mobile } : {})
                        })
                      })
                      setNewCustomer({ fullName: '', email: '', password: '', mobile: '' })
                      await refreshCustomers()
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Failed')
                    }
                  }}
                >
                  Add customer
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.fullName}</td>
                        <td>{c.email}</td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            onClick={async () => {
                              if (!confirm(`Delete customer ${c.email}?`)) return
                              try {
                                await adminFetch(`/api/admin/customers/${encodeURIComponent(c.email)}`, {
                                  method: 'DELETE'
                                })
                                await refreshCustomers()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'Failed')
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {page === 'drivers' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Drivers</h2>
              <p style={{ color: 'var(--admin-muted)' }}>
                Creates a Zoho Books contact (vendor or customer per backend env) plus delivery login.
              </p>
              <div className="admin-form-row">
                <input
                  className="admin-input"
                  placeholder="Full name"
                  value={newDriver.fullName}
                  onChange={(e) => setNewDriver((c) => ({ ...c, fullName: e.target.value }))}
                />
                <input
                  className="admin-input"
                  placeholder="Email"
                  type="email"
                  value={newDriver.email}
                  onChange={(e) => setNewDriver((c) => ({ ...c, email: e.target.value }))}
                />
                <input
                  className="admin-input"
                  placeholder="Password"
                  type="password"
                  value={newDriver.password}
                  onChange={(e) => setNewDriver((c) => ({ ...c, password: e.target.value }))}
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-inline"
                  onClick={async () => {
                    try {
                      await adminFetch('/api/admin/drivers', {
                        method: 'POST',
                        body: JSON.stringify(newDriver)
                      })
                      setNewDriver({ fullName: '', email: '', password: '' })
                      await refreshDrivers()
                    } catch (e) {
                      alert(e instanceof Error ? e.message : 'Failed')
                    }
                  }}
                >
                  Add driver
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Zoho ID</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.id}>
                        <td>{d.fullName}</td>
                        <td>{d.email}</td>
                        <td style={{ fontSize: '0.75rem' }}>{d.zohoContactId}</td>
                        <td>
                          {d.disabled ? (
                            <span className="admin-pill-warn admin-pill">Disabled</span>
                          ) : (
                            <span className="admin-pill">Active</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-btn admin-btn-danger"
                            onClick={async () => {
                              if (!confirm(`Remove driver ${d.email}?`)) return
                              try {
                                await adminFetch(`/api/admin/drivers/${encodeURIComponent(d.email)}`, {
                                  method: 'DELETE'
                                })
                                await refreshDrivers()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'Failed')
                              }
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {page === 'deliveries' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Deliveries</h2>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td>{d.orderId}</td>
                        <td>{d.customerName}</td>
                        <td>{d.statusTag}</td>
                        <td>{d.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {page === 'products' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Products (Zoho items)</h2>
              <p style={{ color: 'var(--admin-muted)' }}>Read-only list in v1 UI; use Zoho Books or API for edits.</p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={String(it.item_id ?? it.name)}>
                        <td>{String(it.name ?? '')}</td>
                        <td>{String(it.sku ?? '')}</td>
                        <td>{String(it.rate ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {page === 'settings' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Settings</h2>
              <p>
                API base: same origin in dev (Vite proxy to backend). Configure Zoho and admin password in backend{' '}
                <code>.env</code>.
              </p>
              <p style={{ color: 'var(--admin-muted)' }}>
                Set <code>ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID</code> for automatic stock updates on delivery
                confirmation.
              </p>
            </>
          ) : null}
        </main>
      </div>
    </div>
  )
}
