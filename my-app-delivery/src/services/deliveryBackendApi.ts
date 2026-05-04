import { getApiBaseCandidates, logApiCandidatesOnce } from '../config/api'
import { readDriverToken } from '../utils/authSession'

const API_BASE_URL_CANDIDATES = getApiBaseCandidates()

export type DeliveryStop = {
  id: string
  salesorder_id?: string
  deliveryNumber: string
  businessName: string
  orderId: string
  amount: number
  paymentLabel: 'COD' | 'Credit' | 'Paid' | string
  statusTag: string
  timeLabel: string
  isNext: boolean
  address: string
  note?: string
  contactName: string
  contactRole: string
  initials: string
  customerName: string
  verified: boolean
  addressLine1: string
  addressLine2: string
  mapsQuery: string
  phone: string
  contactLine: string
  arrivalWindow: string
  driverNote: string
  podOrderLabel: string
  podSubtitle: string
  items: Array<{ name: string; sku: string; qty: number; unit: string; image: string }>
}

type DeliveryAssignment = {
  id: string
  invoiceId: string
  invoiceNumber: string
  customerName: string
  amount: number
  address?: string
  status: string
}

async function request<T>(path: string): Promise<T> {
  logApiCandidatesOnce(API_BASE_URL_CANDIDATES)
  let lastError: unknown = null

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
      const headers = new Headers()
      const token = readDriverToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(url, { headers })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      return response.json() as Promise<T>
    } catch (error) {
      lastError = error
      console.warn('[API] request failed', { baseUrl, path, error })
    }
  }

  const err = lastError instanceof Error ? lastError : new Error('Unable to reach backend API')
  console.error('[API] all bases failed', path, err)
  throw err
}

async function requestWithInit<T>(path: string, init?: RequestInit): Promise<T> {
  logApiCandidatesOnce(API_BASE_URL_CANDIDATES)
  let lastError: unknown = null

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
      const headers = new Headers(init?.headers)
      const token = readDriverToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(url, { ...init, headers })
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      return response.json() as Promise<T>
    } catch (error) {
      lastError = error
      console.warn('[API] request failed', { baseUrl, path, error })
    }
  }

  const err = lastError instanceof Error ? lastError : new Error('Unable to reach backend API')
  console.error('[API] all bases failed', path, err)
  throw err
}

export async function getDeliveryStops(): Promise<DeliveryStop[]> {
  const response = await request<{ assignments?: DeliveryAssignment[] }>('/api/delivery/assignments')
  const rows = Array.isArray(response.assignments) ? response.assignments : []
  const mapped = rows.map((a, rowIdx) => {
    const st = String(a.status || '').toLowerCase()
    const statusTag = st === 'assigned' ? 'Assigned' : st === 'accepted' ? 'Accepted' : st === 'in_transit' ? 'In Transit' : 'Delivered'
    return {
      id: a.id,
      salesorder_id: a.invoiceId,
      deliveryNumber: `INV-${rowIdx + 1}`,
      businessName: a.customerName || 'Customer',
      orderId: a.invoiceNumber || a.invoiceId,
      amount: Number(a.amount) || 0,
      paymentLabel: 'Credit',
      statusTag,
      timeLabel: 'Today',
      isNext: false,
      address: a.address || 'Address not available',
      note: '',
      contactName: a.customerName || 'Customer',
      contactRole: 'Invoice recipient',
      initials: String(a.customerName || 'C')
        .split(' ')
        .slice(0, 2)
        .map((s) => s[0] || '')
        .join('')
        .toUpperCase(),
      customerName: a.customerName || 'Customer',
      verified: st === 'delivered',
      addressLine1: a.address || '',
      addressLine2: '',
      mapsQuery: a.address || a.customerName || '',
      phone: '',
      contactLine: '',
      arrivalWindow: '',
      driverNote: '',
      podOrderLabel: a.invoiceNumber || a.invoiceId,
      podSubtitle: 'Upload signed invoice photo',
      items: []
    } as DeliveryStop
  })
  let nextAssigned = false
  return mapped.map((stop) => {
    if (stop.statusTag === 'Delivered') return stop
    if (!nextAssigned) {
      nextAssigned = true
      return { ...stop, isNext: true }
    }
    return { ...stop, isNext: false }
  })
}

export async function getDeliveryStopDetail(stopId: string): Promise<DeliveryStop | null> {
  const all = await getDeliveryStops()
  return all.find((s) => s.id === stopId) || null
}

export async function confirmDeliveryStop(stopId: string, recipientName: string, photo: File, notes?: string): Promise<void> {
  const form = new FormData()
  form.append('photo', photo)
  form.append('recipient_name', recipientName)
  if (notes) form.append('notes', notes)
  await requestWithInit<{ message: string }>(`/api/delivery/assignments/${encodeURIComponent(stopId)}/proof`, {
    method: 'POST',
    body: form
  })
}

export async function acceptDeliveryStop(stopId: string): Promise<void> {
  await requestWithInit<{ message: string }>(`/api/delivery/assignments/${encodeURIComponent(stopId)}/accept`, {
    method: 'POST'
  })
}

export async function updateDeliveryStopStatus(stopId: string, status: 'accepted' | 'in_transit' | 'delivered'): Promise<void> {
  await requestWithInit<{ message: string }>(`/api/delivery/assignments/${encodeURIComponent(stopId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })
}
