import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adminFetch, adminUploadItemImage } from '../adminApi'
import { IconDeleteButton, IconEditButton } from './AdminIconButtons'
import { useToast } from './Toast'
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

const STOCK_KEYS = ['stock_on_hand', 'available_stock', 'actual_available_stock', 'opening_stock'] as const

/** Zoho list/detail rows should include `item_id`; if not, save must not silently no-op. */
function resolveItemId(item: ZohoItemRow | null | undefined): string {
  if (!item) return ''
  const raw = item.item_id
  if (raw == null) return ''
  const id = String(raw).trim()
  return id
}

/** Zoho item GET/PUT responses are usually `{ item: {...} }`; accept a bare item object too. */
function extractZohoItemFromItemResponse(data: unknown): ZohoItemRow | undefined {
  if (!data || typeof data !== 'object') return undefined
  const o = data as Record<string, unknown>
  const nested = o.item
  if (nested && typeof nested === 'object') return nested as ZohoItemRow
  if (o.item_id != null || typeof o.name === 'string' || 'rate' in o) return o as ZohoItemRow
  return undefined
}

function readItemStock(item: ZohoItemRow | null | undefined): number | null {
  if (!item) return null
  for (const key of STOCK_KEYS) {
    const n = Number(item[key])
    if (Number.isFinite(n)) return n
  }
  const locs = item.locations
  if (Array.isArray(locs)) {
    let fallback: number | null = null
    for (const loc of locs) {
      if (!loc || typeof loc !== 'object') continue
      const rec = loc as Record<string, unknown>
      for (const field of ['location_actual_available_stock', 'location_available_stock', 'location_stock_on_hand'] as const) {
        const n = Number(rec[field])
        if (!Number.isFinite(n)) continue
        if (rec.is_primary === true || rec.is_primary === 'true') return n
        if (fallback === null) fallback = n
      }
    }
    if (fallback !== null) return fallback
  }
  return null
}

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

function UploadIcon() {
  return (
    <svg className="admin-dropzone__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 16V8" />
      <path d="m8.5 11.5 3.5-3.5 3.5 3.5" />
      <rect x="3" y="4" width="18" height="16" rx="3" />
    </svg>
  )
}

