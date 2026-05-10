import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch, adminLogin, getAdminToken, setAdminToken } from './adminApi'
import { IconDeleteButton, IconEditButton } from './components/AdminIconButtons'
import { ProductsSection } from './components/ProductsSection'

type Page = 'dashboard' | 'customers' | 'drivers' | 'products' | 'deliveries' | 'settings'

type ZohoContactRow = { contact_id?: string; contact_name?: string; email?: string; mobile?: string; phone?: string }
type SalesOrderRow = {
  salesorder_id?: string
  salesorder_number?: string
  reference_number?: string
  customer_name?: string
  date?: string
  status?: string
  total?: number
}

type ZohoInvoiceRow = {
  invoice_id?: string
  invoice_number?: string
  date?: string
  invoice_date?: string
  due_date?: string
  customer_name?: string
  status?: string
  total?: number
  reference_number?: string
  salesorder_number?: string
}

type Overview = {
  invoiceCount: number
  salesOrderCount: number
  appCustomerCount: number
  revenueApprox: number
  currency: string
}

type AuthUser = { id: string; fullName: string; email: string }
type UnifiedCustomerRow = {
  key: string
  source: 'app' | 'zoho'
  fullName: string
  email: string
  mobile: string
  zohoContactId: string
  appId?: string
}

type DeliveryRow = {
  id: string
  orderId: string
  customerName: string
  statusTag: string
  amount: number
}

type DashboardStats = {
  totalOrders: number
  totalCustomers: number
  totalDrivers: number
  totalDeliveries: number
  totalRevenue: number
  currency: string
}

const TABLE_PAGE_SIZE = 8
const chartCurrencyFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

function formatCompactCurrency(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return chartCurrencyFormatter.format(Math.round(value))
}

function formatMoneyInr(value: number) {
  if (!Number.isFinite(value)) return '-'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
}

function startOfLocalDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function adminPageLoadingPhrase(p: Page): string {
  switch (p) {
    case 'dashboard':
      return 'Loading dashboard…'
    case 'customers':
      return 'Loading customers…'
    case 'drivers':
      return 'Loading drivers…'
    case 'products':
      return 'Loading products…'
    case 'deliveries':
      return 'Loading orders and delivery…'
    case 'settings':
      return 'Loading settings…'
    default:
      return 'Loading…'
  }
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    pageRows: rows.slice(start, start + pageSize),
    totalPages,
    safePage
  }
}

