export type Screen = 'home' | 'product' | 'orders' | 'cart' | 'account'

export type Product = {
  /** Cart key; Zoho `item_id` is a string (use as-is to avoid precision loss). */
  id: string | number
  /** When set, `ProductImage` loads via GET /api/items/:id/image (backend proxies Zoho). */
  zohoItemId?: string
  name: string
  subtitle: string
  priceInr: number
  oldPriceInr?: number
  image: string
  badge?: { label: string; tone: 'green' | 'red' }
  category: 'Eco-Friendly' | 'Party Packs' | 'Bamboo' | 'Heavy Duty' | 'Premium'
  /** Zoho available units; when set, cart / quantity must not exceed this. */
  availableStock?: number
}

export type OrderStatus = 'Shipped' | 'Processing' | 'Delivered'

export type Order = {
  id: string
  date: string
  status: OrderStatus
  items: string
  amountInr: number
  image: string
}

export type CartItem = {
  product: Product
  quantity: number
}
