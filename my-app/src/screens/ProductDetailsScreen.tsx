import { useMemo, useState } from 'react'
import { ProductImage } from '../components/ProductImage'
import type { Product } from '../types/app'
import { formatInr } from '../utils/currency'

type Props = {
  product: Product
  onBack: () => void
  onOpenCart: () => void
  onAddToCart: (product: Product, quantity: number) => void
  onBuyNow: (product: Product, quantity: number) => void
}

export function ProductDetailsScreen({ product, onBack, onOpenCart, onAddToCart, onBuyNow }: Props) {
  const [quantity, setQuantity] = useState(10)
  const total = useMemo(() => product.priceInr * quantity, [product.priceInr, quantity])

  return (
    <>
      <header className="top-header light-header">
        <div className="header-row centered-title">
          <button type="button" className="icon-btn" onClick={onBack}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1>Product Details</h1>
          <button type="button" className="icon-btn with-dot" onClick={onOpenCart}>
            <span className="material-symbols-outlined">shopping_cart</span>
          </button>
        </div>
      </header>

      <main className="content product-content">
        <section className="gallery">
          <div className="hero-image">
            <ProductImage product={product} />
            <span className="hero-tag">Best Seller</span>
          </div>
        </section>

        <section className="product-heading">
          <h2>{product.name}</h2>
          <div className="unit-price">
            <strong>{formatInr(product.priceInr)}</strong>
            <span>/ carton</span>
          </div>
          <p className="stock">In stock, ready to ship</p>
        </section>

        <section className="details-card">
          <p className="label">Bulk Quantity (Cartons)</p>
          <div className="quantity-row">
            <div className="quantity-box">
              <button
                type="button"
                className="counter-btn"
                disabled={quantity <= 10}
                onClick={() => setQuantity((q) => Math.max(10, q - 1))}
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
              <span>{quantity}</span>
              <button type="button" className="counter-btn" onClick={() => setQuantity((q) => q + 1)}>
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
            <div className="total-wrap">
              <small>Total Price</small>
              <strong>{formatInr(total)}</strong>
            </div>
          </div>
          <p className="min-order">Min. order: 10 cartons</p>
        </section>

        <section className="details-card">
          <h3>Specifications</h3>
          <div className="spec-grid">
            <div>
              <small>Material</small>
              <p>Recycled Paper</p>
            </div>
            <div>
              <small>Size</small>
              <p>9 inches</p>
            </div>
            <div>
              <small>GSM</small>
              <p>250 GSM</p>
            </div>
            <div>
              <small>Color</small>
              <p>White</p>
            </div>
            <div>
              <small>Coating</small>
              <p>None</p>
            </div>
            <div>
              <small>Biodegradable</small>
              <p>Yes</p>
            </div>
          </div>
        </section>
      </main>

      <div className="bottom-action-bar">
        <button type="button" className="btn btn-outline" onClick={() => onAddToCart(product, quantity)}>
          <span className="material-symbols-outlined">add_shopping_cart</span>
          Add to Cart
        </button>
        <button type="button" className="btn btn-accent" onClick={() => onBuyNow(product, quantity)}>
          <span className="material-symbols-outlined">bolt</span>
          Buy Now
        </button>
      </div>
    </>
  )
}
