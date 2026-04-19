import type { AuthUser } from '../services/authApi'
import type { AppRole } from '../types/auth'

const STORAGE_KEY = 'abhyati_food_signed_in'
const ROLE_KEY = 'abhyati_food_role'
const USER_KEY = 'abhyati_food_user_json'

export function readSignedIn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function readAppRole(): AppRole {
  try {
    if (localStorage.getItem(STORAGE_KEY) !== '1') return 'customer'
    const r = localStorage.getItem(ROLE_KEY)
    return r === 'driver' ? 'driver' : 'customer'
  } catch {
    return 'customer'
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

export function writeSignedIn(role: AppRole = 'customer', user?: AuthUser): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
    localStorage.setItem(ROLE_KEY, role)
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    }
  } catch {
    /* private mode / quota */
  }
}

export function clearSignedIn(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}
