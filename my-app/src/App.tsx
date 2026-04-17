import { useEffect, useMemo, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { AppToast } from './components/AppToast'
import { orders, products } from './data/mockData'
import { AccountScreen } from './screens/AccountScreen'
import { CartScreen } from './screens/CartScreen'
import { HomeScreen } from './screens/HomeScreen'
import { OrdersScreen } from './screens/OrdersScreen'
import { ProductDetailsScreen } from './screens/ProductDetailsScreen'
import type { CartItem, Order, Product, Screen } from './types/app'
import { matchOrderToProduct } from './utils/orders'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All Items')
  const [showAllItems, setShowAllItems] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [addresses] = useState<string[]>([
    'Office: 2nd Floor, Sector 62, Noida, Uttar Pradesh',
    'Warehouse: Plot 14, Bhiwandi, Maharashtra',
  ])
  const [paymentMethods] = useState<string[]>([
    'UPI: platepro@icici',
    'Corporate Card: **** 2811',
    'Net Banking: HDFC Business Account',
  ])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const matchCategory =
        selectedCategory === 'All Items' || product.category.toLowerCase() === selectedCategory.toLowerCase()
      const term = searchQuery.trim().toLowerCase()
      const matchQuery =
        term.length === 0 ||
        product.name.toLowerCase().includes(term) ||
        product.subtitle.toLowerCase().includes(term)
      return matchCategory && matchQuery
    })
    if (showAllItems) return filtered
    return filtered.slice(0, 4)
  }, [searchQuery, selectedCategory, showAllItems])

  function addToCart(product: Product, quantity = 1) {
    setCartItems((current) => {
      const itemIndex = current.findIndex((item) => item.product.id === product.id)
      if (itemIndex === -1) return [...current, { product, quantity }]

      return current.map((item, index) =>
        index === itemIndex ? { ...item, quantity: item.quantity + quantity } : item,
      )
    })
    setToast(`${product.name} added to cart`)
  }

  function updateCartQuantity(productId: number, type: 'increase' | 'decrease') {
    setCartItems((current) =>
      current
        .map((item) => {
          if (item.product.id !== productId) return item
          const nextQty = type === 'increase' ? item.quantity + 1 : item.quantity - 1
          return { ...item, quantity: nextQty }
        })
        .filter((item) => item.quantity > 0),
    )
  }

  function openProduct(product: Product) {
    setSelectedProduct(product)
    setScreen('product')
  }

  function handleBuyNow(product: Product, quantity: number) {
    addToCart(product, quantity)
    setScreen('cart')
    setToast('Proceeding to checkout')
  }

  function handleQuickAddFromOrder(order: Order) {
    const match = matchOrderToProduct(order, products)
    if (!match) return
    addToCart(match, 1)
    setScreen('cart')
  }

  function renderScreen() {
    if (screen === 'home') {
      return (
        <HomeScreen
          products={visibleProducts}
          category={selectedCategory}
          query={searchQuery}
          cartCount={cartCount}
          onCategoryChange={(category) => {
            setSelectedCategory(category)
            setShowAllItems(false)
          }}
          onQueryChange={setSearchQuery}
          onViewAll={() => setShowAllItems(true)}
          onOpenProduct={openProduct}
          onAddToCart={(product) => addToCart(product, 1)}
          onOpenCart={() => setScreen('cart')}
          onNotify={setToast}
        />
      )
    }

    if (screen === 'product') {
      return (
        <ProductDetailsScreen
          product={selectedProduct}
          onBack={() => setScreen('home')}
          onOpenCart={() => setScreen('cart')}
          onAddToCart={addToCart}
          onBuyNow={handleBuyNow}
        />
      )
    }

    if (screen === 'orders') {
      return (
        <OrdersScreen
          orders={orders}
          onBackHome={() => setScreen('home')}
          onTrackOrder={(order) => setToast(`Tracking started for Order #${order.id}`)}
          onViewDetails={(order) => setToast(`Viewing details for Order #${order.id}`)}
          onInvoice={(order) => setToast(`Invoice downloaded for Order #${order.id}`)}
          onReorder={(order) => handleQuickAddFromOrder(order)}
          onQuickAddFromOrder={handleQuickAddFromOrder}
        />
      )
    }

    if (screen === 'cart') {
      return (
        <CartScreen
          cartItems={cartItems}
          onBackHome={() => setScreen('home')}
          onIncrease={(productId) => updateCartQuantity(productId, 'increase')}
          onDecrease={(productId) => updateCartQuantity(productId, 'decrease')}
          onCheckout={() => setToast('Checkout flow connected. Ready for payment integration.')}
        />
      )
    }

    return (
      <AccountScreen
        onNavigateOrders={() => setScreen('orders')}
        onOpenAddresses={() => {
          setToast('Loaded saved delivery addresses')
          return addresses
        }}
        onOpenPayments={() => {
          setToast('Loaded saved payment methods')
          return paymentMethods
        }}
        onLogout={() => {
          setCartItems([])
          setSearchQuery('')
          setSelectedCategory('All Items')
          setShowAllItems(false)
          setScreen('home')
          setToast('Logged out successfully')
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      <div className="phone-frame">{renderScreen()}</div>
      <BottomNav screen={screen} cartCount={cartCount} onChange={setScreen} />
      <AppToast message={toast} />
    </div>
  )
}

export default App
