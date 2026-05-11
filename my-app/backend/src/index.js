import cors from 'cors'
import express from 'express'
import { authRoutes } from './routes/authRoutes.js'
import { adminRoutes } from './routes/adminRoutes.js'
import { customerRoutes } from './routes/customerRoutes.js'
import { deliveryAuthRoutes } from './routes/deliveryAuthRoutes.js'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requireAdmin } from './middleware/requireAdmin.js'
import { healthRoutes } from './routes/healthRoutes.js'
import { itemImageRoutes } from './routes/itemImageRoutes.js'
import { zohoRoutes } from './routes/zohoRoutes.js'
import { seedDefaultUser } from './services/authStore.js'

const app = express()

// Capacitor / WebView clients send varied origins (e.g. capacitor://localhost); allow all for this API.
app.use(cors({ origin: '*' }))

app.use(express.json({ limit: '1mb' }))

app.use('/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/customer', customerRoutes)
app.use('/api/delivery', deliveryAuthRoutes)
app.use('/api/items', itemImageRoutes)
app.use('/api/zoho', requireAdmin, zohoRoutes)

app.use(errorHandler)

seedDefaultUser()

app.listen(env.PORT, () => {
  console.log(`Backend running on http://localhost:${env.PORT}`)
  console.log(`Zoho region: ${env.ZOHO_REGION}`)
  console.log(`Default customer login: ${env.AUTH_DEFAULT_CUSTOMER_EMAIL}`)
})
