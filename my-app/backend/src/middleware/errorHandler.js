import axios from 'axios'
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'
import { ZodError } from 'zod'

export function errorHandler(error, _req, res, _next) {
  if (error instanceof JsonWebTokenError || error instanceof TokenExpiredError) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Invalid request payload',
      errors: error.flatten().fieldErrors
    })
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 500
    return res.status(status).json({
      message: 'Zoho API request failed',
      zoho: error.response?.data || error.message
    })
  }

  if (typeof error?.statusCode === 'number') {
    return res.status(error.statusCode).json({
      message: error.message || 'Request failed'
    })
  }

  return res.status(500).json({
    message: error.message || 'Internal server error'
  })
}
