import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { useToast } from './contexts/ToastContext'
import { orders, products } from './data/mockData'
import { AccountScreen } from './screens/AccountScreen'
import { AuthScreen } from './screens/AuthScreen'
import { CartScreen } from './screens/CartScreen'
import { HomeScreen } from './screens/HomeScreen'
import { OrdersScreen } from './screens/OrdersScreen'
import { ProductDetailsScreen } from './screens/ProductDetailsScreen'
import type { CartItem, Order, Product, Screen } from './types/app'
import { fetchZohoItemsPage, getBackendOrders } from './services/backendApi'
import { checkBackendReachable } from './utils/backendHealth'
import { clearSignedIn, readSignedIn, writeSignedIn } from './utils/authSession'
import { matchOrderToProduct } from './utils/orders'

function App() {
  const { showToast } = useToast()
  const [screen, setScreen] = useState<Screen>('home')
  const [isAuthenticated, setIsAuthenticated] = useState(readSignedIn)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [orderHistory, setOrderHistory] = useState<Order[]>(orders)
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All Items')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [nextItemsPage, setNextItemsPage] = useState(1)
  const [hasMoreCatalogItems, setHasMoreCatalogItems] = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
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
    document.body.dataset.toastLayout = isAuthenticated ? 'main' : 'auth'
  }, [isAuthenticated])

  useEffect(() => {
    let cancelled = false
    void checkBackendReachable().then((ok) => {
      if (!cancelled) setBackendReachable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      showToast('Unable to load products. Try again.', { variant: 'error' })
    } finally {
      catalogFetchLock.current = false
      setLoadingCatalog(false)
    }
  }, [hasMoreCatalogItems, mergeDedupeProducts, nextItemsPage, showToast])

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
          showToast('Unable to load backend data. Showing local catalog.', { variant: 'warning' })
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
  }, [mergeDedupeProducts, showToast])

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
    const cap = product.availableStock
    if (cap != null) {
      const existing = cartItems.find((item) => item.product.id === product.id)
      const nextTotal = (existing?.quantity ?? 0) + quantity
      if (nextTotal > cap) {
        showToast(
          `Available stock is ${cap}. You can only order up to that amount.`,
          { variant: 'warning' },
        )
        return
      }
    }
    setCartItems((current) => {
      const itemIndex = current.findIndex((item) => item.product.id === product.id)
      if (itemIndex === -1) return [...current, { product, quantity }]

      return current.map((item, index) =>
        index === itemIndex
          ? {
              ...item,
              product: { ...item.product, ...product },
              quantity: item.quantity + quantity,
            }
          : item,
      )
    })
    showToast(`${product.name} added to cart`, { variant: 'success' })
  }

  function updateCartQuantity(productId: string | number, type: 'increase' | 'decrease') {
    const line = cartItems.find((item) => item.product.id === productId)
    if (!line) return
    const cap = line.product.availableStock
    if (type === 'increase' && cap != null && line.quantity + 1 > cap) {
      showToast(`Available stock is ${cap}. You can only order up to that amount.`, { variant: 'warning' })
      return
    }
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
    showToast('Proceeding to checkout', { variant: 'info' })
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
          onNotify={(msg) => showToast(msg, { variant: 'info' })}
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
          onTrackOrder={(order) =>
            showToast(`Tracking started for Order #${order.id}`, { variant: 'info' })
          }
          onViewDetails={(order) =>
            showToast(`Viewing details for Order #${order.id}`, { variant: 'info' })
          }
          onInvoice={(order) =>
            showToast(`Invoice downloaded for Order #${order.id}`, { variant: 'success' })
          }
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
          onCheckout={() =>
            showToast('Checkout flow connected. Ready for payment integration.', { variant: 'info' })
          }
        />
      )
    }

    return (
      <AccountScreen
        onNavigateOrders={() => setScreen('orders')}
        onOpenAddresses={() => {
          showToast('Loaded saved delivery addresses', { variant: 'success' })
          return addresses
        }}
        onOpenPayments={() => {
          showToast('Loaded saved payment methods', { variant: 'success' })
          return paymentMethods
        }}
        onLogout={() => {
          clearSignedIn()
          setIsAuthenticated(false)
          setCartItems([])
          setSearchQuery('')
          setSelectedCategory('All Items')
          setScreen('home')
          showToast('Logged out successfully', { variant: 'success' })
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      {backendReachable === false ? (
        <div className="api-offline-banner" role="status">
          Cannot reach the server. Showing offline data where available. Check your connection or try again later.
        </div>
      ) : null}
      {!isAuthenticated ? (
        <AuthScreen
          onAuthenticated={(message) => {
            writeSignedIn()
            setIsAuthenticated(true)
            showToast(message, { variant: 'success' })
          }}
        />
      ) : (
        <>
          <div className="phone-frame">{renderScreen()}</div>
          <BottomNav screen={screen} cartCount={cartCount} onChange={setScreen} />
        </>
      )}
    </div>
  )
}

export default App
