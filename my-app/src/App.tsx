import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { AppToast } from './components/AppToast'
import { orders, products } from './data/mockData'
import { AccountScreen } from './screens/AccountScreen'
import { AuthScreen } from './screens/AuthScreen'
import { CartScreen } from './screens/CartScreen'
import { HomeScreen } from './screens/HomeScreen'
import { OrdersScreen } from './screens/OrdersScreen'
import { ProductDetailsScreen } from './screens/ProductDetailsScreen'
import type { CartItem, Order, Product, Screen } from './types/app'
import { fetchZohoItemsPage, getBackendOrders } from './services/backendApi'
import { matchOrderToProduct } from './utils/orders'

function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [orderHistory, setOrderHistory] = useState<Order[]>(orders)
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All Items')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [nextItemsPage, setNextItemsPage] = useState(1)
  const [hasMoreCatalogItems, setHasMoreCatalogItems] = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const catalogFetchLock = useRef(false)
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

  const mergeDedupeProducts = useCallback((existing: Product[], incoming: Product[]) => {
    const seen = new Set(existing.map((p) => p.id))
    const out = [...existing]
    for (const p of incoming) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  }, [])

  const loadCatalogPage = useCallback(async () => {
    if (catalogFetchLock.current || !hasMoreCatalogItems) return
    catalogFetchLock.current = true
    setLoadingCatalog(true)
    try {
      const page = nextItemsPage
      const { products, hasMore } = await fetchZohoItemsPage(page, 20)
      setCatalogProducts((prev) => {
        const merged = mergeDedupeProducts(prev, products)
        if (merged.length > 0) {
          setSelectedProduct((current) =>
            merged.some((p) => p.id === current.id) ? current : merged[0],
          )
        }
        return merged
      })
      setHasMoreCatalogItems(hasMore)
      setNextItemsPage(page + 1)
    } catch {
      setToast('Unable to load products. Try again.')
    } finally {
      catalogFetchLock.current = false
      setLoadingCatalog(false)
    }
  }, [hasMoreCatalogItems, mergeDedupeProducts, nextItemsPage])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      catalogFetchLock.current = true
      setLoadingCatalog(true)
      try {
        const [firstPage, backendOrders] = await Promise.all([fetchZohoItemsPage(1, 20), getBackendOrders()])
        if (cancelled) return
        const merged = mergeDedupeProducts([], firstPage.products)
        setCatalogProducts(merged)
        if (merged.length > 0) {
          setSelectedProduct(merged[0])
        }
        setHasMoreCatalogItems(firstPage.hasMore)
        setNextItemsPage(2)
        setOrderHistory(backendOrders)
      } catch {
        if (!cancelled) {
          setToast('Unable to load backend data. Showing local catalog.')
          setCatalogProducts(products)
          setSelectedProduct(products[0])
          setHasMoreCatalogItems(false)
        }
      } finally {
        if (!cancelled) {
          catalogFetchLock.current = false
          setLoadingCatalog(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mergeDedupeProducts])

  const loadMoreCatalogIfNeeded = useCallback(() => {
    if (!hasMoreCatalogItems) return
    void loadCatalogPage()
  }, [hasMoreCatalogItems, loadCatalogPage])

  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])

  const visibleProducts = useMemo(() => {
    const catalogHasZohoItems = catalogProducts.some((p) => p.zohoItemId)
    return catalogProducts.filter((product) => {
      if (catalogHasZohoItems && !product.zohoItemId) return false
      const matchCategory =
        selectedCategory === 'All Items' || product.category.toLowerCase() === selectedCategory.toLowerCase()
      const term = searchQuery.trim().toLowerCase()
      const matchQuery =
        term.length === 0 ||
        product.name.toLowerCase().includes(term) ||
        product.subtitle.toLowerCase().includes(term)
      return matchCategory && matchQuery
    })
  }, [catalogProducts, searchQuery, selectedCategory])

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

  function updateCartQuantity(productId: string | number, type: 'increase' | 'decrease') {
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

  function navigateFromMenu(target: 'home' | 'orders' | 'cart' | 'account') {
    setScreen(target)
    setIsMenuOpen(false)
  }

  function handleBuyNow(product: Product, quantity: number) {
    addToCart(product, quantity)
    setScreen('cart')
    setToast('Proceeding to checkout')
  }

  function handleQuickAddFromOrder(order: Order) {
    const match = matchOrderToProduct(order, catalogProducts)
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
          onCategoryChange={setSelectedCategory}
          onQueryChange={setSearchQuery}
          onOpenProduct={openProduct}
          onAddToCart={(product) => addToCart(product, 1)}
          onNotify={setToast}
          isMenuOpen={isMenuOpen}
          onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
          onCloseMenu={() => setIsMenuOpen(false)}
          onNavigateMenu={navigateFromMenu}
          hasMoreCatalog={hasMoreCatalogItems}
          loadingMoreCatalog={loadingCatalog && catalogProducts.length > 0}
          onLoadMoreCatalog={loadMoreCatalogIfNeeded}
          catalogBootstrapping={loadingCatalog && catalogProducts.length === 0}
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
          orders={orderHistory}
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
          setScreen('home')
          setToast('Logged out successfully')
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      {!isAuthenticated ? (
        <AuthScreen
          onAuthenticated={(message) => {
            setIsAuthenticated(true)
            setToast(message)
          }}
        />
      ) : (
        <>
          <div className="phone-frame">{renderScreen()}</div>
          <BottomNav screen={screen} cartCount={cartCount} onChange={setScreen} />
        </>
      )}
      <AppToast message={toast} />
    </div>
  )
}

export default App
