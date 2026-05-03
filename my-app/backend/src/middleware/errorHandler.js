import axios from 'axios'
import multer from 'multer'
import { ZodError } from 'zod'

export function errorHandler(error, _req, res, _next) {
  if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Invalid request payload',
      errors: error.flatten().fieldErrors
    })
  }

  if (error instanceof multer.MulterError) {
    const msg =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Image too large (max 6 MB)'
        : error.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file field (use field name: image)'
          : error.message
    return res.status(400).json({ message: msg })
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
