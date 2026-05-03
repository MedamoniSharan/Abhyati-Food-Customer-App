import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adminFetch, adminUploadItemImage } from '../adminApi'
import { IconDeleteButton, IconEditButton } from './AdminIconButtons'
import { itemImageUrl, type ZohoItemRow } from '../productImage'

type PageCtx = {
  page?: number
  per_page?: number
  has_more_page?: boolean
}

const PER_PAGE_OPTIONS = [12, 24, 48, 96] as const

const FILTER_OPTIONS = [
  { value: '', label: 'All items' },
  { value: 'Status.Active', label: 'Active only' },
  { value: 'Status.Inactive', label: 'Inactive only' },
  { value: 'ProductType.Goods', label: 'Goods' },
  { value: 'ProductType.Services', label: 'Services' }
]

function ItemThumb({ itemId, label, cacheBust }: { itemId: string; label: string; cacheBust?: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [itemId, cacheBust])
  if (!itemId || failed) {
    return (
      <div className="admin-item-thumb admin-item-thumb--placeholder" aria-hidden>
        <span>{(label || '?').slice(0, 1).toUpperCase()}</span>
      </div>
    )
  }
  return (
    <img
      className="admin-item-thumb"
      src={itemImageUrl(itemId, cacheBust)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

export function ProductsSection() {
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<(typeof PER_PAGE_OPTIONS)[number]>(24)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterBy, setFilterBy] = useState('')
  const [items, setItems] = useState<ZohoItemRow[]>([])
  const [pageCtx, setPageCtx] = useState<PageCtx | null>(null)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [newProduct, setNewProduct] = useState({
    name: '',
    rate: '',
    sku: '',
    unit: 'unit',
    description: '',
    product_type: 'goods' as 'goods' | 'service' | 'digital_service'
  })
  const [newProductImage, setNewProductImage] = useState<File | null>(null)
  const [isDraggingNewImage, setIsDraggingNewImage] = useState(false)
  const newProductImageInputRef = useRef<HTMLInputElement>(null)
  const [editingItem, setEditingItem] = useState<ZohoItemRow | null>(null)
  const [editProductImage, setEditProductImage] = useState<File | null>(null)
  const [editImageObjectUrl, setEditImageObjectUrl] = useState<string | null>(null)
  const [isDraggingEditImage, setIsDraggingEditImage] = useState(false)
  const editImageInputRef = useRef<HTMLInputElement>(null)
  const [imageRevByItem, setImageRevByItem] = useState<Record<string, string>>({})

  useEffect(() => {
    setEditProductImage(null)
    setIsDraggingEditImage(false)
  }, [editingItem?.item_id])

  useEffect(() => {
    if (!editProductImage) {
      setEditImageObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(editProductImage)
    setEditImageObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [editProductImage])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, filterBy, perPage])

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    setCatalogError('')
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(page))
      qs.set('per_page', String(perPage))
      if (debouncedSearch) qs.set('search_text', debouncedSearch)
      if (filterBy) qs.set('filter_by', filterBy)
      const r = await adminFetch<{ items?: ZohoItemRow[]; page_context?: PageCtx }>(`/api/admin/items?${qs.toString()}`)
      setItems(Array.isArray(r.items) ? r.items : [])
      setPageCtx(r.page_context ?? null)
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : 'Failed to load items')
      setItems([])
      setPageCtx(null)
    } finally {
      setLoadingCatalog(false)
    }
  }, [page, perPage, debouncedSearch, filterBy])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const hasNext = pageCtx?.has_more_page === true
  const hasPrev = page > 1

  const rangeLabel = useMemo(() => {
    const p = pageCtx?.page ?? page
    const pp = pageCtx?.per_page ?? perPage
    if (items.length === 0) return loadingCatalog ? 'Loading…' : 'No items on this page'
    const start = (p - 1) * pp + 1
    const end = (p - 1) * pp + items.length
    return `Showing ${start}–${end}${hasNext ? ' (more on next page)' : ''} · page ${p}`
  }, [page, pageCtx, perPage, items.length, hasNext, loadingCatalog])

  async function refreshAfterMutation() {
    await loadCatalog()
  }

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Products</h2>
      <p className="admin-products-lead">
        Zoho Books items — same catalog as the customer app (<code>/api/zoho/items</code>). Thumbnails use{' '}
        <code>/api/items/:id/image</code>. You can attach a JPEG, PNG, GIF, or WebP when creating or editing. Use search
        and filters to narrow the list; switch between grid and table.
      </p>

      <section className="admin-card admin-card--form">
        <h3 className="admin-card-title">Add product</h3>
        <div className="admin-form-row admin-form-row--wrap">
          <input
            className="admin-input admin-input--grow"
            placeholder="Name *"
            value={newProduct.name}
            onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="admin-input"
            style={{ width: 120 }}
            placeholder="Rate *"
            type="number"
            min={0}
            step="0.01"
            value={newProduct.rate}
            onChange={(e) => setNewProduct((p) => ({ ...p, rate: e.target.value }))}
          />
          <input
            className="admin-input"
            style={{ width: 120 }}
            placeholder="SKU"
            value={newProduct.sku}
            onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))}
          />
          <input
            className="admin-input"
            style={{ width: 100 }}
            placeholder="Unit"
            value={newProduct.unit}
            onChange={(e) => setNewProduct((p) => ({ ...p, unit: e.target.value }))}
          />
          <select
            className="admin-input"
            style={{ width: 140 }}
            value={newProduct.product_type}
            onChange={(e) =>
              setNewProduct((p) => ({
                ...p,
                product_type: e.target.value as typeof p.product_type
              }))
            }
          >
            <option value="goods">goods</option>
            <option value="service">service</option>
            <option value="digital_service">digital_service</option>
          </select>
          <input
            className="admin-input admin-input--grow"
            placeholder="Description"
            value={newProduct.description}
            onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
          />
          <label className="admin-file-label">
            <div
              className={`admin-dropzone${isDraggingNewImage ? ' is-dragging' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDraggingNewImage(true)
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                setIsDraggingNewImage(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                if (e.currentTarget === e.target) setIsDraggingNewImage(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                setIsDraggingNewImage(false)
                const file = e.dataTransfer.files?.[0]
                if (!file) return
                if (!file.type.startsWith('image/')) {
                  alert('Please drop an image file')
                  return
                }
                setNewProductImage(file)
              }}
            >
              <p className="admin-dropzone__title">Drag & drop product image here</p>
              <p className="admin-dropzone__meta">or click below to choose (JPEG, PNG, GIF, WebP)</p>
              <span className="admin-file-label__text">Image (optional)</span>
              <input
                ref={newProductImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="admin-file-input"
                onChange={(e) => setNewProductImage(e.target.files?.[0] ?? null)}
              />
            </div>
          </label>
          <button
            type="button"
            className="admin-btn admin-btn-inline"
            onClick={async () => {
              const rate = Number(newProduct.rate)
              if (!newProduct.name.trim() || !Number.isFinite(rate)) {
                alert('Name and rate are required')
                return
              }
              try {
                const created = await adminFetch<{ item?: { item_id?: string } }>('/api/admin/items', {
                  method: 'POST',
                  body: JSON.stringify({
                    name: newProduct.name.trim(),
                    rate,
                    product_type: newProduct.product_type,
                    unit: newProduct.unit.trim() || 'unit',
                    ...(newProduct.sku.trim() ? { sku: newProduct.sku.trim() } : {}),
                    ...(newProduct.description.trim() ? { description: newProduct.description.trim() } : {})
                  })
                })
                const itemId = created.item?.item_id != null ? String(created.item.item_id) : ''
                let imageErr = ''
                if (newProductImage && itemId) {
                  try {
                    await adminUploadItemImage(itemId, newProductImage)
                    setImageRevByItem((m) => ({ ...m, [itemId]: String(Date.now()) }))
                  } catch (imgE) {
                    imageErr =
                      '\n\nImage was not uploaded: ' + (imgE instanceof Error ? imgE.message : 'Unknown error')
                  }
                } else if (newProductImage && !itemId) {
                  imageErr = '\n\nCould not upload image (no item id in Zoho response).'
                }
                setNewProduct({
                  name: '',
                  rate: '',
                  sku: '',
                  unit: 'unit',
                  description: '',
                  product_type: 'goods'
                })
                setNewProductImage(null)
                setIsDraggingNewImage(false)
                if (newProductImageInputRef.current) newProductImageInputRef.current.value = ''
                await refreshAfterMutation()
                alert(`Product created in Zoho Books.${imageErr}`)
              } catch (e) {
                alert(e instanceof Error ? e.message : 'Failed')
              }
            }}
          >
            Create in Zoho
          </button>
        </div>
      </section>

      <section className="admin-card" style={{ marginTop: 20 }}>
        <div className="admin-toolbar">
          <div className="admin-toolbar__search">
            <span className="admin-toolbar__search-icon" aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              className="admin-toolbar__search-input"
              placeholder="Search name, SKU…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search products"
            />
          </div>
          <select
            className="admin-select"
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            aria-label="Filter by status or type"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value) as (typeof PER_PAGE_OPTIONS)[number])}
            aria-label="Items per page"
          >
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
          <div className="admin-segmented" role="group" aria-label="View mode">
            <button
              type="button"
              className={view === 'grid' ? 'is-active' : ''}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={view === 'table' ? 'is-active' : ''}
              onClick={() => setView('table')}
            >
              Table
            </button>
          </div>
        </div>

        <div className="admin-toolbar-meta">
          {loadingCatalog ? <span className="admin-muted">Loading…</span> : <span>{rangeLabel}</span>}
          {catalogError ? <span className="admin-error-inline">{catalogError}</span> : null}
        </div>

        {view === 'grid' ? (
          <div className="admin-product-grid">
            {items.map((it) => {
              const id = String(it.item_id ?? '')
              const name = String(it.name ?? 'Item')
              return (
                <article key={id || name} className="admin-product-card">
                  <div className="admin-product-card__media">
                    {id ? <ItemThumb itemId={id} label={name} cacheBust={imageRevByItem[id]} /> : null}
                  </div>
                  <div className="admin-product-card__body">
                    <h4 className="admin-product-card__title">{name}</h4>
                    <p className="admin-product-card__meta">
                      {String(it.sku || '—')} · {String(it.product_type || '—')}
                    </p>
                    <p className="admin-product-card__price">₹ {String(it.rate ?? '—')}</p>
                    <div className="admin-product-card__actions">
                      <IconEditButton label={`Edit ${name}`} onClick={() => setEditingItem(it)} />
                      <IconDeleteButton
                        label={`Delete ${name}`}
                        onClick={async () => {
                          if (!id || !confirm(`Delete “${name}” from Zoho?`)) return
                          try {
                            await adminFetch(`/api/admin/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
                            await refreshAfterMutation()
                          } catch (e) {
                            alert(e instanceof Error ? e.message : 'Failed')
                          }
                        }}
                      />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="admin-table-wrap admin-table-wrap--tight">
            <table className="admin-table admin-table--products">
              <thead>
                <tr>
                  <th className="admin-th-thumb" scope="col">
                    Image
                  </th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Rate</th>
                  <th>Item ID</th>
                  <th scope="col" className="admin-th-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const id = String(it.item_id ?? '')
                  const name = String(it.name ?? '')
                  return (
                    <tr key={id || name}>
                      <td>
                        <div className="admin-table-thumb-wrap">
                          {id ? <ItemThumb itemId={id} label={name} cacheBust={imageRevByItem[id]} /> : null}
                        </div>
                      </td>
                      <td className="admin-td-strong">{name}</td>
                      <td>{String(it.sku ?? '—')}</td>
                      <td>{String(it.product_type ?? '—')}</td>
                      <td>
                        <span
                          className={
                            String(it.status).toLowerCase() === 'active'
                              ? 'admin-pill'
                              : 'admin-pill admin-pill--muted'
                          }
                        >
                          {String(it.status ?? '—')}
                        </span>
                      </td>
                      <td>{String(it.rate ?? '—')}</td>
                      <td className="admin-td-mono">{id}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <IconEditButton label={`Edit ${name}`} onClick={() => setEditingItem(it)} />
                          <IconDeleteButton
                            label={`Delete ${name}`}
                            onClick={async () => {
                              if (!id || !confirm(`Delete “${name}” from Zoho?`)) return
                              try {
                                await adminFetch(`/api/admin/items/${encodeURIComponent(id)}`, { method: 'DELETE' })
                                await refreshAfterMutation()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : 'Failed')
                              }
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <nav className="admin-pagination" aria-label="Catalog pages">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={!hasPrev || loadingCatalog}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="admin-pagination__info">
            Page <strong>{pageCtx?.page ?? page}</strong>
            {hasNext ? <span className="admin-muted"> · more available</span> : null}
          </span>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            disabled={!hasNext || loadingCatalog}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </nav>
      </section>

      {editingItem ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingItem(null)
          }}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="admin-modal__title">Edit item</h3>
            {String(editingItem.item_id ?? '') ? (
              <div className="admin-modal__thumb-row">
                <div className="admin-modal__thumb-preview">
                  {editImageObjectUrl ? (
                    <img className="admin-item-thumb" src={editImageObjectUrl} alt="" />
                  ) : (
                    <ItemThumb
                      itemId={String(editingItem.item_id)}
                      label={String(editingItem.name ?? '')}
                      cacheBust={imageRevByItem[String(editingItem.item_id)]}
                    />
                  )}
                </div>
                <div
                  className={`admin-dropzone${isDraggingEditImage ? ' is-dragging' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDraggingEditImage(true)
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault()
                    setIsDraggingEditImage(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    if (e.currentTarget === e.target) setIsDraggingEditImage(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDraggingEditImage(false)
                    const file = e.dataTransfer.files?.[0]
                    if (!file) return
                    if (!file.type.startsWith('image/')) {
                      alert('Please drop an image file')
                      return
                    }
                    setEditProductImage(file)
                  }}
                >
                  <p className="admin-dropzone__title">Drag & drop product image here</p>
                  <p className="admin-dropzone__meta">or click below to choose (JPEG, PNG, GIF, WebP)</p>
                  <label className="admin-file-label admin-file-label--block">
                    <span className="admin-file-label__text">Replace image (optional)</span>
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="admin-file-input"
                      onChange={(e) => setEditProductImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
            <input
              className="admin-input"
              placeholder="Name"
              value={String(editingItem.name ?? '')}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            />
            <input
              className="admin-input"
              type="number"
              placeholder="Rate"
              value={editingItem.rate != null ? String(editingItem.rate) : ''}
              onChange={(e) => setEditingItem({ ...editingItem, rate: Number(e.target.value) })}
            />
            <input
              className="admin-input"
              placeholder="SKU"
              value={String(editingItem.sku ?? '')}
              onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
            />
            <input
              className="admin-input"
              placeholder="Description"
              value={String(editingItem.description ?? '')}
              onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
            />
            <div className="admin-modal__footer">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={() => setEditingItem(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-inline"
                onClick={async () => {
                  const id = String(editingItem.item_id ?? '')
                  if (!id) return
                  try {
                    await adminFetch(`/api/admin/items/${encodeURIComponent(id)}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        name: editingItem.name,
                        rate: editingItem.rate,
                        sku: editingItem.sku || undefined,
                        description: editingItem.description || undefined
                      })
                    })
                    if (editProductImage) {
                      try {
                        await adminUploadItemImage(id, editProductImage)
                        setImageRevByItem((m) => ({ ...m, [id]: String(Date.now()) }))
                        setEditProductImage(null)
                      } catch (imgE) {
                        alert(
                          `Saved item, but image upload failed: ${imgE instanceof Error ? imgE.message : 'Unknown'}`
                        )
                        await refreshAfterMutation()
                        return
                      }
                    }
                    setEditingItem(null)
                    await refreshAfterMutation()
                  } catch (e) {
                    alert(e instanceof Error ? e.message : 'Failed')
                  }
                }}
              >
                Save to Zoho
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
