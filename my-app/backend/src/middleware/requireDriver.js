import { verifyDriverToken } from '../services/jwtService.js'

export function requireDriver(req, _res, next) {
  try {
    const auth = req.headers.authorization || ''
    if (!auth.toLowerCase().startsWith('bearer ')) {
      const err = new Error('Missing bearer token')
      err.statusCode = 401
      throw err
    }
    const token = auth.slice(7)
    const payload = verifyDriverToken(token)
    req.driver = { id: payload.sub || payload.email, email: payload.email }
    next()
  } catch (error) {
    next(error)
  }
}
