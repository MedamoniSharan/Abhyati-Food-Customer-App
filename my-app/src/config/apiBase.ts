/**
 * Production backend URL (direct). Set VITE_API_BASE_URL in .env.local to use a local API while developing.
 */
export const PUBLIC_API_BASE_URL = 'https://abhyati-food-customer-app.onrender.com'

function trimBase(url: string) {
  return url.trim().replace(/\/$/, '')
}

export function getApiBaseCandidates(): string[] {
  const fromEnv = trimBase(import.meta.env.VITE_API_BASE_URL || '')
  const list = fromEnv
    ? [fromEnv, PUBLIC_API_BASE_URL, 'http://localhost:3001', 'http://localhost:4000']
    : [PUBLIC_API_BASE_URL, 'http://localhost:3001', 'http://localhost:4000']
  return list.filter((value, index, arr) => value && arr.indexOf(value) === index)
}
