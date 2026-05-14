import type { Order, Product } from '../types/app'
import { getApiBaseCandidates, logApiCandidatesOnce } from '../config/api'
import { orders as mockOrders, products as mockProducts } from '../data/mockData'
import { readAuthToken } from '../utils/authSession'
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
  id?: string
  invoiceId?: string
  invoiceNumber?: string
  date?: string
  status?: string
  deliveredAt?: string | null
  proofAvailable?: boolean
  proofMeta?: {
    fileName?: string
    mimeType?: string
    uploadedAt?: string | null
    recipientName?: string
  } | null
  line_items?: Array<{ name?: string; quantity?: number }>
  items?: string
  total?: number
  amountInr?: number
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
    id: order.id || fallback.id,
    invoiceId: order.invoiceId || order.id || fallback.id,
    invoiceNumber: order.invoiceNumber || order.id || fallback.id,
    date: order.date || fallback.date,
    status: mapStatus(order.status),
    items: order.items || itemsLabel,
    amountInr: normalizePrice(order.amountInr ?? order.total, fallback.amountInr),
    image: fallback.image,
    deliveredAt: order.deliveredAt || null,
    proofAvailable: Boolean(order.proofAvailable),
    proofMeta: order.proofMeta || null
  }
}

type RequestOptions = {
  method?: string
  body?: BodyInit | null
  headers?: HeadersInit
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  logApiCandidatesOnce(API_BASE_URL_CANDIDATES)
  let lastError: unknown = null
  const token = readAuthToken()

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
      const headers = new Headers(options.headers || {})
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(url, {
        method: options.method || 'GET',
        body: options.body,
        headers
      })
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
    const response = await request<ZohoListResponse<ZohoItem>>(`/api/customer/items?${qs.toString()}`)
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
    const data = await request<Record<string, unknown>>(`/api/customer/items/${encodeURIComponent(itemId)}`)
    const nested = data['item'] as Record<string, unknown> | undefined
    if (nested && typeof nested === 'object') return nested
    return data
  } catch {
    return null
  }
}

export async function getBackendOrders(): Promise<Order[]> {
  try {
    const response = await request<{ orders?: ZohoSalesOrder[] }>('/api/customer/orders?per_page=200')
    const salesOrders = Array.isArray(response.orders) ? response.orders : []
    return salesOrders.map((row, i) => mapZohoSalesOrderToOrder(row, i))
  } catch {
    // Signed-in users should see an empty list on failure, not demo orders.
    if (readAuthToken()) return []
    return mockOrders
  }
}

type CheckoutLineInput = {
  item_id?: string
  name?: string
  description?: string
  quantity: number
  rate: number
}

export async function createCustomerOrder(lineItems: CheckoutLineInput[]): Promise<Order | null> {
  const data = await request<{ order?: ZohoSalesOrder }>('/api/customer/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ line_items: lineItems })
  })
  const raw = data.order
  if (raw && typeof raw === 'object') {
    return mapZohoSalesOrderToOrder(raw, 0)
  }
  return null
}

export async function downloadOrderProof(invoiceId: string): Promise<boolean> {
  if (!invoiceId) return false
  logApiCandidatesOnce(API_BASE_URL_CANDIDATES)
  const token = readAuthToken()
  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/api/customer/orders/${encodeURIComponent(invoiceId)}/proof`
      const headers = new Headers()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch(url, { headers })
      if (!response.ok) continue
      const blob = await response.blob()
      const link = document.createElement('a')
      const objectUrl = URL.createObjectURL(blob)
      link.href = objectUrl
      link.download = `invoice-proof-${invoiceId}.jpg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)
      return true
    } catch {
      /* try next base */
    }
  }
  return false
}
