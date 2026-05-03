import type { AuthUser } from '../services/authApi'

const STORAGE_KEY = 'abhyati_delivery_signed_in'
const USER_KEY = 'abhyati_delivery_user_json'

export function readSignedIn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function readSessionUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as AuthUser
    if (u && typeof u.email === 'string' && typeof u.fullName === 'string' && typeof u.id === 'string') return u
    return null
  } catch {
    return null
  }
}

export function writeSignedIn(user: AuthUser): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    /* private mode / quota */
  }
}

export function clearSignedIn(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}
