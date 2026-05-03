import { getApiBaseCandidates, logApiCandidatesOnce } from '../config/api'
import type { AuthUser } from './authApi'

const API_BASE_URL_CANDIDATES = getApiBaseCandidates()

const FETCH_TIMEOUT_MS = 45_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const t = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(t)
  }
}

export async function loginDriver(payload: { email: string; password: string }): Promise<{
  message: string
  user: AuthUser
  token: string
}> {
  logApiCandidatesOnce(API_BASE_URL_CANDIDATES)
  let lastError: unknown = null

  for (const baseUrl of API_BASE_URL_CANDIDATES) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/api/delivery/login`
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const text = await response.text()
      const data = text ? (JSON.parse(text) as { message?: string; user?: AuthUser; token?: string }) : {}

      if (!response.ok) {
        throw new Error(data.message || `Login failed (${response.status})`)
      }
      if (!data.user || !data.token) {
        throw new Error('Invalid response from server')
      }
      return { message: data.message || 'OK', user: data.user, token: data.token }
    } catch (error) {
      lastError = error
      console.warn('[delivery auth] failed', { baseUrl, error })
    }
  }

  const err = lastError instanceof Error ? lastError : new Error('Unable to reach server')
  throw err
}
