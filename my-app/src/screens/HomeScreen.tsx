import { categories } from '../data/mockData'
import type { Product } from '../types/app'
import { ProductCard } from '../components/ProductCard'

type Props = {
  products: Product[]
  category: string
  query: string
  onCategoryChange: (category: string) => void
  onQueryChange: (value: string) => void
  onViewAll: () => void
  onOpenProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
  onNotify: (message: string) => void
  isMenuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onNavigateMenu: (target: 'home' | 'orders' | 'cart' | 'account') => void
}

export function HomeScreen({
  products,
  category,
  query,
  onCategoryChange,
  onQueryChange,
  onViewAll,
  onOpenProduct,
  onAddToCart,
  onNotify,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onNavigateMenu,
}: Props) {
  return (
    <>
      <header className="top-header home-header">
        <div className="header-row hero-top-row">
          <button type="button" className="profile-btn" onClick={onToggleMenu} aria-label="Open profile menu">
            <img src="/app-logo.png" alt="Abhyati profile" className="hero-profile-avatar" />
          </button>
          <div className="hero-location">
            <p>Delivery location</p>
            <h1>Canggu, Kuta Utara, Bali</h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-btn icon-btn-dark with-dot"
              onClick={() => onNotify('No new notifications')}
            >
              <span className="material-symbols-outlined">notifications_none</span>
            </button>
          </div>
        </div>
        <div className="hero-copy">
          <h2>What you&apos;d like to eat for today?</h2>
        </div>
        <label className="search-bar">
          <span className="material-symbols-outlined">search</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search menu, restaurant or craving"
          />
          <button type="button" aria-label="Open filters" onClick={() => onNotify('Filter options coming soon')}>
            <span className="material-symbols-outlined">tune</span>
          </button>
        </label>
      </header>

      <div className={isMenuOpen ? 'menu-overlay open' : 'menu-overlay'} onClick={onCloseMenu} />
      <aside className={isMenuOpen ? 'side-menu open' : 'side-menu'}>
        <div className="side-menu-head">
          <img src="/app-logo.png" alt="Abhyati food logo" className="side-menu-logo" />
          <div>
            <h3>Abhyati food</h3>
            <p>Quick Navigation</p>
          </div>
          <button type="button" className="icon-btn" onClick={onCloseMenu}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="side-menu-links">
          <button type="button" onClick={() => onNavigateMenu('home')}>
            Home
          </button>
          <button type="button" onClick={() => onNavigateMenu('orders')}>
            Orders
          </button>
          <button type="button" onClick={() => onNavigateMenu('cart')}>
            Cart
          </button>
          <button type="button" onClick={() => onNavigateMenu('account')}>
            Account
          </button>
        </nav>
      </aside>

      <main className="content home-content">
        <div className="section-header">
          <h2>Bulk Paper Products</h2>
          <button type="button" className="link-btn" onClick={onViewAll}>
            View All
          </button>
        </div>

        <div className="category-row">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={item === category ? 'chip active' : 'chip'}
              onClick={() => onCategoryChange(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <section className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onOpenProduct={onOpenProduct}
              onAddToCart={onAddToCart}
            />
          ))}
        </section>

        {products.length === 0 ? (
          <div className="empty-state">
            <h3>No products found</h3>
            <p>Try another keyword or category filter.</p>
          </div>
        ) : null}

        <section className="promo-card">
          <span className="promo-label">New Arrival</span>
          <h3>Compostable Cutlery Sets</h3>
          <p>Complete your eco-friendly setup with our new line of durable forks & spoons.</p>
          <button type="button" className="btn btn-light" onClick={() => onNotify('Cutlery listing launching soon')}>
            Shop Now
          </button>
        </section>
      </main>
    </>
  )
}
