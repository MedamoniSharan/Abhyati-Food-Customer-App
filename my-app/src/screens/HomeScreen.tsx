import { categories } from '../data/mockData'
import type { Product } from '../types/app'
import { ProductCard } from '../components/ProductCard'

type Props = {
  products: Product[]
  category: string
  query: string
  cartCount: number
  onCategoryChange: (category: string) => void
  onQueryChange: (value: string) => void
  onViewAll: () => void
  onOpenProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
  onOpenCart: () => void
  onNotify: (message: string) => void
}

export function HomeScreen({
  products,
  category,
  query,
  cartCount,
  onCategoryChange,
  onQueryChange,
  onViewAll,
  onOpenProduct,
  onAddToCart,
  onOpenCart,
  onNotify,
}: Props) {
  return (
    <>
      <header className="top-header home-header">
        <div className="header-row">
          <div className="brand-wrap">
            <button type="button" className="icon-btn icon-btn-dark" onClick={() => onNotify('Menu coming soon')}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1>PlatePro</h1>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-btn icon-btn-dark with-dot"
              onClick={() => onNotify('No new notifications')}
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button type="button" className="icon-btn icon-btn-dark" onClick={onOpenCart}>
              <span className="material-symbols-outlined">shopping_cart</span>
              {cartCount > 0 ? <em className="top-badge">{cartCount}</em> : null}
            </button>
          </div>
        </div>
        <label className="search-bar">
          <span className="material-symbols-outlined">search</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search paper plates, cups & more..."
          />
          <button type="button" onClick={() => onNotify('Voice search is coming soon')}>
            <span className="material-symbols-outlined">mic</span>
          </button>
        </label>
      </header>

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
