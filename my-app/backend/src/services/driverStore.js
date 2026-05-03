import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRIVER_DATA_FILE = join(__dirname, '..', '..', 'data', 'driver-users.json')

const driversByEmail = new Map()

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

function toPublicDriver(d) {
  return {
    id: d.id,
    fullName: d.fullName,
    email: d.email,
    zohoContactId: d.zohoContactId,
    disabled: Boolean(d.disabled),
    createdAt: d.createdAt
  }
}

function loadDrivers() {
  if (!existsSync(DRIVER_DATA_FILE)) return
  try {
    const raw = readFileSync(DRIVER_DATA_FILE, 'utf8')
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows)) return
    for (const row of rows) {
      if (!row?.email || !row?.passwordHash || !row?.zohoContactId) continue
      const email = normalizeEmail(row.email)
      driversByEmail.set(email, {
        id: String(row.id),
        fullName: String(row.fullName || 'Driver'),
        email,
        passwordHash: String(row.passwordHash),
        zohoContactId: String(row.zohoContactId),
        disabled: Boolean(row.disabled),
        createdAt: row.createdAt || new Date().toISOString()
      })
    }
    console.log(`[drivers] loaded ${driversByEmail.size} driver(s) from disk`)
  } catch (err) {
    console.error('[drivers] failed to load', err)
  }
}

function persistDrivers() {
  try {
    const dir = dirname(DRIVER_DATA_FILE)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const rows = [...driversByEmail.values()].map((d) => ({
      id: d.id,
      fullName: d.fullName,
      email: d.email,
      passwordHash: d.passwordHash,
      zohoContactId: d.zohoContactId,
      disabled: d.disabled,
      createdAt: d.createdAt
    }))
    writeFileSync(DRIVER_DATA_FILE, JSON.stringify(rows), 'utf8')
  } catch (err) {
    console.error('[drivers] failed to persist', err)
  }
}

loadDrivers()

export function listDrivers() {
  return [...driversByEmail.values()].map(toPublicDriver)
}

export function createDriverRecord({ fullName, email, password, zohoContactId }) {
  const normalizedEmail = normalizeEmail(email)
  if (driversByEmail.has(normalizedEmail)) {
    const error = new Error('Driver email already exists')
    error.statusCode = 409
    throw error
  }
  const driver = {
    id: `drv_${Date.now()}_${Math.round(Math.random() * 1000)}`,
    fullName: fullName.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    zohoContactId,
    disabled: false,
    createdAt: new Date().toISOString()
  }
  driversByEmail.set(normalizedEmail, driver)
  persistDrivers()
  return toPublicDriver(driver)
}

export function loginDriverUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email)
  const driver = driversByEmail.get(normalizedEmail)
  if (!driver || driver.disabled || !verifyPassword(password, driver.passwordHash)) {
    const error = new Error('Invalid email or password')
    error.statusCode = 401
    throw error
  }
  return { public: toPublicDriver(driver), id: driver.id }
}

export function getDriverByEmail(email) {
  return driversByEmail.get(normalizeEmail(email)) || null
}

export function setDriverDisabled(email, disabled) {
  const d = driversByEmail.get(normalizeEmail(email))
  if (!d) return false
  d.disabled = disabled
  persistDrivers()
  return true
}

export function deleteDriverRecord(email) {
  const normalizedEmail = normalizeEmail(email)
  if (!driversByEmail.has(normalizedEmail)) return false
  driversByEmail.delete(normalizedEmail)
  persistDrivers()
  return true
}
