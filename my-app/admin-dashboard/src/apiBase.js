/** Production API base (direct). Override with VITE_API_BASE_URL for local backend. */
export const PUBLIC_API_BASE_URL = 'https://abhyati-food-customer-app.onrender.com'

export function getDefaultApiBase() {
  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  return fromEnv || PUBLIC_API_BASE_URL
}
