import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'

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
