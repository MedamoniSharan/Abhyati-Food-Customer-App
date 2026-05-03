import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AUTH_DATA_FILE = join(__dirname, '..', '..', 'data', 'auth-users.json')

const usersByEmail = new Map()

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hashed = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hashed}`
}

function verifyPassword(password, storedHash) {
  const [salt, originalHash] = storedHash.split(':')
  if (!salt || !originalHash) return false
  const currentHash = scryptSync(password, salt, 64).toString('hex')
  return timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(currentHash, 'hex'))
}

function toPublicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email
  }
}

function loadPersistedUsers() {
  if (!existsSync(AUTH_DATA_FILE)) return
  try {
    const raw = readFileSync(AUTH_DATA_FILE, 'utf8')
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows)) return
    for (const row of rows) {
      if (!row?.email || !row?.passwordHash) continue
      const email = normalizeEmail(row.email)
      usersByEmail.set(email, {
        id: String(row.id),
        fullName: String(row.fullName || 'Customer'),
        email,
        passwordHash: String(row.passwordHash),
        createdAt: row.createdAt || new Date().toISOString()
      })
    }
    console.log(`[auth] loaded ${usersByEmail.size} user(s) from disk`)
  } catch (err) {
    console.error('[auth] failed to load persisted users', err)
  }
}

function persistUsers() {
  try {
    const dir = dirname(AUTH_DATA_FILE)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const rows = [...usersByEmail.values()].map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      passwordHash: u.passwordHash,
      createdAt: u.createdAt
    }))
    writeFileSync(AUTH_DATA_FILE, JSON.stringify(rows), 'utf8')
  } catch (err) {
    console.error('[auth] failed to persist users', err)
  }
}

loadPersistedUsers()

export function seedDefaultUser() {
  const email = normalizeEmail(env.AUTH_DEFAULT_CUSTOMER_EMAIL)
  if (usersByEmail.has(email)) return

  const user = {
    id: `cust_${Date.now()}`,
    fullName: 'Default Customer',
    email,
    passwordHash: hashPassword(env.AUTH_DEFAULT_CUSTOMER_PASSWORD),
    createdAt: new Date().toISOString()
  }

  usersByEmail.set(email, user)
  persistUsers()
}

export function createCustomerUser({ fullName, email, password }) {
  const normalizedEmail = normalizeEmail(email)
  if (usersByEmail.has(normalizedEmail)) {
    const error = new Error('Email already exists')
    error.statusCode = 409
    throw error
  }

  const user = {
    id: `cust_${Date.now()}_${Math.round(Math.random() * 1000)}`,
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  }

  usersByEmail.set(normalizedEmail, user)
  persistUsers()
  return toPublicUser(user)
}

export function loginCustomerUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email)
  const user = usersByEmail.get(normalizedEmail)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const error = new Error('Invalid email or password')
    error.statusCode = 401
    throw error
  }

  return toPublicUser(user)
}

export function listCustomerUsers() {
  return [...usersByEmail.values()].map(toPublicUser)
}

export function getCustomerUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  const user = usersByEmail.get(normalizedEmail)
  return user ? toPublicUser(user) : null
}

export function deleteCustomerUserByEmail(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!usersByEmail.has(normalizedEmail)) return false
  usersByEmail.delete(normalizedEmail)
  persistUsers()
  return true
}
