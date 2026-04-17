import axios from 'axios'
import { ZodError } from 'zod'

export function errorHandler(error, _req, res, _next) {
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

  return res.status(500).json({
    message: error.message || 'Internal server error'
  })
}
