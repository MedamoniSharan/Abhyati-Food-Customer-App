import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { appendAdminAudit } from '../services/adminAuditService.js'
import { requireDriver } from '../middleware/requireDriver.js'
import { loginDriverUser } from '../services/driverStore.js'
import {
  getAssignmentById,
  listAssignmentsForDriver,
  updateAssignment
} from '../services/deliveryAssignmentStore.js'
import { signDriverToken } from '../services/jwtService.js'
import { uploadInvoiceAttachment } from '../services/zohoBooksService.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const deliveryAuthRoutes = Router()

const assignmentStatusSchema = z.object({
  status: z.enum(['accepted', 'in_transit', 'delivered'])
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
})

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

deliveryAuthRoutes.use(requireDriver)

deliveryAuthRoutes.get('/assignments', (req, res) => {
  const assignments = listAssignmentsForDriver(req.driver.email)
  res.json({ assignments })
})

deliveryAuthRoutes.post('/assignments/:id/accept', (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const row = getAssignmentById(id)
    if (!row) {
      const err = new Error('Assignment not found')
      err.statusCode = 404
      throw err
    }
    if (row.driverEmail !== req.driver.email) {
      const err = new Error('Not allowed')
      err.statusCode = 403
      throw err
    }
    const updated = updateAssignment(id, {
      status: 'accepted',
      acceptedAt: new Date().toISOString()
    })
    res.json({ message: 'Assignment accepted', assignment: updated })
  } catch (error) {
    next(error)
  }
})

deliveryAuthRoutes.patch('/assignments/:id/status', (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const row = getAssignmentById(id)
    if (!row) {
      const err = new Error('Assignment not found')
      err.statusCode = 404
      throw err
    }
    if (row.driverEmail !== req.driver.email) {
      const err = new Error('Not allowed')
      err.statusCode = 403
      throw err
    }
    const input = assignmentStatusSchema.parse(req.body)
    const updated = updateAssignment(id, {
      status: input.status,
      ...(input.status === 'delivered' ? { deliveredAt: new Date().toISOString() } : {})
    })
    res.json({ message: 'Status updated', assignment: updated })
  } catch (error) {
    next(error)
  }
})

deliveryAuthRoutes.post('/assignments/:id/proof', upload.single('photo'), async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const row = getAssignmentById(id)
    if (!row) {
      const err = new Error('Assignment not found')
      err.statusCode = 404
      throw err
    }
    if (row.driverEmail !== req.driver.email) {
      const err = new Error('Not allowed')
      err.statusCode = 403
      throw err
    }
    const file = req.file
    if (!file) {
      const err = new Error('Missing proof image')
      err.statusCode = 400
      throw err
    }
    const recipientName = typeof req.body?.recipient_name === 'string' ? req.body.recipient_name.trim() : ''
    const uploaded = await uploadInvoiceAttachment(row.invoiceId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname || 'signed-invoice.jpg'
    })
    const updated = updateAssignment(id, {
      status: 'delivered',
      deliveredAt: new Date().toISOString(),
      proof: {
        recipientName,
        fileName: file.originalname || 'signed-invoice.jpg',
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
        zoho: uploaded
      }
    })
    appendAdminAudit({
      action: 'driver_uploaded_invoice_proof',
      meta: { assignmentId: id, invoiceId: row.invoiceId, driverEmail: req.driver.email }
    })
    res.json({ message: 'Proof uploaded to Zoho invoice', assignment: updated })
  } catch (error) {
    next(error)
  }
})
