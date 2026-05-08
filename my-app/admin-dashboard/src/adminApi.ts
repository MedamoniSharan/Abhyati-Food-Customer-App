import { apiUrl } from './apiBase'

const TOKEN_KEY = 'abhyati_admin_jwt'

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function parseJsonSafe(text: string): { ok: true; data: unknown } | { ok: false; raw: string } {
  const t = text.trim()
  if (!t) return { ok: true, data: {} }
  try {
    return { ok: true, data: JSON.parse(t) as unknown }
  } catch {
    return { ok: false, raw: t }
  }
}

export async function adminLogin(email: string, password: string): Promise<string> {
  const res = await fetch(apiUrl('/api/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const text = await res.text()
  const parsed = parseJsonSafe(text)
  if (!parsed.ok) {
    throw new Error(
      res.ok
        ? 'Invalid JSON from server'
        : `Login failed (${res.status}). ${parsed.raw.slice(0, 120)}`
    )
  }
  const data = parsed.data as { message?: string; token?: string }
  if (!res.ok) throw new Error(data.message || `Login failed (${res.status})`)
  if (!data.token) throw new Error('No token in response')
  setAdminToken(data.token)
  return data.token
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAdminToken()
  const headers = new Headers(init.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(apiUrl(path), { ...init, headers })
  const text = await res.text()
  const parsed = parseJsonSafe(text)
  if (!parsed.ok) {
    throw new Error(
      res.ok ? 'Invalid JSON from server' : `Request failed (${res.status}). ${parsed.raw.slice(0, 160)}`
    )
  }
  const data = parsed.data as Record<string, unknown>
  if (!res.ok) {
    const msg =
      typeof data.message === 'string' ? data.message : `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

/** POST multipart to `/api/admin/items/:id/image` (field name: `image`). */
export async function adminUploadItemImage(itemId: string, file: File): Promise<void> {
  const token = getAdminToken()
  const fd = new FormData()
  fd.append('image', file)
  const headers = new Headers()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(apiUrl(`/api/admin/items/${encodeURIComponent(itemId)}/image`), {
    method: 'POST',
    headers,
    body: fd
  })
  const text = await res.text()
  const parsed = parseJsonSafe(text)
  if (!parsed.ok) {
    throw new Error(
      res.ok ? 'Invalid JSON from server' : `Upload failed (${res.status}). ${parsed.raw.slice(0, 160)}`
    )
  }
  const data = parsed.data as Record<string, unknown>
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : `Upload failed (${res.status})`
    throw new Error(msg)
  }
}
