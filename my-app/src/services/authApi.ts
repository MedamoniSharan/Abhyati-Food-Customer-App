export type AuthUser = {
  id: string
  fullName: string
  email: string
}

const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
const API_BASE_URL_CANDIDATES = [configuredApiBaseUrl, 'http://localhost:3001', 'http://localhost:4000'].filter(
  (value, index, arr) => value && arr.indexOf(value) === index,
)

type AuthApiResponse = {
  message: string
  user: AuthUser
}

async function authRequest(path: string, payload: Record<string, string>): Promise<AuthApiResponse> {
  let lastError: unknown = null

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = (await response.json()) as { message?: string }
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`)
      }
      return data as AuthApiResponse
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to reach auth API')
}

export async function loginCustomer(payload: { email: string; password: string }) {
  return authRequest('/api/auth/login', payload)
}

export async function signupCustomer(payload: { fullName: string; email: string; password: string }) {
  return authRequest('/api/auth/signup', payload)
}
