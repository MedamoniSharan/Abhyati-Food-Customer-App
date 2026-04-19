import cors from 'cors'
import express from 'express'
import { authRoutes } from './routes/authRoutes.js'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { healthRoutes } from './routes/healthRoutes.js'
import { itemImageRoutes } from './routes/itemImageRoutes.js'
import { zohoRoutes } from './routes/zohoRoutes.js'
import { seedDefaultUser } from './services/authStore.js'

const app = express()

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true)
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`))
    }
  })
)

app.use(express.json({ limit: '1mb' }))

app.use('/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/items', itemImageRoutes)
app.use('/api/zoho', zohoRoutes)

app.use(errorHandler)

seedDefaultUser()

app.listen(env.PORT, () => {
  console.log(`Backend running on http://localhost:${env.PORT}`)
  console.log(`Zoho region: ${env.ZOHO_REGION}`)
  console.log(`Default customer login: ${env.AUTH_DEFAULT_CUSTOMER_EMAIL}`)
})
