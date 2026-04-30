import { useEffect, useMemo, useState } from 'react'
import { getDefaultApiBase } from './apiBase'

const metricCards = [
  { key: 'total', label: 'Total' },
  { key: 'add', label: 'Add' },
  { key: 'delete', label: 'Delete' },
  { key: 'manage', label: 'Manage' }
]

const moduleKeyPriority = [
  'contacts',
  'customers',
  'invoices',
  'salesorders',
  'items',
  'salesreturns',
  'creditnotes',
  'deliverychallans'
]

function formatCount(value) {
  if (!Number.isFinite(value)) return '--'
  return new Intl.NumberFormat('en-IN').format(value)
}

function extractRecords(data) {
  if (!data || typeof data !== 'object') return []
  for (const key of moduleKeyPriority) {
    if (Array.isArray(data[key])) return data[key]
  }
  const firstArray = Object.values(data).find((value) => Array.isArray(value))
  return Array.isArray(firstArray) ? firstArray : []
}

async function fetchModule(baseUrl, path) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${path} failed: ${response.status} ${response.statusText} ${text}`.trim())
  }
  const data = await response.json()
  return extractRecords(data)
}

export default function App() {
  const [baseUrl] = useState(getDefaultApiBase())
  const [activeMetric, setActiveMetric] = useState('total')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dataset, setDataset] = useState({
    customers: [],
    invoices: [],
    salesOrders: [],
    items: [],
    salesReturns: []
  })

  useEffect(() => {
    let isCancelled = false

    async function loadDashboard() {
      try {
        setLoading(true)
        setError('')
        const [customers, invoices, salesOrders, items, salesReturns] = await Promise.all([
          fetchModule(baseUrl, '/api/zoho/customers?per_page=200'),
          fetchModule(baseUrl, '/api/zoho/invoices?per_page=200'),
          fetchModule(baseUrl, '/api/zoho/sales-orders?per_page=200'),
          fetchModule(baseUrl, '/api/zoho/items?per_page=200'),
          fetchModule(baseUrl, '/api/zoho/sales-returns?per_page=200')
        ])

        if (!isCancelled) {
          setDataset({ customers, invoices, salesOrders, items, salesReturns })
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load Zoho Books data')
        }
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    loadDashboard()
    return () => {
      isCancelled = true
    }
  }, [baseUrl])

  const metrics = useMemo(() => {
    const add = dataset.customers.length
    const remove = dataset.salesReturns.length
    const manage = dataset.items.length
    const total = add + remove + manage + dataset.invoices.length + dataset.salesOrders.length
    return { total, add, delete: remove, manage }
  }, [dataset])

  const quickActions = useMemo(
    () => [
      {
        title: 'Add Customers',
        desc: `Total customer records in Zoho Books: ${formatCount(dataset.customers.length)}`
      },
      {
        title: 'Delete / Returns',
        desc: `Sales return documents available: ${formatCount(dataset.salesReturns.length)}`
      },
      {
        title: 'Manage Inventory',
        desc: `Inventory items available to manage: ${formatCount(dataset.items.length)}`
      },
      {
        title: 'Total Transactions',
        desc: `Invoices + Sales Orders: ${formatCount(dataset.invoices.length + dataset.salesOrders.length)}`
      }
    ],
    [dataset]
  )

  const recentRows = useMemo(() => {
    return dataset.salesOrders.slice(0, 8).map((order) => ({
      name: order.customer_name || order.contact_name || order.salesorder_number || 'Unknown',
      category: order.salesorder_number || order.reference_number || 'Sales Order',
      status: order.status || 'Unknown',
      updated: order.last_modified_time || order.date || 'N/A'
    }))
  }, [dataset.salesOrders])

  return (
    <div className="dashboard-shell">
      <aside className="left-nav">
        <div className="brand">
          <img src="/app-logo.png" alt="Abhyati food logo" className="brand-logo" />
          <div>
            <h1>Abhyati food</h1>
            <p>Admin Dashboard</p>
          </div>
        </div>
        <nav>
          <button type="button" className="nav-item active">
            Dashboard
          </button>
          <button type="button" className="nav-item">
            Endpoints
          </button>
          <button type="button" className="nav-item">
            Reports
          </button>
          <button type="button" className="nav-item">
            Settings
          </button>
        </nav>
      </aside>

      <main className="main-board">
        <header className="top-row">
          <input className="search-input" placeholder="Search dashboard..." />
          <div className="user-chip">Admin</div>
        </header>

        <section className="hero">
          <p>ADMIN OVERVIEW</p>
          <h2>Manage your store operations with clarity and speed</h2>
          <button type="button">Open Reports</button>
        </section>

        <section className="action-cards">
          {metricCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={activeMetric === card.key ? 'action-card active' : 'action-card'}
              onClick={() => setActiveMetric(card.key)}
            >
              <span className="action-title">{card.label}</span>
              <strong>{loading ? '...' : formatCount(metrics[card.key])}</strong>
              <small>{loading ? 'Loading from Zoho Books' : 'Live from Zoho Books'}</small>
            </button>
          ))}
        </section>

        {error ? <div className="error-banner">{error}</div> : null}

        <section className="board-grid">
          <div className="panel">
            <div className="panel-head">
              <h3>Quick Actions</h3>
              <span>{activeMetric}</span>
            </div>
            <div className="quick-action-list">
              {quickActions.map((item) => (
                <div key={item.title} className="quick-action-item">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                  <button type="button">Open</button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Statistic</h3>
              <span>Today</span>
            </div>
            <div className="stat-grid">
              <div className="stat-box">
                <span>Orders</span>
                <strong>{loading ? '--' : formatCount(dataset.salesOrders.length)}</strong>
              </div>
              <div className="stat-box">
                <span>Customers</span>
                <strong>{loading ? '--' : formatCount(dataset.customers.length)}</strong>
              </div>
              <div className="stat-box">
                <span>Invoices</span>
                <strong>{loading ? '--' : formatCount(dataset.invoices.length)}</strong>
              </div>
              <div className="stat-box">
                <span>Items</span>
                <strong>{loading ? '--' : formatCount(dataset.items.length)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Recent Updates</h3>
            <span>View all</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map((row) => (
                  <tr key={`${row.name}-${row.category}-${row.updated}`}>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.status}</td>
                    <td>{row.updated}</td>
                  </tr>
                ))}
                {!loading && recentRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No recent sales order updates found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
