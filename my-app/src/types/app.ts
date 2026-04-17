export type Screen = 'home' | 'product' | 'orders' | 'cart' | 'account'

export type Product = {
  id: number
  name: string
  subtitle: string
  priceInr: number
  oldPriceInr?: number
  image: string
  badge?: { label: string; tone: 'green' | 'red' }
  category: 'Eco-Friendly' | 'Party Packs' | 'Bamboo' | 'Heavy Duty' | 'Premium'
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
