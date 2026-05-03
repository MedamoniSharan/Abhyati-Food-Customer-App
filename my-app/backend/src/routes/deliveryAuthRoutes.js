import { Router } from 'express'
import { z } from 'zod'
import { appendAdminAudit } from '../services/adminAuditService.js'
import { loginDriverUser } from '../services/driverStore.js'
import { signDriverToken } from '../services/jwtService.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const deliveryAuthRoutes = Router()

deliveryAuthRoutes.post('/login', (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const { public: user, id } = loginDriverUser(input)
    const token = signDriverToken(id, user.email)
    res.json({
      message: 'Login successful',
      user,
      token
    })
  } catch (error) {
    if (error.statusCode === 401) {
      appendAdminAudit({
        action: 'driver_login_failed',
        meta: { email: req.body?.email }
      })
    }
    next(error)
  }
})
