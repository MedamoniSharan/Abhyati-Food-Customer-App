import { useEffect, useMemo, useState } from 'react'
import { ProductImage } from '../components/ProductImage'
import type { Product } from '../types/app'
import { fetchZohoItemDetail } from '../services/backendApi'
import { formatInr } from '../utils/currency'
import {
  zohoItemToSpecRows,
  zohoMinOrderQuantity,
  zohoRateInr,
  zohoStockLine,
  zohoUnitLabel,
  type ZohoSpecRow,
} from '../utils/productDetailFromZoho'

type Props = {
  product: Product
  onBack: () => void
  onOpenCart: () => void
  onAddToCart: (product: Product, quantity: number) => void
  onBuyNow: (product: Product, quantity: number) => void
}

function fallbackSpecRows(product: Product): ZohoSpecRow[] {
  const rows: ZohoSpecRow[] = [{ label: 'Category', value: product.category }]
  if (product.subtitle.trim()) {
    rows.unshift({ label: 'Description', value: product.subtitle.trim() })
  }
  return rows
}

export function ProductDetailsScreen({ product, onBack, onOpenCart, onAddToCart, onBuyNow }: Props) {
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  const [detailLoading, setDetailLoading] = useState(Boolean(product.zohoItemId))
  const [detailError, setDetailError] = useState<string | null>(null)

  const [quantity, setQuantity] = useState(10)

  useEffect(() => {
    if (!product.zohoItemId) {
      setDetail(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    void fetchZohoItemDetail(product.zohoItemId).then((item) => {
      if (cancelled) return
      setDetail(item)
      if (!item) setDetailError('Could not load product details from the server.')
      setDetailLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [product.zohoItemId])

  const minOrder = useMemo(() => zohoMinOrderQuantity(detail), [detail])

  useEffect(() => {
    setQuantity((q) => Math.max(minOrder, q))
  }, [minOrder])

  const displayName =
    detail && detail.name != null && String(detail.name).trim()
      ? String(detail.name).trim()
      : product.name

  const displayRate = detail ? (zohoRateInr(detail) ?? product.priceInr) : product.priceInr
  const unitLabel = detail ? zohoUnitLabel(detail) : 'carton'
  const stockLine = detail ? zohoStockLine(detail) : 'In stock, ready to ship'

  const specRows: ZohoSpecRow[] = useMemo(() => {
    if (detail) return zohoItemToSpecRows(detail)
    return fallbackSpecRows(product)
  }, [detail, product])

  const total = useMemo(() => displayRate * quantity, [displayRate, quantity])

  const productForCart = useMemo((): Product => {
    const desc =
      detail && typeof detail.description === 'string' && detail.description.trim()
        ? detail.description.trim()
        : product.subtitle
    return {
      ...product,
      name: displayName,
      priceInr: displayRate,
      subtitle: desc,
    }
  }, [product, displayName, displayRate, detail])

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
            {product.badge ? (
              <span className={`hero-tag hero-tag-${product.badge.tone}`}>{product.badge.label}</span>
            ) : null}
          </div>
        </section>

        <section className="product-heading">
          <h2>{displayName}</h2>
          <div className="unit-price">
            <strong>{formatInr(displayRate)}</strong>
            <span> / {unitLabel}</span>
          </div>
          <p className="stock">
            {detailLoading && product.zohoItemId ? 'Loading stock…' : detailError ? detailError : stockLine}
          </p>
        </section>

        <section className="details-card">
          <p className="label">Bulk Quantity ({unitLabel})</p>
          <div className="quantity-row">
            <div className="quantity-box">
              <button
                type="button"
                className="counter-btn"
                disabled={quantity <= minOrder}
                onClick={() => setQuantity((q) => Math.max(minOrder, q - 1))}
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
          <p className="min-order">
            Min. order: {minOrder} {unitLabel}
            {detailLoading ? ' · checking catalog…' : ''}
          </p>
        </section>

        <section className="details-card">
          <h3>Specifications</h3>
          {detailLoading && product.zohoItemId ? (
            <p className="product-detail-placeholder">Loading specifications…</p>
          ) : specRows.length === 0 ? (
            <p className="product-detail-placeholder">No specifications listed for this item.</p>
          ) : (
            <div className="spec-grid">
              {specRows.map((row, index) => (
                <div key={`${index}-${row.label}`}>
                  <small>{row.label}</small>
                  <p className={row.label === 'Description' ? 'spec-value-multiline' : undefined}>{row.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="bottom-action-bar">
        <button type="button" className="btn btn-outline" onClick={() => onAddToCart(productForCart, quantity)}>
          <span className="material-symbols-outlined">add_shopping_cart</span>
          Add to Cart
        </button>
        <button type="button" className="btn btn-accent" onClick={() => onBuyNow(productForCart, quantity)}>
          <span className="material-symbols-outlined">bolt</span>
          Buy Now
        </button>
      </div>
    </>
  )
}
