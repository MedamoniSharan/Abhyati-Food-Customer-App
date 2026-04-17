import type { Order, Product } from '../types/app'
import { orders as mockOrders, products as mockProducts } from '../data/mockData'

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
const API_BASE_URL_CANDIDATES = [configuredApiBaseUrl, 'http://localhost:3001', 'http://localhost:4000'].filter(
  (value, index, arr) => value && arr.indexOf(value) === index,
)

type ZohoListResponse<T> = {
  message?: string
  code?: number
  [key: string]: T[] | string | number | undefined
}

type ZohoItem = {
  item_id?: string
  name?: string
  rate?: number
  purchase_rate?: number
  description?: string
  image_document_id?: string
}

type ZohoSalesOrder = {
  salesorder_id?: string
  date?: string
  status?: string
  line_items?: Array<{ name?: string; quantity?: number }>
  total?: number
}

function normalizePrice(value: unknown, fallback: number) {
  const asNumber = typeof value === 'number' ? value : Number(value)
  if (Number.isFinite(asNumber) && asNumber > 0) return asNumber
  return fallback
}

function mapZohoItemToProduct(item: ZohoItem, index: number): Product {
  const fallback = mockProducts[index % mockProducts.length]
  return {
    id: Number(item.item_id) || 1000 + index,
    name: item.name?.trim() || fallback.name,
    subtitle: item.description?.trim() || fallback.subtitle,
    priceInr: normalizePrice(item.rate ?? item.purchase_rate, fallback.priceInr),
    oldPriceInr: fallback.oldPriceInr,
    image: fallback.image,
    badge: fallback.badge,
    category: fallback.category,
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
  let lastError: unknown = null

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      return response.json() as Promise<T>
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to reach backend API')
}

export async function getBackendProducts(): Promise<Product[]> {
  try {
    const response = await request<ZohoListResponse<ZohoItem>>('/api/zoho/items?per_page=200')
    const items = (response.items as ZohoItem[] | undefined) || []
    if (items.length === 0) return mockProducts
    return items.map(mapZohoItemToProduct)
  } catch {
    return mockProducts
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
