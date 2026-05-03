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
  const response = await request<{ stops?: DeliveryStop[] }>('/api/zoho/delivery/stops')
  return response.stops || []
}

export async function getDeliveryStopDetail(stopId: string): Promise<DeliveryStop | null> {
  try {
    const response = await request<{ stop?: DeliveryStop }>(`/api/zoho/delivery/stops/${encodeURIComponent(stopId)}`)
    return response.stop || null
  } catch {
    return null
  }
}

export async function confirmDeliveryStop(stopId: string, recipientName: string, notes?: string): Promise<void> {
  await requestWithInit<{ message: string }>(`/api/zoho/delivery/stops/${encodeURIComponent(stopId)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_name: recipientName, ...(notes ? { notes } : {}) }),
  })
}