function SidebarIcon({
  kind
}: {
  kind: 'dashboard' | 'customers' | 'drivers' | 'products' | 'deliveries' | 'orders' | 'deliver' | 'settings' | 'logout' | 'plus'
}) {
  if (kind === 'plus') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (kind === 'dashboard') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3 13h8V3H3zM13 21h8v-6h-8zM13 11h8V3h-8zM3 21h8v-6H3z" />
      </svg>
    )
  }
  if (kind === 'customers') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="3.5" />
        <path d="M20 8v6M23 11h-6" />
      </svg>
    )
  }
  if (kind === 'drivers') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="8" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
        <path d="M3 17V6h10l4 4h4v7" />
      </svg>
    )
  }
  if (kind === 'products') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    )
  }
  if (kind === 'deliveries') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M9 19V6l12-3v13" />
        <path d="M3 6l12-3" />
        <path d="M3 6v13l12-3" />
      </svg>
    )
  }
  if (kind === 'orders') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="3.5" cy="6" r="1.5" />
        <circle cx="3.5" cy="12" r="1.5" />
        <circle cx="3.5" cy="18" r="1.5" />
      </svg>
    )
  }
  if (kind === 'deliver') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M9 19V6l12-3v13" />
        <path d="M3 6l12-3" />
        <path d="M3 6v13l12-3" />
      </svg>
    )
  }
  if (kind === 'settings') {
    return (
      <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.08V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 8.4 19.4a1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.08-.4H2.9a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.4a1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.08V2.9a2 2 0 0 1 4 0v.09A1.7 1.7 0 0 0 15.6 4.6a1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.08.4h.09a2 2 0 0 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z" />
      </svg>
    )
  }
  return (
    <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => getAdminToken() || 'no-auth')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [page, setPage] = useState<Page>('products')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [pageDataLoading, setPageDataLoading] = useState(false)
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
  const [editingCustomer, setEditingCustomer] = useState<{
    id?: string
    contactId?: string
    fullName: string
    email: string
    originalEmail?: string
  } | null>(null)
  const [editingCustomerMobile, setEditingCustomerMobile] = useState('')
  const [editingCustomerPassword, setEditingCustomerPassword] = useState('')
  const [newDriver, setNewDriver] = useState({ fullName: '', email: '', password: '' })
  const [orderCustomerId, setOrderCustomerId] = useState('')
  const [orderRef, setOrderRef] = useState('')
  const [orderLines, setOrderLines] = useState([{ item_id: '', quantity: '1', rate: '' }])
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [customersLoading, setCustomersLoading] = useState(false)
  const [customersSortAsc, setCustomersSortAsc] = useState(true)
  const [customersPage, setCustomersPage] = useState(1)
  const [selectedCustomerRowKeys, setSelectedCustomerRowKeys] = useState<Record<string, boolean>>({})
  const [zohoCustomersLoading, setZohoCustomersLoading] = useState(false)
  const [driversSortAsc, setDriversSortAsc] = useState(true)
  const [driversPage, setDriversPage] = useState(1)
  const [selectedDriverEmails, setSelectedDriverEmails] = useState<Record<string, boolean>>({})
  const [deliveriesSortAsc, setDeliveriesSortAsc] = useState(true)
  const [deliveriesPage, setDeliveriesPage] = useState(1)
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<Record<string, boolean>>({})
  const [salesOrdersSortAsc, setSalesOrdersSortAsc] = useState(true)
  const [salesOrdersPage, setSalesOrdersPage] = useState(1)
  const [selectedSalesOrders, setSelectedSalesOrders] = useState<Record<string, boolean>>({})
  const [invoicesRaw, setInvoicesRaw] = useState<ZohoInvoiceRow[]>([])
  const [invoicesSortAsc, setInvoicesSortAsc] = useState(false)
  const [invoicesPage, setInvoicesPage] = useState(1)
  const [invoiceAssignDriverEmail, setInvoiceAssignDriverEmail] = useState('')
  const [assigningInvoiceId, setAssigningInvoiceId] = useState<string | null>(null)

  const refreshOverview = useCallback(async () => {
    const o = await adminFetch<Overview>('/api/admin/overview')
    setOverview(o)
  }, [])

  const refreshCustomers = useCallback(async () => {
    setCustomersLoading(true)
    try {
      const r = await adminFetch<{ customers: AuthUser[] }>('/api/admin/customers')
      setCustomers(r.customers || [])
    } finally {
      setCustomersLoading(false)
    }
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

  const refreshInvoices = useCallback(async () => {
    const data = await adminFetch<{ invoices?: ZohoInvoiceRow[] }>('/api/admin/invoices')
    setInvoicesRaw(Array.isArray(data.invoices) ? data.invoices : [])
  }, [])

  const refreshZohoContacts = useCallback(async () => {
    setZohoCustomersLoading(true)
    try {
      const r = await adminFetch<{ contacts?: ZohoContactRow[] }>('/api/admin/zoho/customer-contacts')
      setZohoContacts(Array.isArray(r.contacts) ? r.contacts : [])
    } finally {
      setZohoCustomersLoading(false)
    }
  }, [])

  const refreshDashboardStats = useCallback(async () => {
    const [ov, cs, ds, del, zc] = await Promise.all([
      adminFetch<Overview>('/api/admin/overview'),
      adminFetch<{ customers?: AuthUser[] }>('/api/admin/customers'),
      adminFetch<{ drivers?: Array<AuthUser> }>('/api/admin/drivers'),
      adminFetch<{ deliveries?: DeliveryRow[]; salesorders?: SalesOrderRow[] }>('/api/admin/deliveries'),
      adminFetch<{ contacts?: ZohoContactRow[] }>('/api/admin/zoho/customer-contacts')
    ])
    const salesorders = Array.isArray(del.salesorders) ? del.salesorders : []
    setSalesOrdersRaw(salesorders)
    const totalRevenue = salesorders.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
    setDashboardStats({
      totalOrders: salesorders.length,
      totalCustomers: Array.isArray(zc.contacts) ? zc.contacts.length : Array.isArray(cs.customers) ? cs.customers.length : 0,
      totalDrivers: Array.isArray(ds.drivers) ? ds.drivers.length : 0,
      totalDeliveries: Array.isArray(del.deliveries) ? del.deliveries.length : 0,
      totalRevenue,
      currency: ov.currency || 'INR'
    })
  }, [])

  const loadPageData = useCallback(async () => {
    setLoadErr('')
    if (page === 'products' || page === 'settings') {
      setPageDataLoading(false)
      return
    }
    try {
      if (page === 'dashboard') {
        await Promise.all([refreshOverview(), refreshDashboardStats()])
      }
      if (page === 'customers') {
        await Promise.all([refreshCustomers(), refreshZohoContacts()])
      }
      if (page === 'drivers') await refreshDrivers()
      if (page === 'deliveries') {
        await Promise.all([refreshDeliveries(), refreshZohoContacts(), refreshDrivers(), refreshInvoices()])
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : 'Failed to load')
      if (String(e).includes('401') || String(e).includes('Invalid')) {
        setAdminToken(null)
        setTokenState(null)
      }
    } finally {
      setPageDataLoading(false)
    }
  }, [
    page,
    refreshCustomers,
    refreshDashboardStats,
    refreshDeliveries,
    refreshDrivers,
    refreshInvoices,
    refreshOverview,
    refreshZohoContacts
  ])

  useEffect(() => {
    if (!token) {
      setPageDataLoading(false)
      return
    }
    setPageDataLoading(true)
    void loadPageData()
  }, [token, page, loadPageData])

  const unifiedCustomers = useMemo(() => {
    const appRows: UnifiedCustomerRow[] = customers.map((c) => ({
      key: `app:${String(c.id ?? c.email)}`,
      source: 'app',
      fullName: c.fullName,
      email: c.email,
      mobile: '—',
      zohoContactId: '—',
      appId: c.id
    }))
    const zohoRows: UnifiedCustomerRow[] = zohoContacts.map((z) => ({
      key: `zoho:${String(z.contact_id ?? z.email ?? z.contact_name ?? Math.random())}`,
      source: 'zoho',
      fullName: String(z.contact_name ?? '—'),
      email: String(z.email ?? '—'),
      mobile: String(z.mobile ?? z.phone ?? '—'),
      zohoContactId: String(z.contact_id ?? '—')
    }))
    return [...appRows, ...zohoRows]
  }, [customers, zohoContacts])
  const sortedCustomers = useMemo(
    () =>
      [...unifiedCustomers].sort((a, b) =>
        customersSortAsc ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName)
      ),
    [unifiedCustomers, customersSortAsc]
  )
  const customersPaged = useMemo(
    () => paginateRows(sortedCustomers, customersPage, TABLE_PAGE_SIZE),
    [sortedCustomers, customersPage]
  )
  const selectedAppCustomers = useMemo(
    () => sortedCustomers.filter((c) => c.source === 'app' && selectedCustomerRowKeys[c.key]),
    [sortedCustomers, selectedCustomerRowKeys]
  )
  const handleDeleteSelectedCustomers = useCallback(async () => {
    if (selectedAppCustomers.length === 0) {
      alert('Select at least one app customer to delete.')
      return
    }
    const customerEmails = selectedAppCustomers.map((c) => c.email)
    if (!confirm(`Delete ${customerEmails.length} selected customer(s)?`)) return
    try {
      await Promise.all(
        customerEmails.map((email) =>
          adminFetch(`/api/admin/customers/${encodeURIComponent(email)}`, {
            method: 'DELETE'
          })
        )
      )
      setSelectedCustomerRowKeys((prev) => {
        const next = { ...prev }
        for (const row of selectedAppCustomers) delete next[row.key]
        return next
      })
      await Promise.all([refreshCustomers(), refreshZohoContacts()])
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed')
    }
  }, [selectedAppCustomers, refreshCustomers, refreshZohoContacts])
  const sortedDrivers = useMemo(
    () =>
      [...drivers].sort((a, b) =>
        driversSortAsc ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName)
      ),
    [drivers, driversSortAsc]
  )
  const driversPaged = useMemo(() => paginateRows(sortedDrivers, driversPage, TABLE_PAGE_SIZE), [sortedDrivers, driversPage])
  const sortedDeliveries = useMemo(
    () =>
      [...deliveries].sort((a, b) =>
        deliveriesSortAsc ? a.customerName.localeCompare(b.customerName) : b.customerName.localeCompare(a.customerName)
      ),
    [deliveries, deliveriesSortAsc]
  )
  const deliveriesPaged = useMemo(
    () => paginateRows(sortedDeliveries, deliveriesPage, TABLE_PAGE_SIZE),
    [sortedDeliveries, deliveriesPage]
  )
  const sortedSalesOrders = useMemo(
    () =>
      [...salesOrdersRaw].sort((a, b) =>
        salesOrdersSortAsc
          ? String(a.customer_name ?? '').localeCompare(String(b.customer_name ?? ''))
          : String(b.customer_name ?? '').localeCompare(String(a.customer_name ?? ''))
      ),
    [salesOrdersRaw, salesOrdersSortAsc]
  )
  const salesOrdersPaged = useMemo(
    () => paginateRows(sortedSalesOrders, salesOrdersPage, TABLE_PAGE_SIZE),
    [sortedSalesOrders, salesOrdersPage]
  )
  const sortedInvoices = useMemo(
    () =>
      [...invoicesRaw].sort((a, b) => {
        const ad = String(a.date ?? a.invoice_date ?? '')
        const bd = String(b.date ?? b.invoice_date ?? '')
        const da = ad.localeCompare(bd)
        return invoicesSortAsc ? da : -da
      }),
    [invoicesRaw, invoicesSortAsc]
  )
  const invoicesPaged = useMemo(
    () => paginateRows(sortedInvoices, invoicesPage, TABLE_PAGE_SIZE),
    [sortedInvoices, invoicesPage]
  )
  /** ProductsSection lives inside this branch; gating on its fetch would unmount it during load,
   * abort requests, and remount in a loop (many canceled /api/admin/items calls). */
  const isCurrentPageLoading = pageDataLoading
  /** Calendar buckets for the last 7 days (local time) — fits a trend line better than weekday-of-week totals. */
  const revenueLast7Days = useMemo(() => {
    const today = startOfLocalDay(new Date())
    const startDay = new Date(today)
    startDay.setDate(startDay.getDate() - 6)
    const rows: { label: string; shortLabel: string; value: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDay)
      d.setDate(startDay.getDate() + i)
      rows.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        shortLabel: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
        value: 0
      })
    }
    for (const so of salesOrdersRaw) {
      const raw = so.date ? new Date(String(so.date)) : null
      if (!raw || Number.isNaN(raw.getTime())) continue
      const orderDay = startOfLocalDay(raw)
      const idx = Math.round((orderDay.getTime() - startDay.getTime()) / 86400000)
      if (idx >= 0 && idx < 7) rows[idx].value += Number(so.total) || 0
    }
    return rows
  }, [salesOrdersRaw])
  const revenueChart = useMemo(() => {
    const width = 640
    const height = 220
    const padX = 24
    const padTop = 20
    const padBottom = 38
    const usableW = width - padX * 2
    const usableH = height - padTop - padBottom
    const maxValue = Math.max(1, ...revenueLast7Days.map((d) => d.value))
    const points = revenueLast7Days.map((d, i) => {
      const x = padX + (i / Math.max(1, revenueLast7Days.length - 1)) * usableW
      const y = padTop + (1 - d.value / maxValue) * usableH
      return { ...d, x, y }
    })
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
    const areaPath = `${linePath} L${(padX + usableW).toFixed(2)} ${(height - padBottom).toFixed(2)} L${padX.toFixed(2)} ${(height - padBottom).toFixed(2)} Z`
    const yTicks = [1, 0.75, 0.5, 0.25].map((n, tickIdx) => {
      const value = maxValue * n
      const y = padTop + (1 - n) * usableH
      return { tickIdx, y, label: formatCompactCurrency(value) }
    })
    const totalRevenue = revenueLast7Days.reduce((sum, d) => sum + d.value, 0)
    const avgRevenue = totalRevenue / Math.max(1, revenueLast7Days.length)
    const bestDay = revenueLast7Days.reduce(
      (best, day) => (day.value > best.value ? day : best),
      revenueLast7Days[0] ?? { label: '-', shortLabel: '-', value: 0 }
    )
    return { width, height, points, linePath, areaPath, yTicks, totalRevenue, avgRevenue, bestDay }
  }, [revenueLast7Days])
  const statusMix = useMemo(() => {
    const counts: Record<string, number> = { open: 0, invoiced: 0, paid: 0, other: 0 }
    for (const so of salesOrdersRaw) {
      const s = String(so.status ?? '').toLowerCase()
      if (s.includes('paid')) counts.paid += 1
      else if (s.includes('invoice')) counts.invoiced += 1
      else if (s.includes('open') || s.includes('draft')) counts.open += 1
      else counts.other += 1
    }
    const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0))
    return [
      { label: 'Open', value: counts.open, pct: Math.round((counts.open / total) * 100) },
      { label: 'Invoiced', value: counts.invoiced, pct: Math.round((counts.invoiced / total) * 100) },
      { label: 'Paid', value: counts.paid, pct: Math.round((counts.paid / total) * 100) },
      { label: 'Other', value: counts.other, pct: Math.round((counts.other / total) * 100) }
    ]
  }, [salesOrdersRaw])

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
    setTokenState('no-auth')
    setPageDataLoading(false)
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
        <div className="admin-brand">
          <div className="admin-brand__logo" aria-hidden>
            <img src="/admin-logo.png" alt="Abhyati logo" />
          </div>
          <div className="admin-brand__text">
            <strong>Abhyati</strong>
            <span>Admin Dashboard</span>
          </div>
        </div>
        <nav className="admin-nav">
          {(
            [
              ['dashboard', 'Dashboard', 'dashboard'],
              ['products', 'Products', 'products'],
              ['customers', 'Customers', 'customers'],
              ['drivers', 'Deliverers', 'drivers'],
              ['deliveries', 'Orders', 'orders'],
              ['settings', 'Deliver', 'deliver']
            ] as const
          ).map(([id, label, icon]) => (
            <button key={id} type="button" className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              <SidebarIcon kind={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-quick">
          <button type="button" className="admin-nav-add-btn" onClick={() => setPage('products')}>
            <SidebarIcon kind="plus" />
            <span>Add product</span>
          </button>
        </div>
        <div className="admin-sidebar-footer">
          <button type="button" onClick={logout}>
            <SidebarIcon kind="logout" />
            <span>Log out</span>
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

          {isCurrentPageLoading ? (
            <div className="admin-page-loader" role="status" aria-live="polite" aria-busy="true">
              <div className="admin-page-loader__spinner" aria-hidden />
              <p className="admin-page-loader__text">{adminPageLoadingPhrase(page)}</p>
            </div>
          ) : (
            <>
          {page === 'dashboard' && overview ? (
            <>
              <div className="admin-kpis">
                <div className="admin-kpi">
                  <h3>Orders</h3>
                  <p className="val">{dashboardStats?.totalOrders ?? overview.salesOrderCount}</p>
                </div>
                <div className="admin-kpi">
                  <h3>Customers</h3>
                  <p className="val">{dashboardStats?.totalCustomers ?? overview.appCustomerCount}</p>
                </div>
                <div className="admin-kpi">
                  <h3>Drivers</h3>
                  <p className="val">{dashboardStats?.totalDrivers ?? 0}</p>
                </div>
                <div className="admin-kpi">
                  <h3>Deliveries</h3>
                  <p className="val">{dashboardStats?.totalDeliveries ?? 0}</p>
                </div>
                <div className="admin-kpi">
                  <h3>Revenue</h3>
                  <p className="val">
                    {dashboardStats?.currency ?? overview.currency}{' '}
                    {(dashboardStats?.totalRevenue ?? overview.revenueApprox).toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    })}
                  </p>
                </div>
              </div>
              <div className="admin-analytics-grid">
                <section className="admin-analytics-card">
                  <h3 className="admin-analytics-card__title">Revenue trend</h3>
                  <p className="admin-analytics-card__subtitle">
                    Sales order totals by day for the last 7 days (your local time). Amounts in{' '}
                    <strong>{dashboardStats?.currency ?? overview.currency}</strong>.
                  </p>
                  <div className="admin-chart-card">
                    <div className="admin-chart-summary">
                      <div className="admin-chart-pill">
                        <span>7-day total</span>
                        <strong>
                          {dashboardStats?.currency ?? overview.currency} {formatCompactCurrency(revenueChart.totalRevenue)}
                        </strong>
                      </div>
                      <div className="admin-chart-pill">
                        <span>Daily average</span>
                        <strong>
                          {dashboardStats?.currency ?? overview.currency} {formatCompactCurrency(revenueChart.avgRevenue)}
                        </strong>
                      </div>
                      <div className="admin-chart-pill">
                        <span>Best day</span>
                        <strong>
                          {revenueChart.bestDay.label} · {dashboardStats?.currency ?? overview.currency}{' '}
                          {formatCompactCurrency(revenueChart.bestDay.value)}
                        </strong>
                      </div>
                    </div>
                    <div className="admin-line-chart-wrap">
                      <svg
                        className="admin-line-chart"
                        viewBox={`0 0 ${revenueChart.width} ${revenueChart.height}`}
                        role="img"
                        aria-label="Revenue over the last 7 days"
                      >
                        {revenueChart.yTicks.map((tick) => (
                          <g key={tick.tickIdx}>
                            <line x1="24" x2={revenueChart.width - 24} y1={tick.y} y2={tick.y} className="admin-chart-grid-line" />
                            <text x="2" y={tick.y + 4} className="admin-chart-y-label">
                              {tick.label}
                            </text>
                          </g>
                        ))}
                        <path d={revenueChart.areaPath} className="admin-chart-area" />
                        <path d={revenueChart.linePath} className="admin-chart-line" />
                        {revenueChart.points.map((point, pi) => (
                          <g key={`${point.label}-${pi}`}>
                            <circle cx={point.x} cy={point.y} r="4" className="admin-chart-dot" />
                            <text x={point.x} y={revenueChart.height - 12} textAnchor="middle" className="admin-chart-x-label">
                              {point.shortLabel}
                            </text>
                            <title>{`${point.label}: ${chartCurrencyFormatter.format(Math.round(point.value))}`}</title>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </section>
                <section className="admin-analytics-card">
                  <h3>Order status mix</h3>
                  <div className="admin-status-chip-row">
                    {statusMix.map((s) => (
                      <div key={s.label} className="admin-status-chip">
                        <span>{s.label}</span>
                        <strong>{s.pct}%</strong>
                      </div>
                    ))}
                  </div>
                  <div className="admin-mix-list">
                    {statusMix.map((s) => (
                      <div key={s.label} className="admin-mix-row">
                        <span>{s.label}</span>
                        <div className="admin-mix-track">
                          <div
                            className={`admin-mix-fill admin-mix-fill--${s.label.toLowerCase()}`}
                            style={{ width: `${s.pct}%` }}
                          />
                        </div>
                        <strong>{s.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Invoices (first page)</td>
                      <td>{overview.invoiceCount}</td>
                    </tr>
                    <tr>
                      <td>Sales Orders</td>
                      <td>{overview.salesOrderCount}</td>
                    </tr>
                    <tr>
                      <td>App Customers</td>
                      <td>{overview.appCustomerCount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {page === 'customers' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Customers</h2>
              <p style={{ color: 'var(--admin-muted)' }}>App + Zoho customers in one list.</p>
              <div className="admin-form-row" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={selectedAppCustomers.length === 0}
                  onClick={() => void handleDeleteSelectedCustomers()}
                >
                  Delete selected ({selectedAppCustomers.length})
                </button>
                <button type="button" className="admin-btn admin-btn-inline" onClick={() => setShowAddCustomerModal(true)}>
                  Add
                </button>
              </div>
              {customersLoading || zohoCustomersLoading ? <div className="admin-section-loader">Loading customers…</div> : null}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            customersPaged.pageRows.length > 0 &&
                            customersPaged.pageRows.every((c) => selectedCustomerRowKeys[c.key])
                          }
                          onChange={(e) =>
                            setSelectedCustomerRowKeys((prev) => {
                              const next = { ...prev }
                              for (const c of customersPaged.pageRows) next[c.key] = e.target.checked
                              return next
                            })
                          }
                        />
                      </th>
                      <th
                        className="admin-th-sortable"
                        onClick={() => setCustomersSortAsc((v) => !v)}
                        title="Sort by name"
                      >
                        Name {customersSortAsc ? '▲' : '▼'}
                      </th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>Source</th>
                      <th>Zoho Contact ID</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!customersLoading && !zohoCustomersLoading && customersPaged.pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="admin-muted">
                          No customers found.
                        </td>
                      </tr>
                    ) : null}
                    {customersPaged.pageRows.map((c) => (
                      <tr key={c.key}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selectedCustomerRowKeys[c.key]}
                            onChange={(e) =>
                              setSelectedCustomerRowKeys((prev) => ({ ...prev, [c.key]: e.target.checked }))
                            }
                          />
                        </td>
                        <td>{c.fullName}</td>
                        <td>{c.email}</td>
                        <td>{c.mobile}</td>
                        <td>
                          <span className={c.source === 'app' ? 'admin-pill' : 'admin-pill admin-pill--muted'}>
                            {c.source === 'app' ? 'App' : 'Zoho'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{c.zohoContactId}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <IconEditButton
                              label={`Edit customer ${c.email}`}
                              onClick={() => {
                                if (c.source === 'app') {
                                  setEditingCustomer({
                                    id: c.appId,
                                    fullName: c.fullName,
                                    email: c.email,
                                    originalEmail: c.email
                                  })
                                  setEditingCustomerMobile('')
                                } else {
                                  setEditingCustomer({
                                    contactId: c.zohoContactId === '—' ? '' : c.zohoContactId,
                                    fullName: c.fullName,
                                    email: c.email === '—' ? '' : c.email,
                                    originalEmail: c.email === '—' ? '' : c.email
                                  })
                                  setEditingCustomerMobile(c.mobile === '—' ? '' : c.mobile)
                                }
                                setEditingCustomerPassword('')
                              }}
                            />
                            {c.source === 'app' ? (
                              <IconDeleteButton
                                label={`Delete customer ${c.email}`}
                                onClick={async () => {
                                  if (!confirm(`Delete customer ${c.email}?`)) return
                                  try {
                                    await adminFetch(`/api/admin/customers/${encodeURIComponent(c.email)}`, {
                                      method: 'DELETE'
                                    })
                                    await Promise.all([refreshCustomers(), refreshZohoContacts()])
                                  } catch (e) {
                                    alert(e instanceof Error ? e.message : 'Failed')
                                  }
                                }}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-table-pagination">
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  disabled={customersLoading || zohoCustomersLoading}
                  onClick={() => setCustomersPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span>
                  Page {customersPaged.safePage} / {customersPaged.totalPages}
                </span>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  disabled={customersLoading || zohoCustomersLoading}
                  onClick={() => setCustomersPage((p) => Math.min(customersPaged.totalPages, p + 1))}
                >
                  Next
                </button>
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
                      <th>
                        <input
                          type="checkbox"
                          checked={driversPaged.pageRows.length > 0 && driversPaged.pageRows.every((d) => selectedDriverEmails[d.email])}
                          onChange={(e) =>
                            setSelectedDriverEmails((prev) => {
                              const next = { ...prev }
                              for (const d of driversPaged.pageRows) next[d.email] = e.target.checked
                              return next
                            })
                          }
                        />
                      </th>
                      <th className="admin-th-sortable" onClick={() => setDriversSortAsc((v) => !v)} title="Sort by name">
                        Name {driversSortAsc ? '▲' : '▼'}
                      </th>
                      <th>Email</th>
                      <th>Zoho ID</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {driversPaged.pageRows.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selectedDriverEmails[d.email]}
                            onChange={(e) =>
                              setSelectedDriverEmails((prev) => ({ ...prev, [d.email]: e.target.checked }))
                            }
                          />
                        </td>
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
              <div className="admin-table-pagination">
                <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setDriversPage((p) => Math.max(1, p - 1))}>
                  Prev
                </button>
                <span>
                  Page {driversPaged.safePage} / {driversPaged.totalPages}
                </span>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => setDriversPage((p) => Math.min(driversPaged.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}

          {page === 'deliveries' ? (
            <>
              <h2 style={{ marginTop: 0 }}>Orders & delivery</h2>
              <p style={{ color: 'var(--admin-muted)', maxWidth: 720 }}>
                Assign <strong>Zoho Books invoices</strong> to a driver below; the driver app shows those stops, accepts
                them, updates status, and uploads a signed-invoice photo (attached to the invoice in Zoho). Sales orders
                and legacy stops are listed further down. Line items should use Zoho <strong>item IDs</strong> from your
                catalog so challans and stock sync work.
              </p>

              <h3 style={{ marginTop: 24, marginBottom: 8 }}>Invoices (Zoho Books)</h3>
              <p style={{ color: 'var(--admin-muted)', fontSize: '0.875rem', maxWidth: 720 }}>
                Pick a driver, then use <strong>Assign</strong> on a row to create a delivery assignment. The driver sees
                it in the app, accepts, navigates, and submits proof of delivery.
              </p>
              <div className="admin-form-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--admin-muted)' }}>
                  Driver for assignment
                  <select
                    className="admin-input"
                    style={{ minWidth: 220 }}
                    value={invoiceAssignDriverEmail}
                    onChange={(e) => setInvoiceAssignDriverEmail(e.target.value)}
                  >
                    <option value="">Select driver…</option>
                    {drivers
                      .filter((d) => !d.disabled)
                      .map((d) => (
                        <option key={d.email} value={d.email}>
                          {d.fullName} ({d.email})
                        </option>
                      ))}
                  </select>
                </label>
                <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void refreshInvoices()}>
                  Refresh invoices
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th className="admin-th-sortable" onClick={() => setInvoicesSortAsc((v) => !v)} title="Sort by date">
                        Date {invoicesSortAsc ? '▲' : '▼'}
                      </th>
                      <th>Invoice #</th>
                      <th>Order / ref</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Due</th>
                      <th>Amount</th>
                      <th>Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoicesPaged.pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ color: 'var(--admin-muted)', padding: '16px 12px' }}>
                          No invoices loaded. Use Refresh or check Zoho Books connection.
                        </td>
                      </tr>
                    ) : null}
                    {invoicesPaged.pageRows.map((inv) => {
                      const id = String(inv.invoice_id ?? '')
                      return (
                        <tr key={id || inv.invoice_number}>
                          <td>{inv.date ?? inv.invoice_date ?? '—'}</td>
                          <td>{inv.invoice_number ?? id}</td>
                          <td>{inv.salesorder_number ?? inv.reference_number ?? '—'}</td>
                          <td>{inv.customer_name ?? '—'}</td>
                          <td>{inv.status ?? '—'}</td>
                          <td>{inv.due_date ?? '—'}</td>
                          <td>{formatMoneyInr(Number(inv.total))}</td>
                          <td>
                            <button
                              type="button"
                              className="admin-btn admin-btn-inline"
                              disabled={!id || assigningInvoiceId === id}
                              onClick={async () => {
                                if (!invoiceAssignDriverEmail) {
                                  alert('Choose a driver first')
                                  return
                                }
                                if (!id) return
                                setAssigningInvoiceId(id)
                                try {
                                  await adminFetch('/api/admin/delivery-assignments', {
                                    method: 'POST',
                                    body: JSON.stringify({ driver_email: invoiceAssignDriverEmail, invoice_id: id })
                                  })
                                  alert('Invoice assigned to driver')
                                } catch (e) {
                                  alert(e instanceof Error ? e.message : 'Assign failed')
                                } finally {
                                  setAssigningInvoiceId(null)
                                }
                              }}
                            >
                              {assigningInvoiceId === id ? '…' : 'Assign'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="admin-table-pagination">
                <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setInvoicesPage((p) => Math.max(1, p - 1))}>
                  Prev
                </button>
                <span>
                  Page {invoicesPaged.safePage} / {invoicesPaged.totalPages} ({invoicesRaw.length} invoices)
                </span>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => setInvoicesPage((p) => Math.min(invoicesPaged.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>

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
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            deliveriesPaged.pageRows.length > 0 &&
                            deliveriesPaged.pageRows.every((d) => selectedDeliveryIds[d.id])
                          }
                          onChange={(e) =>
                            setSelectedDeliveryIds((prev) => {
                              const next = { ...prev }
                              for (const d of deliveriesPaged.pageRows) next[d.id] = e.target.checked
                              return next
                            })
                          }
                        />
                      </th>
                      <th>Order</th>
                      <th className="admin-th-sortable" onClick={() => setDeliveriesSortAsc((v) => !v)} title="Sort by name">
                        Customer {deliveriesSortAsc ? '▲' : '▼'}
                      </th>
                      <th>Status</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveriesPaged.pageRows.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selectedDeliveryIds[d.id]}
                            onChange={(e) => setSelectedDeliveryIds((prev) => ({ ...prev, [d.id]: e.target.checked }))}
                          />
                        </td>
                        <td>{d.orderId}</td>
                        <td>{d.customerName}</td>
                        <td>{d.statusTag}</td>
                        <td>{d.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="admin-table-pagination">
                <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setDeliveriesPage((p) => Math.max(1, p - 1))}>
                  Prev
                </button>
                <span>
                  Page {deliveriesPaged.safePage} / {deliveriesPaged.totalPages}
                </span>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => setDeliveriesPage((p) => Math.min(deliveriesPaged.totalPages, p + 1))}
                >
                  Next
                </button>
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
                      <th>
                        <input
                          type="checkbox"
                          checked={
                            salesOrdersPaged.pageRows.length > 0 &&
                            salesOrdersPaged.pageRows.every((s) => selectedSalesOrders[String(s.salesorder_id ?? '')])
                          }
                          onChange={(e) =>
                            setSelectedSalesOrders((prev) => {
                              const next = { ...prev }
                              for (const s of salesOrdersPaged.pageRows) next[String(s.salesorder_id ?? '')] = e.target.checked
                              return next
                            })
                          }
                        />
                      </th>
                      <th>Number</th>
                      <th className="admin-th-sortable" onClick={() => setSalesOrdersSortAsc((v) => !v)} title="Sort by name">
                        Customer {salesOrdersSortAsc ? '▲' : '▼'}
                      </th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrdersPaged.pageRows.map((so) => (
                      <tr key={String(so.salesorder_id)}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selectedSalesOrders[String(so.salesorder_id ?? '')]}
                            onChange={(e) =>
                              setSelectedSalesOrders((prev) => ({
                                ...prev,
                                [String(so.salesorder_id ?? '')]: e.target.checked
                              }))
                            }
                          />
                        </td>
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
              <div className="admin-table-pagination">
                <button className="admin-btn admin-btn--ghost" type="button" onClick={() => setSalesOrdersPage((p) => Math.max(1, p - 1))}>
                  Prev
                </button>
                <span>
                  Page {salesOrdersPaged.safePage} / {salesOrdersPaged.totalPages}
                </span>
                <button
                  className="admin-btn admin-btn--ghost"
                  type="button"
                  onClick={() => setSalesOrdersPage((p) => Math.min(salesOrdersPaged.totalPages, p + 1))}
                >
                  Next
                </button>
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
            </>
          )}

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
                        await Promise.all([refreshCustomers(), refreshZohoContacts()])
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
                <p style={{ margin: '0 0 6px', color: 'var(--admin-muted)', fontSize: '0.8rem' }}>
                  Password updates/creates app login for this customer when email + password are provided.
                </p>
                <div className="admin-modal__footer">
                  <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditingCustomer(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-inline"
                    onClick={async () => {
                      try {
                        if (editingCustomer.contactId) {
                          await adminFetch(`/api/admin/customers/contact/${encodeURIComponent(editingCustomer.contactId)}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              fullName: editingCustomer.fullName,
                              email: editingCustomer.email || undefined,
                              mobile: editingCustomerMobile,
                              ...(editingCustomerPassword ? { password: editingCustomerPassword } : {}),
                              ...(editingCustomer.originalEmail ? { currentEmail: editingCustomer.originalEmail } : {})
                            })
                          })
                        } else {
                          const original = customers.find((c) => c.id === editingCustomer.id)
                          if (!original) {
                            alert('Customer not found in current list')
                            return
                          }
                          await adminFetch(`/api/admin/customers/${encodeURIComponent(original.email)}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                              fullName: editingCustomer.fullName,
                              email: editingCustomer.email,
                              ...(editingCustomerPassword ? { password: editingCustomerPassword } : {}),
                              ...(editingCustomerMobile ? { mobile: editingCustomerMobile } : {})
                            })
                          })
                        }
                        setEditingCustomer(null)
                        setEditingCustomerMobile('')
                        setEditingCustomerPassword('')
                        await Promise.all([refreshCustomers(), refreshZohoContacts()])
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
