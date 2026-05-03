import { Router } from 'express'
import { z } from 'zod'
import { getCustomerUserByEmail, loginCustomerUser } from '../services/authStore.js'
import { signCustomerToken, verifyCustomerToken } from '../services/jwtService.js'

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required')
})

export const authRoutes = Router()

authRoutes.post('/signup', (_req, res) => {
  res.status(403).json({
    message: 'Self-service signup is disabled. Ask an administrator to create your account.'
  })
})

authRoutes.post('/login', (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const user = loginCustomerUser(input)
    const token = signCustomerToken(user.email)
    res.json({
      message: 'Login successful',
      user,
      token
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.get('/me', (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    const m = header.match(/^Bearer\s+(.+)$/i)
    if (!m) {
      return res.status(401).json({ message: 'Missing Authorization Bearer token' })
    }
    const payload = verifyCustomerToken(m[1].trim())
    const user = getCustomerUserByEmail(payload.email)
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists' })
    }
    res.json({ user })
  } catch (error) {
    next(error)
  }
})
