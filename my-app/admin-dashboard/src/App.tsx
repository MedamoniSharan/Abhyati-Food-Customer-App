import { useCallback, useEffect, useState } from 'react'
import { adminFetch, adminLogin, getAdminToken, setAdminToken } from './adminApi'
import { IconDeleteButton, IconEditButton } from './components/AdminIconButtons'
import { ProductsSection } from './components/ProductsSection'

type Page = 'dashboard' | 'customers' | 'drivers' | 'products' | 'deliveries' | 'settings'

type ZohoContactRow = { contact_id?: string; contact_name?: string; email?: string }
type SalesOrderRow = {
  salesorder_id?: string
  salesorder_number?: string
  reference_number?: string
  customer_name?: string
  date?: string
  status?: string
  total?: number
}

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
  const [salesOrdersRaw, setSalesOrdersRaw] = useState<SalesOrderRow[]>([])
  /** Zoho items for sales-order line picker (broader list than paginated products page). */
  const [orderItems, setOrderItems] = useState<Array<Record<string, unknown>>>([])
  const [zohoContacts, setZohoContacts] = useState<ZohoContactRow[]>([])
  const [newCustomer, setNewCustomer] = useState({ fullName: '', email: '', password: '', mobile: '' })
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<{ id: string; fullName: string; email: string } | null>(null)
  const [editingCustomerMobile, setEditingCustomerMobile] = useState('')
  const [editingCustomerPassword, setEditingCustomerPassword] = useState('')
  const [newDriver, setNewDriver] = useState({ fullName: '', email: '', password: '' })
  const [orderCustomerId, setOrderCustomerId] = useState('')
  const [orderRef, setOrderRef] = useState('')
  const [orderLines, setOrderLines] = useState([{ item_id: '', quantity: '1', rate: '' }])

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
    const r = await adminFetch<{ deliveries: DeliveryRow[]; salesorders?: SalesOrderRow[] }>(
      '/api/admin/deliveries'
    )
    setDeliveries(r.deliveries || [])
    setSalesOrdersRaw(Array.isArray(r.salesorders) ? r.salesorders : [])
    try {
      const ir = await adminFetch<{ items?: Array<Record<string, unknown>> }>('/api/admin/items?per_page=200')
      setOrderItems(Array.isArray(ir.items) ? ir.items : [])
    } catch {
      setOrderItems([])
    }
  }, [])

  const refreshZohoContacts = useCallback(async () => {
    const r = await adminFetch<{ contacts?: ZohoContactRow[] }>('/api/admin/zoho/customer-contacts')
    setZohoContacts(Array.isArray(r.contacts) ? r.contacts : [])
  }, [])

  const loadPageData = useCallback(async () => {
    setLoadErr('')
    try {
      if (page === 'dashboard') await refreshOverview()
      if (page === 'customers') await refreshCustomers()
      if (page === 'drivers') await refreshDrivers()
      if (page === 'deliveries') {
        await Promise.all([refreshDeliveries(), refreshZohoContacts()])
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load')
      if (String(e).includes('401') || String(e).includes('Invalid')) {
        setAdminToken(null)
        setTokenState(null)
      }
    }
  }, [page, refreshCustomers, refreshDeliveries, refreshDrivers, refreshOverview, refreshZohoContacts])

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
              ['deliveries', 'Orders & delivery'],
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
              <div className="admin-form-row" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="admin-btn admin-btn-inline" onClick={() => setShowAddCustomerModal(true)}>
                  Add
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.fullName}</td>
                        <td>{c.email}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <IconEditButton
                              label={`Edit customer ${c.email}`}
                              onClick={() => {
                                setEditingCustomer({ id: c.id, fullName: c.fullName, email: c.email })
                                setEditingCustomerMobile('')
                                setEditingCustomerPassword('')
                              }}
                            />
                            <IconDeleteButton
                              label={`Delete customer ${c.email}`}
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
                            />
                          </div>
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
                          <IconDeleteButton
                            label={`Remove driver ${d.email}`}
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
                          />
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
              <h2 style={{ marginTop: 0 }}>Orders & delivery</h2>
              <p style={{ color: 'var(--admin-muted)', maxWidth: 720 }}>
                The delivery app loads the same <strong>Zoho Books sales orders</strong> as stops here. Creating or
                updating orders in Zoho (or below) updates what drivers see. Line items should use Zoho{' '}
                <strong>item IDs</strong> from your catalog so challans and stock sync work.
              </p>

              <h3 style={{ marginBottom: 8 }}>Create sales order</h3>
              <div className="admin-form-row" style={{ flexDirection: 'column', alignItems: 'stretch', maxWidth: 640 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--admin-muted)' }}>Zoho customer</label>
                <select
                  className="admin-input"
                  value={orderCustomerId}
                  onChange={(e) => setOrderCustomerId(e.target.value)}
                  style={{ marginBottom: 8 }}
                >
                  <option value="">Select customer…</option>
                  {zohoContacts.map((c) => (
                    <option key={String(c.contact_id)} value={String(c.contact_id ?? '')}>
                      {c.contact_name || c.email || c.contact_id} ({c.email || 'no email'})
                    </option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  placeholder="Reference (optional, e.g. WEB-1024)"
                  value={orderRef}
                  onChange={(e) => setOrderRef(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                {orderLines.map((line, idx) => (
                  <div key={idx} className="admin-form-row" style={{ width: '100%' }}>
                    <select
                      className="admin-input"
                      style={{ flex: 2, minWidth: 200 }}
                      value={line.item_id}
                      onChange={(e) => {
                        const itemId = e.target.value
                        const it = orderItems.find((x) => String(x.item_id) === itemId)
                        const rate = it?.rate != null ? String(it.rate) : line.rate
                        setOrderLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, item_id: itemId, rate } : r))
                        )
                      }}
                    >
                      <option value="">Item…</option>
                      {orderItems.map((it) => (
                        <option key={String(it.item_id)} value={String(it.item_id ?? '')}>
                          {String(it.name ?? it.item_id)} — {String(it.rate ?? '')}
                        </option>
                      ))}
                    </select>
                    <input
                      className="admin-input"
                      style={{ width: 80 }}
                      type="number"
                      min={1}
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) =>
                        setOrderLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                        )
                      }
                    />
                    <input
                      className="admin-input"
                      style={{ width: 100 }}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Rate"
                      value={line.rate}
                      onChange={(e) =>
                        setOrderLines((rows) =>
                          rows.map((r, i) => (i === idx ? { ...r, rate: e.target.value } : r))
                        )
                      }
                    />
                    {orderLines.length > 1 ? (
                      <IconDeleteButton
                        label="Remove line"
                        onClick={() => setOrderLines((rows) => rows.filter((_, i) => i !== idx))}
                      />
                    ) : null}
                  </div>
                ))}
                <div className="admin-form-row">
                  <button
                    type="button"
                    className="admin-btn admin-btn-inline"
                    style={{ background: '#444' }}
                    onClick={() => setOrderLines((rows) => [...rows, { item_id: '', quantity: '1', rate: '' }])}
                  >
                    Add line
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-inline"
                    onClick={async () => {
                      if (!orderCustomerId) {
                        alert('Choose a Zoho customer')
                        return
                      }
                      const lines = orderLines
                        .filter((l) => l.item_id)
                        .map((l) => ({
                          item_id: l.item_id,
                          quantity: Number(l.quantity) || 1,
                          rate: Number(l.rate) || 0
                        }))
                      if (lines.length === 0) {
                        alert('Add at least one line with an item')
                        return
                      }
                      try {
                        await adminFetch('/api/admin/sales-orders', {
                          method: 'POST',
                          body: JSON.stringify({
                            customer_id: orderCustomerId,
                            ...(orderRef.trim() ? { reference_number: orderRef.trim() } : {}),
                            line_items: lines
                          })
                        })
                        setOrderRef('')
                        setOrderLines([{ item_id: '', quantity: '1', rate: '' }])
                        await refreshDeliveries()
                        alert('Sales order created in Zoho Books')
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Failed')
                      }
                    }}
                  >
                    Create in Zoho
                  </button>
                </div>
              </div>

              <h3 style={{ marginTop: 28, marginBottom: 8 }}>Driver view (stops)</h3>
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

              <h3 style={{ marginTop: 28, marginBottom: 8 }}>Sales orders (Zoho)</h3>
              <p style={{ color: 'var(--admin-muted)', fontSize: '0.875rem' }}>
                Edit status or details in Zoho Books, or use <code>PUT /api/admin/sales-orders/:id</code> with a raw
                Zoho payload for advanced updates.
              </p>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrdersRaw.map((so) => (
                      <tr key={String(so.salesorder_id)}>
                        <td>{String(so.salesorder_number || so.reference_number || '—')}</td>
                        <td>{String(so.customer_name || '—')}</td>
                        <td>{String(so.date || '—')}</td>
                        <td>{String(so.status || '—')}</td>
                        <td>{so.total != null ? String(so.total) : '—'}</td>
                        <td style={{ fontSize: '0.75rem' }}>{String(so.salesorder_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {page === 'products' ? <ProductsSection /> : null}

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

          {showAddCustomerModal ? (
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowAddCustomerModal(false)
              }}
            >
              <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
                <h3 className="admin-modal__title">Add customer</h3>
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
                <div className="admin-modal__footer">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setShowAddCustomerModal(false)}>
                    Cancel
                  </button>
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
                        setShowAddCustomerModal(false)
                        await refreshCustomers()
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Failed')
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {editingCustomer ? (
            <div
              className="admin-modal-backdrop"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setEditingCustomer(null)
              }}
            >
              <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
                <h3 className="admin-modal__title">Edit customer</h3>
                <input
                  className="admin-input"
                  placeholder="Full name"
                  value={editingCustomer.fullName}
                  onChange={(e) => setEditingCustomer((c) => (c ? { ...c, fullName: e.target.value } : c))}
                />
                <input
                  className="admin-input"
                  placeholder="Email"
                  type="email"
                  value={editingCustomer.email}
                  onChange={(e) => setEditingCustomer((c) => (c ? { ...c, email: e.target.value } : c))}
                />
                <input
                  className="admin-input"
                  placeholder="New password (optional)"
                  type="password"
                  value={editingCustomerPassword}
                  onChange={(e) => setEditingCustomerPassword(e.target.value)}
                />
                <input
                  className="admin-input"
                  placeholder="Mobile (optional)"
                  value={editingCustomerMobile}
                  onChange={(e) => setEditingCustomerMobile(e.target.value)}
                />
                <div className="admin-modal__footer">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditingCustomer(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-inline"
                    onClick={async () => {
                      const original = customers.find((c) => c.id === editingCustomer.id)
                      if (!original) {
                        alert('Customer not found in current list')
                        return
                      }
                      try {
                        await adminFetch(`/api/admin/customers/${encodeURIComponent(original.email)}`, {
                          method: 'PUT',
                          body: JSON.stringify({
                            fullName: editingCustomer.fullName,
                            email: editingCustomer.email,
                            ...(editingCustomerPassword ? { password: editingCustomerPassword } : {}),
                            ...(editingCustomerMobile ? { mobile: editingCustomerMobile } : {})
                          })
                        })
                        setEditingCustomer(null)
                        setEditingCustomerMobile('')
                        setEditingCustomerPassword('')
                        await refreshCustomers()
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Failed')
                      }
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  )
}
