import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { useToast } from './contexts/ToastContext'
import { AccountScreen } from './screens/AccountScreen'
import { AuthScreen } from './screens/AuthScreen'
import { CartScreen } from './screens/CartScreen'
import { HomeScreen } from './screens/HomeScreen'
import { OrdersScreen } from './screens/OrdersScreen'
import { ProductDetailsScreen } from './screens/ProductDetailsScreen'
import type { CartItem, Order, Product, Screen } from './types/app'
import { createCustomerOrder, downloadOrderProof, fetchZohoItemsPage, getBackendOrders } from './services/backendApi'
import { fetchAuthMe } from './services/authApi'
import { checkBackendReachable } from './utils/backendHealth'
import { clearSignedIn, readAuthToken, readSessionUser, readSignedIn, writeSignedIn } from './utils/authSession'
import { matchOrderToProduct } from './utils/orders'

function App() {
  const { showToast } = useToast()
  const [screen, setScreen] = useState<Screen>('home')
  const [isAuthenticated, setIsAuthenticated] = useState(readSignedIn)
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([])
  const [orderHistory, setOrderHistory] = useState<Order[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All Items')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [nextItemsPage, setNextItemsPage] = useState(1)
  const [hasMoreCatalogItems, setHasMoreCatalogItems] = useState(true)
  /** True while restoring session so home can show bootstrap loader before first Zoho fetch. */
  const [loadingCatalog, setLoadingCatalog] = useState(readSignedIn)
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null)
  const catalogFetchLock = useRef(false)

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

  useEffect(() => {
    if (!readSignedIn()) return
    const token = readAuthToken()
    if (!token) {
      clearSignedIn()
      setIsAuthenticated(false)
      return
    }
    let cancelled = false
    void fetchAuthMe(token).then((user) => {
      if (cancelled) return
      if (!user) {
        clearSignedIn()
        setIsAuthenticated(false)
        showToast('Your session expired or the account was removed.', { variant: 'info' })
        return
      }
      writeSignedIn(user, token)
      setIsAuthenticated(true)
    })
    return () => {
      cancelled = true
    }
  }, [showToast])

  const refreshOrderHistory = useCallback(async () => {
    if (!readAuthToken()) return
    setOrderHistory(await getBackendOrders())
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
            current && merged.some((p) => p.id === current.id) ? current : merged[0],
          )
        } else {
          setSelectedProduct(null)
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

  /** Zoho Books items require a customer JWT. Load every page after sign-in (or session restore). */
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    catalogFetchLock.current = true
    setLoadingCatalog(true)
    const perPage = 200
    void (async () => {
      try {
        let page = 1
        let merged: Product[] = []
        let hasMore = true
        while (hasMore && !cancelled) {
          const { products: pageProducts, hasMore: more } = await fetchZohoItemsPage(page, perPage)
          if (cancelled) break
          merged = mergeDedupeProducts(merged, pageProducts)
          hasMore = more
          page += 1
          if (page > 500) break
        }
        if (cancelled) return
        setCatalogProducts(merged)
        setHasMoreCatalogItems(false)
        setNextItemsPage(1)
        if (merged.length > 0) {
          setSelectedProduct((current) =>
            current && merged.some((p) => p.id === current.id) ? current : merged[0],
          )
        } else {
          setSelectedProduct(null)
        }
      } catch {
        if (!cancelled) {
          showToast('Unable to load products. Check your connection and try again.', { variant: 'error' })
          setCatalogProducts([])
          setSelectedProduct(null)
          setHasMoreCatalogItems(false)
        }
      } finally {
        catalogFetchLock.current = false
        if (!cancelled) setLoadingCatalog(false)
      }
    })()
    return () => {
      cancelled = true
      catalogFetchLock.current = false
      setLoadingCatalog(false)
    }
  }, [isAuthenticated, mergeDedupeProducts, showToast])

  useEffect(() => {
    if (!isAuthenticated) return
    void refreshOrderHistory()
  }, [isAuthenticated, refreshOrderHistory])

  useEffect(() => {
    if (!isAuthenticated || screen !== 'orders') return
    void refreshOrderHistory()
  }, [screen, isAuthenticated, refreshOrderHistory])

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

  const catalogCategories = useMemo(() => {
    const names = new Set<string>()
    for (const p of catalogProducts) {
      const c = p.category?.trim()
      if (c) names.add(c)
    }
    return ['All Items', ...Array.from(names).sort((a, b) => a.localeCompare(b))]
  }, [catalogProducts])

  useEffect(() => {
    if (!catalogCategories.includes(selectedCategory)) {
      setSelectedCategory('All Items')
    }
  }, [catalogCategories, selectedCategory])

  useEffect(() => {
    if (screen === 'product' && !selectedProduct) {
      setScreen('home')
    }
  }, [screen, selectedProduct])

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

  async function handleCheckout() {
    if (cartItems.length === 0) {
      showToast('Your cart is empty. Add items before checkout.', { variant: 'warning' })
      return
    }
    try {
      await createCustomerOrder(
        cartItems.map((line) => ({
          item_id: line.product.zohoItemId,
          name: line.product.name,
          description: line.product.subtitle,
          quantity: line.quantity,
          rate: Number(line.product.priceInr) || 0
        }))
      )
      setCartItems([])
      await refreshOrderHistory()
      setScreen('orders')
      showToast('Order placed successfully and synced to admin.', { variant: 'success' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Checkout failed. Please try again.', { variant: 'error' })
    }
  }

  function renderScreen() {
    if (screen === 'home') {
      return (
        <HomeScreen
          categories={catalogCategories}
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
      if (!selectedProduct) return null
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
            void (async () => {
              const invoiceId = order.invoiceId || order.id
              const ok = await downloadOrderProof(invoiceId)
              if (ok) {
                showToast(`Invoice proof downloaded for Order #${order.id}`, { variant: 'success' })
              } else {
                showToast('Proof is not available yet for this order.', { variant: 'warning' })
              }
            })()
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
          onCheckout={() => void handleCheckout()}
        />
      )
    }

    return (
      <AccountScreen
        user={readSessionUser()}
        onNavigateOrders={() => setScreen('orders')}
        onOpenAddresses={() => []}
        onOpenPayments={() => []}
        onLogout={() => {
          clearSignedIn()
          setIsAuthenticated(false)
          setCartItems([])
          setOrderHistory([])
          setCatalogProducts([])
          setNextItemsPage(1)
          setHasMoreCatalogItems(true)
          setSelectedProduct(null)
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
          Cannot reach the server. Check your connection or try again later.
        </div>
      ) : null}
      {!isAuthenticated ? (
        <AuthScreen
          onAuthenticated={({ message, user, token }) => {
            writeSignedIn(user, token)
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
