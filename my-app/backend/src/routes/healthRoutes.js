import { Router } from 'express'

export const healthRoutes = Router()

healthRoutes.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'abhyati-food-backend',
    timestamp: new Date().toISOString()
  })
})
