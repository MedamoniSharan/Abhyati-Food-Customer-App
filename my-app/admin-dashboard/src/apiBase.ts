/**
 * Backend origin for API calls.
 * - Set `VITE_API_BASE_URL` in `.env` / `.env.local` to your deployed API, e.g.
 *   `https://abhyati-food-customer-app.onrender.com` (no trailing slash).
 * - Leave unset in dev to use same-origin `/api/...` and Vite's proxy to a local backend.
 */
export function apiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/$/, '').trim()
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = apiBase()
  if (!base) return p
  return `${base}${p}`
}
