import { getCustomerUserByEmail } from '../services/authStore.js'
import { verifyCustomerToken } from '../services/jwtService.js'

export function requireCustomer(req, res, next) {
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
    req.customer = user
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired customer session' })
  }
}