export function ProductsSection() {
  const { toast } = useToast()
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
  const [editingStock, setEditingStock] = useState('')
  const [editProductImage, setEditProductImage] = useState<File | null>(null)
  const [editImageObjectUrl, setEditImageObjectUrl] = useState<string | null>(null)
  const [isDraggingEditImage, setIsDraggingEditImage] = useState(false)
  const editImageInputRef = useRef<HTMLInputElement>(null)
  const [imageRevByItem, setImageRevByItem] = useState<Record<string, string>>({})
  const [productsSortAsc, setProductsSortAsc] = useState(true)
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>({})
  const [showAddProductModal, setShowAddProductModal] = useState(false)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)

  useEffect(() => {
    setEditProductImage(null)
    setIsDraggingEditImage(false)
    setEditingStock(editingItem ? String(readItemStock(editingItem) ?? '') : '')
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
    const t = window.setTimeout(() => {
      const trimmed = searchInput.trim()
      setDebouncedSearch(trimmed)
      setPage(1)
    }, 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadCatalog = useCallback(
    async (opts?: { signal?: AbortSignal }) => {
      const signal = opts?.signal
      setLoadingCatalog(true)
      setCatalogError('')
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(page))
        qs.set('per_page', String(perPage))
        if (debouncedSearch) qs.set('search_text', debouncedSearch)
        if (filterBy) qs.set('filter_by', filterBy)
        const r = await adminFetch<{ items?: ZohoItemRow[]; page_context?: PageCtx }>(
          `/api/admin/items?${qs.toString()}`,
          signal ? { signal } : {}
        )
        if (signal?.aborted) return
        setItems(Array.isArray(r.items) ? r.items : [])
        setPageCtx(r.page_context ?? null)
      } catch (e) {
        if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) return
        setCatalogError(e instanceof Error ? e.message : 'Failed to load items')
        setItems([])
        setPageCtx(null)
      } finally {
        if (!signal?.aborted) setLoadingCatalog(false)
      }
    },
    [page, perPage, debouncedSearch, filterBy]
  )

  useEffect(() => {
    const ac = new AbortController()
    void loadCatalog({ signal: ac.signal })
    return () => ac.abort()
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
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        productsSortAsc
          ? String(a.name ?? '').localeCompare(String(b.name ?? ''))
          : String(b.name ?? '').localeCompare(String(a.name ?? ''))
      ),
    [items, productsSortAsc]
  )
  const showCatalogSkeleton = loadingCatalog && items.length === 0
  const skeletonCardCount = Math.max(6, Math.min(perPage, 12))
  const selectedProducts = useMemo(
    () => sortedItems.filter((it) => selectedProductIds[resolveItemId(it)]),
    [sortedItems, selectedProductIds]
  )
  const selectedProductsCount = selectedProducts.length

  async function refreshAfterMutation(delayMs = 0) {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    await loadCatalog()
  }

  async function createProduct() {
    const rate = Number(newProduct.rate)
    if (!newProduct.name.trim() || !Number.isFinite(rate)) {
      toast('Name and rate are required', 'info')
      return
    }
    setCreatingProduct(true)
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
          imageErr = '\n\nImage was not uploaded: ' + (imgE instanceof Error ? imgE.message : 'Unknown error')
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
      setShowAddProductModal(false)
      await refreshAfterMutation()
      toast(imageErr ? `Product created.${imageErr}` : 'Product created in Zoho Books')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', 'error')
    } finally {
      setCreatingProduct(false)
    }
  }

  return (
    <>
      <div className="admin-products-header">
        <h2 style={{ marginTop: 0 }}>Products</h2>
        <button type="button" className="admin-btn admin-btn-inline admin-btn-add-product" onClick={() => setShowAddProductModal(true)}>
          Add Product
        </button>
      </div>

      <section className="admin-card">
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
            onChange={(e) => {
              setFilterBy(e.target.value)
              setPage(1)
            }}
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
            onChange={(e) => {
              setPerPage(Number(e.target.value) as (typeof PER_PAGE_OPTIONS)[number])
              setPage(1)
            }}
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
        {view === 'table' ? (
          <div className="admin-toolbar-meta" style={{ justifyContent: 'space-between' }}>
            <span className="admin-muted">
              {selectedProductsCount > 0 ? `${selectedProductsCount} selected` : 'Select rows to edit or delete'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <IconEditButton
                label={selectedProductsCount !== 1 ? 'Select exactly one product to edit' : 'Edit selected product'}
                disabled={selectedProductsCount !== 1}
                onClick={() => {
                  if (selectedProductsCount !== 1) return
                  setEditingItem(selectedProducts[0])
                }}
              />
              <IconDeleteButton
                label={selectedProductsCount === 0 ? 'Select products to delete' : 'Delete selected products'}
                disabled={selectedProductsCount === 0}
                onClick={async () => {
                  if (selectedProductsCount === 0) return
                  const ids = selectedProducts.map((it) => resolveItemId(it)).filter(Boolean)
                  if (ids.length === 0) {
                    toast('Cannot delete: selected rows have no Zoho item id.', 'error')
                    return
                  }
                  if (!confirm(`Delete ${ids.length} selected product(s) from Zoho?`)) return
                  const failures: string[] = []
                  let deactivated = 0
                  for (const id of ids) {
                    try {
                      const r = await adminFetch<Record<string, unknown>>(`/api/admin/items/${encodeURIComponent(id)}`, {
                        method: 'DELETE'
                      })
                      if (r?.deactivated_instead_of_delete) deactivated += 1
                    } catch (e) {
                      failures.push(`${id}: ${e instanceof Error ? e.message : 'Failed'}`)
                    }
                  }
                  setSelectedProductIds({})
                  await refreshAfterMutation()
                  if (failures.length > 0) {
                    toast(`Some deletes failed (${failures.length}). ${failures.slice(0, 3).join('; ')}`, 'error')
                  } else if (deactivated > 0) {
                    toast(
                      deactivated === ids.length
                        ? `${deactivated} item(s) could not be deleted (in use). Marked inactive in Zoho instead.`
                        : `${deactivated} marked inactive (in use); ${ids.length - deactivated} deleted.`
                    )
                  } else {
                    toast(`${ids.length} product(s) deleted from Zoho`)
                  }
                }}
              />
            </div>
          </div>
        ) : null}

        {view === 'grid' ? (
          <div className="admin-product-grid">
            {showCatalogSkeleton
              ? Array.from({ length: skeletonCardCount }).map((_, i) => (
                  <article key={`skeleton-grid-${i}`} className="admin-product-card admin-product-card--skeleton" aria-hidden>
                    <div className="admin-product-card__media admin-skeleton admin-skeleton--media" />
                    <div className="admin-product-card__body">
                      <div className="admin-skeleton admin-skeleton--line admin-skeleton--title" />
                      <div className="admin-skeleton admin-skeleton--line admin-skeleton--meta" />
                      <div className="admin-skeleton admin-skeleton--line admin-skeleton--price" />
                    </div>
                  </article>
                ))
              : sortedItems.map((it) => {
                  const id = resolveItemId(it)
                  const name = String(it.name ?? 'Item')
                  return (
                    <article
                      key={id || name}
                      className="admin-product-card admin-product-card--clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => setEditingItem(it)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setEditingItem(it)
                        }
                      }}
                    >
                      <div className="admin-product-card__media">
                        {id ? <ItemThumb itemId={id} label={name} cacheBust={imageRevByItem[id]} /> : <ItemThumb itemId="" label={name} />}
                      </div>
                      <div className="admin-product-card__body">
                        <p className="admin-product-card__meta">
                          {String(it.sku || '—')} · {String(it.product_type || '—')}
                        </p>
                        <h4 className="admin-product-card__title">{name}</h4>
                        <p className="admin-product-card__price">₹ {String(it.rate ?? '—')}</p>
                        <p className="admin-product-card__stock">
                          {(() => {
                            const stock = readItemStock(it)
                            if (stock === null || stock === undefined) return <span className="admin-stock-badge admin-stock-badge--none">No stock info</span>
                            if (stock <= 0) return <span className="admin-stock-badge admin-stock-badge--out">Out of stock</span>
                            if (stock < 10) return <span className="admin-stock-badge admin-stock-badge--low">Low · {stock}</span>
                            return <span className="admin-stock-badge admin-stock-badge--ok">In stock · {stock}</span>
                          })()}
                        </p>
                        <div className="admin-product-card__actions" onClick={(e) => e.stopPropagation()}>
                          <IconEditButton label={`Edit ${name}`} onClick={() => setEditingItem(it)} />
                          <IconDeleteButton
                            label={`Delete ${name}`}
                            onClick={async () => {
                              if (!id) {
                                toast('Cannot delete: this row has no Zoho item id.', 'error')
                                return
                              }
                              if (!confirm(`Delete “${name}” from Zoho?`)) return
                              try {
                                const r = await adminFetch<Record<string, unknown>>(
                                  `/api/admin/items/${encodeURIComponent(id)}`,
                                  { method: 'DELETE' }
                                )
                                if (r?.deactivated_instead_of_delete) {
                                  setItems((prev) =>
                                    prev.map((row) =>
                                      resolveItemId(row) === id ? { ...row, status: 'inactive' } : row
                                    )
                                  )
                                } else {
                                  setItems((prev) => prev.filter((row) => resolveItemId(row) !== id))
                                }
                                await refreshAfterMutation()
                                toast(
                                  r?.deactivated_instead_of_delete && typeof r.message === 'string'
                                    ? String(r.message)
                                    : 'Product deleted from Zoho'
                                )
                              } catch (e) {
                                toast(e instanceof Error ? e.message : 'Failed', 'error')
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
                  <th>
                    <input
                      type="checkbox"
                      checked={sortedItems.length > 0 && sortedItems.every((it) => !resolveItemId(it) || selectedProductIds[resolveItemId(it)])}
                      onChange={(e) =>
                        setSelectedProductIds(() => {
                          const next: Record<string, boolean> = {}
                          for (const it of sortedItems) {
                            const rid = resolveItemId(it)
                            if (rid) next[rid] = e.target.checked
                          }
                          return next
                        })
                      }
                    />
                  </th>
                  <th className="admin-th-thumb" scope="col">
                    Image
                  </th>
                  <th className="admin-th-sortable" onClick={() => setProductsSortAsc((v) => !v)} title="Sort by name">
                    Name {productsSortAsc ? '▲' : '▼'}
                  </th>
                  <th>SKU</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Rate</th>
                  <th>Stock</th>
                  <th>Item ID</th>
                  <th scope="col" className="admin-th-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {showCatalogSkeleton
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={`skeleton-table-${i}`} aria-hidden>
                        <td><div className="admin-skeleton admin-skeleton--cell" /></td>
                        <td><div className="admin-skeleton admin-skeleton--thumb-cell" /></td>
                        <td><div className="admin-skeleton admin-skeleton--line" /></td>
                        <td><div className="admin-skeleton admin-skeleton--line" /></td>
                        <td><div className="admin-skeleton admin-skeleton--line" /></td>
                        <td><div className="admin-skeleton admin-skeleton--pill" /></td>
                        <td><div className="admin-skeleton admin-skeleton--line" /></td>
                        <td><div className="admin-skeleton admin-skeleton--line" /></td>
                        <td><div className="admin-skeleton admin-skeleton--line" /></td>
                      </tr>
                    ))
                  : sortedItems.map((it) => {
                      const id = resolveItemId(it)
                      const name = String(it.name ?? 'Item')
                      return (
                        <tr key={id || name} className="admin-table-row-clickable" onClick={() => setEditingItem(it)}>
                          <td>
                            <input
                              type="checkbox"
                              checked={!!selectedProductIds[id]}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                setSelectedProductIds((prev) => {
                                  const rid = resolveItemId(it)
                                  if (!rid) return prev
                                  return { ...prev, [rid]: e.target.checked }
                                })
                              }
                            />
                          </td>
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
                          <td>{readItemStock(it) ?? '—'}</td>
                          <td className="admin-td-mono">{id}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                              <IconEditButton label={`Edit ${name}`} onClick={() => setEditingItem(it)} />
                              <IconDeleteButton
                                label={`Delete ${name}`}
                                onClick={async () => {
                                  if (!id) {
                                    toast('Cannot delete: this row has no Zoho item id.', 'error')
                                    return
                                  }
                                  if (!confirm(`Delete “${name}” from Zoho?`)) return
                                  try {
                                    const r = await adminFetch<Record<string, unknown>>(
                                      `/api/admin/items/${encodeURIComponent(id)}`,
                                      { method: 'DELETE' }
                                    )
                                    if (r?.deactivated_instead_of_delete) {
                                      setItems((prev) =>
                                        prev.map((row) =>
                                          resolveItemId(row) === id ? { ...row, status: 'inactive' } : row
                                        )
                                      )
                                    } else {
                                      setItems((prev) => prev.filter((row) => resolveItemId(row) !== id))
                                    }
                                    await refreshAfterMutation()
                                    toast(
                                      r?.deactivated_instead_of_delete && typeof r.message === 'string'
                                        ? String(r.message)
                                        : 'Product deleted from Zoho'
                                    )
                                  } catch (e) {
                                    toast(e instanceof Error ? e.message : 'Failed', 'error')
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
            {resolveItemId(editingItem) ? (
              <div className="admin-modal__thumb-row">
                <div className="admin-modal__thumb-preview">
                  {editImageObjectUrl ? (
                    <img className="admin-item-thumb" src={editImageObjectUrl} alt="" />
                  ) : (
                    <ItemThumb
                      itemId={resolveItemId(editingItem)}
                      label={String(editingItem.name ?? '')}
                      cacheBust={imageRevByItem[resolveItemId(editingItem)]}
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
                      toast('Please drop an image file', 'info')
                      return
                    }
                    setEditProductImage(file)
                  }}
                >
                  <div className="admin-dropzone__inner">
                    <UploadIcon />
                    <p className="admin-dropzone__title">Drag and drop product image</p>
                    <p className="admin-dropzone__meta">JPEG, PNG, GIF, WebP. This image is private until you save.</p>
                    <label className="admin-file-label admin-file-label--block admin-file-label--cta">
                      <span className="admin-file-label__button">Select files</span>
                      <span className="admin-file-label__text">{editProductImage ? editProductImage.name : 'Replace image (optional)'}</span>
                    </label>
                    <input
                      ref={editImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="admin-file-input"
                      onChange={(e) => setEditProductImage(e.target.files?.[0] ?? null)}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <label className="admin-field-label">
              <span>Product name</span>
              <input
                className="admin-input"
                placeholder="Product name"
                value={String(editingItem.name ?? '')}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              />
            </label>
            <label className="admin-field-label">
              <span>Price (rate)</span>
              <input
                className="admin-input"
                type="number"
                min={0}
                step="0.01"
                placeholder="Price (e.g. 99)"
                value={editingItem.rate != null ? String(editingItem.rate) : ''}
                onChange={(e) => setEditingItem({ ...editingItem, rate: Number(e.target.value) })}
              />
            </label>
            <label className="admin-field-label">
              <span>Stock on hand</span>
              <input
                className="admin-input"
                type="number"
                min={0}
                step="1"
                placeholder="Stock quantity (e.g. 120)"
                value={editingStock}
                onChange={(e) => setEditingStock(e.target.value)}
              />
            </label>
            <label className="admin-field-label">
              <span>SKU</span>
              <input
                className="admin-input"
                placeholder="SKU"
                value={String(editingItem.sku ?? '')}
                onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
              />
            </label>
            <label className="admin-field-label">
              <span>Description</span>
              <input
                className="admin-input"
                placeholder="Description"
                value={String(editingItem.description ?? '')}
                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
              />
            </label>
            <div className="admin-modal__footer">
              <button type="button" className="admin-btn admin-btn--ghost" disabled={savingProduct} onClick={() => setEditingItem(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-inline"
                disabled={savingProduct || !resolveItemId(editingItem)}
                onClick={async () => {
                  const id = resolveItemId(editingItem)
                  if (!id) {
                    toast('Cannot save: this row has no Zoho item id. Refresh the list or re-open the item.', 'error')
                    return
                  }
                  setSavingProduct(true)
                  try {
                    const resData = await adminFetch<unknown>(`/api/admin/items/${encodeURIComponent(id)}`, {
                      method: 'PUT',
                      body: JSON.stringify({
                        name: editingItem.name,
                        rate: editingItem.rate,
                        ...(editingStock.trim() ? { stock_on_hand: Number(editingStock) } : {}),
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
                        toast(
                          `Saved item, but image upload failed: ${imgE instanceof Error ? imgE.message : 'Unknown'}`, 'error'
                        )
                        await refreshAfterMutation()
                        return
                      }
                    }
                    toast('Product saved successfully')
                    const merged = extractZohoItemFromItemResponse(resData)
                    if (merged) {
                      setItems((prev) =>
                        prev.map((it) => (resolveItemId(it) === id ? { ...it, ...merged } : it))
                      )
                    }
                    setEditingItem(null)
                    void refreshAfterMutation()
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Failed', 'error')
                  } finally {
                    setSavingProduct(false)
                  }
                }}
              >
                {savingProduct ? 'Saving…' : 'Save to Zoho'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddProductModal ? (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !creatingProduct) setShowAddProductModal(false)
          }}
        >
          <div className="admin-modal admin-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h3 className="admin-modal__title">Add Product</h3>
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
            </div>
            <div
              className={`admin-dropzone admin-dropzone--add${isDraggingNewImage ? ' is-dragging' : ''}`}
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
                  toast('Please drop an image file', 'info')
                  return
                }
                setNewProductImage(file)
              }}
            >
              <div className="admin-dropzone__inner">
                <UploadIcon />
                <p className="admin-dropzone__title">Drag and drop product image</p>
                <p className="admin-dropzone__meta">Supported: JPEG, PNG, GIF, WebP.</p>
                <label className="admin-file-label admin-file-label--block admin-file-label--cta">
                  <span className="admin-file-label__button">Select files</span>
                  <span className="admin-file-label__text">{newProductImage ? newProductImage.name : 'No file selected'}</span>
                </label>
                <input
                  ref={newProductImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="admin-file-input"
                  onChange={(e) => setNewProductImage(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="admin-modal__footer">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                disabled={creatingProduct}
                onClick={() => setShowAddProductModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="admin-btn admin-btn-inline" disabled={creatingProduct} onClick={() => void createProduct()}>
                {creatingProduct ? 'Creating…' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}