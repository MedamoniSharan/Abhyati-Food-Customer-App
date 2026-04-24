import type { Order, Product } from '../types/app'
import { getApiBaseCandidates, logApiCandidatesOnce } from '../config/api'
import { orders as mockOrders, products as mockProducts } from '../data/mockData'
import { zohoAvailableStockQuantity } from '../utils/productDetailFromZoho'

const API_BASE_URL_CANDIDATES = getApiBaseCandidates()

type ZohoPageContext = {
  page?: number
  per_page?: number
  has_more_page?: boolean
}

type ZohoListResponse<T> = {
  message?: string
  code?: number
  page_context?: ZohoPageContext
  [key: string]: T[] | string | number | ZohoPageContext | undefined
}

type ZohoItem = {
  item_id?: string
  name?: string
  rate?: number
  purchase_rate?: number
  description?: string
  image_document_id?: string
  has_attachment?: boolean
  image_name?: string
}

function zohoItemHasImage(item: ZohoItem): boolean {
  const docId = item.image_document_id?.trim()
  if (docId) return true
  if (item.has_attachment === true) return true
  const imageName = item.image_name?.trim()
  if (imageName) return true
  return false
}

type ZohoSalesOrder = {
  salesorder_id?: string
  date?: string
  status?: string
  line_items?: Array<{ name?: string; quantity?: number }>
  total?: number
}

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

function normalizePrice(value: unknown, fallback: number) {
  const asNumber = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber
  return fallback
}

function mapZohoItemToProduct(item: ZohoItem, index: number): Product {
  const fallback = mockProducts[index % mockProducts.length]
  const itemId = item.item_id?.trim()
  const avail = zohoAvailableStockQuantity(item as unknown as Record<string, unknown>)
  return {
    id: itemId ?? `zoho-${index}`,
    zohoItemId: itemId,
    name: item.name?.trim() || fallback.name,
    subtitle: item.description?.trim() || fallback.subtitle,
    priceInr: normalizePrice(item.rate ?? item.purchase_rate, fallback.priceInr),
    oldPriceInr: fallback.oldPriceInr,
    image: fallback.image,
    badge: fallback.badge,
    category: fallback.category,
    ...(avail != null ? { availableStock: avail } : {}),
  }
}

function mapStatus(rawStatus?: string): Order['status'] {
  const status = (rawStatus || '').toLowerCase()
  if (status.includes('deliver')) return 'Delivered'
  if (status.includes('ship')) return 'Shipped'
  return 'Processing'
}

function mapZohoSalesOrderToOrder(order: ZohoSalesOrder, index: number): Order {
  const fallback = mockOrders[index % mockOrders.length]
  const itemsLabel =
    order.line_items
      ?.slice(0, 3)
      .map((line) => {
        const qty = line.quantity ? `${line.quantity}x` : ''
        return `${qty} ${line.name || 'Item'}`.trim()
      })
      .join(', ') || fallback.items

  return {
    id: order.salesorder_id || fallback.id,
    date: order.date || fallback.date,
    status: mapStatus(order.status),
    items: itemsLabel,
    amountInr: normalizePrice(order.total, fallback.amountInr),
    image: fallback.image,
  }
}

async function request<T>(path: string): Promise<T> {
  logApiCandidatesOnce(API_BASE_URL_CANDIDATES)
  let lastError: unknown = null

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
      const response = await fetch(url)
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
      const response = await fetch(url, init)
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

const DEFAULT_ITEMS_PER_PAGE = 20

export type ZohoItemsPageResult = {
  products: Product[]
  /** True when Zoho reports more pages available */
  hasMore: boolean
}

/**
 * Fetch one page of Zoho items (image-only). Caller appends results and calls again with page+1 while hasMore.
 */
export async function fetchZohoItemsPage(page: number, perPage = DEFAULT_ITEMS_PER_PAGE): Promise<ZohoItemsPageResult> {
  try {
    const qs = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    const response = await request<ZohoListResponse<ZohoItem>>(`/api/zoho/items?${qs.toString()}`)
    const items = (response.items as ZohoItem[] | undefined) || []
    const withImages = items.filter(zohoItemHasImage)
    const hasMore = Boolean(response.page_context?.has_more_page)
    const baseIndex = (page - 1) * perPage

    if (items.length === 0 && page === 1) {
      return { products: mockProducts, hasMore: false }
    }

    if (withImages.length === 0) {
      return { products: [], hasMore }
    }

    const products = withImages.map((item, i) => mapZohoItemToProduct(item, baseIndex + i))
    return { products, hasMore }
  } catch {
    return page === 1 ? { products: mockProducts, hasMore: false } : { products: [], hasMore: false }
  }
}

/** @deprecated Prefer fetchZohoItemsPage with scroll pagination */
export async function getBackendProducts(): Promise<Product[]> {
  const { products } = await fetchZohoItemsPage(1, 200)
  return products
}

/** Full Zoho item (GET /items/:id) — includes stock locations, custom fields, etc. */
export async function fetchZohoItemDetail(itemId: string): Promise<Record<string, unknown> | null> {
  try {
    const data = await request<Record<string, unknown>>(`/api/zoho/items/${encodeURIComponent(itemId)}`)
    const nested = data['item'] as Record<string, unknown> | undefined
    if (nested && typeof nested === 'object') return nested
    return data
  } catch {
    return null
  }
}

export async function getBackendOrders(): Promise<Order[]> {
  try {
    const response = await request<ZohoListResponse<ZohoSalesOrder>>('/api/zoho/sales-orders?per_page=200')
    const salesOrders = (response.salesorders as ZohoSalesOrder[] | undefined) || []
    if (salesOrders.length === 0) return mockOrders
    return salesOrders.map(mapZohoSalesOrderToOrder)
  } catch {
    return mockOrders
  }
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
    body: JSON.stringify({ recipient_name: recipientName, ...(notes ? { notes } : {}) })
  })
}
