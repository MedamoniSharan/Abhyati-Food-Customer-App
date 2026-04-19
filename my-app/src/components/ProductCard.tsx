import type { Product } from '../types/app'
import { ProductImage } from './ProductImage'
import { formatInr } from '../utils/currency'

type Props = {
  product: Product
  onOpenProduct: (product: Product) => void
  onAddToCart: (product: Product) => void
}

export function ProductCard({ product, onOpenProduct, onAddToCart }: Props) {
  return (
    <article className="product-card">
      <button type="button" className="image-frame image-button" onClick={() => onOpenProduct(product)}>
        <ProductImage product={product} />
        {product.badge ? (
          <span className={`badge badge-${product.badge.tone}`}>{product.badge.label}</span>
        ) : null}
      </button>
      <h3>{product.name}</h3>
      <p className="product-subtitle">{product.subtitle}</p>
      <div className="price-row">
        {product.oldPriceInr ? <span className="old-price">{formatInr(product.oldPriceInr)}</span> : null}
        <span className="price">{formatInr(product.priceInr)}</span>
      </div>
      <button type="button" className="btn btn-accent" onClick={() => onAddToCart(product)}>
        Add to Cart
      </button>
    </article>
  )
}
