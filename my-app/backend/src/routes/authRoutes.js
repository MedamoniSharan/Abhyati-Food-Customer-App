import { Router } from 'express'
import { z } from 'zod'
import { createCustomerUser, loginCustomerUser } from '../services/authStore.js'

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required')
})

export const authRoutes = Router()

authRoutes.post('/signup', (req, res, next) => {
  try {
    const input = signupSchema.parse(req.body)
    const user = createCustomerUser(input)
    res.status(201).json({
      message: 'Account created successfully',
      user
    })
  } catch (error) {
    next(error)
  }
})

authRoutes.post('/login', (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const user = loginCustomerUser(input)
    res.json({
      message: 'Login successful',
      user
    })
  } catch (error) {
    next(error)
  }
})
