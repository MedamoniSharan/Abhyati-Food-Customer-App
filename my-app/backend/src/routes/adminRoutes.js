import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { env } from '../config/env.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { appendAdminAudit } from '../services/adminAuditService.js'
import {
  createCustomerUser,
  deleteCustomerUserByEmail,
  listCustomerUsers,
  updateCustomerUserByEmail
} from '../services/authStore.js'
import {
  createDriverRecord,
  deleteDriverRecord,
  getDriverByEmail,
  listDrivers,
  setDriverDisabled
} from '../services/driverStore.js'
import {
  createCustomer,
  createModule,
  createSalesOrder,
  deleteModule,
  getModuleById,
  listModule,
  updateModule
} from '../services/zohoBooksService.js'
import { signAdminToken } from '../services/jwtService.js'
import { mapDeliveryStopFromSalesOrder } from '../services/zohoDeliveryMap.js'
import { uploadItemImageToZoho } from '../services/zohoItemImageService.js'

export const adminRoutes = Router()

const itemImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error('Only JPEG, PNG, GIF, and WebP images are allowed')
      err.statusCode = 400
      cb(err, false)
    }
  }
})

function handleItemImageUpload(req, res, next) {
  itemImageUpload.single('image')(req, res, (err) => {
    if (err) return next(err)
    if (!req.file) {
      const e = new Error('Missing image file (multipart field name: image)')
      e.statusCode = 400
      return next(e)
    }
    next()
  })
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const createCustomerBody = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  mobile: z.string().optional()
})

const updateCustomerBody = z.object({
  fullName: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  mobile: z.string().optional()
})

const createDriverBody = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})

const emailParam = z.object({
  email: z.string().email()
})

const salesOrderLineSchema = z.object({
  item_id: z.string().min(1),
  quantity: z.number().positive(),
  rate: z.number().nonnegative()
})

const createSalesOrderBody = z.object({
  customer_id: z.string().min(1),
  salesorder_number: z.string().optional(),
  reference_number: z.string().optional(),
  line_items: z.array(salesOrderLineSchema).min(1)
})

const simpleItemCreateSchema = z.object({
  name: z.string().min(1),
  rate: z.coerce.number().nonnegative(),
  sku: z.string().optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  product_type: z.enum(['goods', 'service', 'digital_service']).default('goods')
})

adminRoutes.post('/login', (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body)
    const adminEmail = env.ADMIN_EMAIL.trim().toLowerCase()
    if (input.email.trim().toLowerCase() !== adminEmail || input.password !== env.ADMIN_PASSWORD) {
      const err = new Error('Invalid admin email or password')
      err.statusCode = 401
      throw err
    }
    const token = signAdminToken()
    appendAdminAudit({ action: 'admin_login' })
    res.json({ message: 'Login successful', token })
  } catch (error) {
    next(error)
  }
})

adminRoutes.use(requireAdmin)

adminRoutes.get('/overview', async (_req, res, next) => {
  try {
    const [invData, soData] = await Promise.all([
      listModule('/invoices', { per_page: 100 }),
      listModule('/salesorders', { per_page: 100 })
    ])
    const invoices = Array.isArray(invData.invoices) ? invData.invoices : []
    const salesorders = Array.isArray(soData.salesorders) ? soData.salesorders : []
    const revenue = invoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0)
    res.json({
      invoiceCount: invoices.length,
      salesOrderCount: salesorders.length,
      appCustomerCount: listCustomerUsers().length,
      revenueApprox: revenue,
      currency: env.ZOHO_DEFAULT_CURRENCY_CODE
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/customers', (_req, res) => {
  res.json({ customers: listCustomerUsers() })
})

adminRoutes.post('/customers', async (req, res, next) => {
  let contactId
  try {
    const input = createCustomerBody.parse(req.body)
    const zoho = await createCustomer({
      contact_name: input.fullName,
      email: input.email,
      mobile: input.mobile
    })
    contactId = zoho?.contact?.contact_id
    if (!contactId) {
      const err = new Error('Zoho did not return a customer contact id')
      err.statusCode = 502
      throw err
    }
    try {
      const user = createCustomerUser({
        fullName: input.fullName,
        email: input.email,
        password: input.password
      })
      appendAdminAudit({
        action: 'admin_create_customer',
        meta: { email: user.email, zohoContactId: contactId }
      })
      res.status(201).json({ message: 'Customer created', user, zoho_contact_id: contactId })
    } catch (error) {
      try {
        await deleteOrDeactivateZohoContact(contactId)
      } catch {
        /* best-effort rollback */
      }
      throw error
    }
  } catch (error) {
    next(error)
  }
})

async function deleteOrDeactivateZohoContact(contactId) {
  try {
    await deleteModule('/contacts', contactId)
    return { mode: 'deleted' }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'delete failed'
    try {
      await updateModule('/contacts', contactId, { contact_id: contactId, is_active: false })
      return { mode: 'deactivated', zohoMessage: String(msg) }
    } catch (err2) {
      const err3 = new Error(`Could not delete or deactivate Zoho contact: ${msg}`)
      err3.statusCode = 502
      err3.cause = err2
      throw err3
    }
  }
}

async function findCustomerContactIdByEmail(email) {
  const data = await listModule('/contacts', { email: email.trim().toLowerCase(), per_page: 5 })
  const list = Array.isArray(data.contacts) ? data.contacts : []
  const match = list.find((c) => (c.email || '').trim().toLowerCase() === email.trim().toLowerCase())
  return match?.contact_id || null
}

adminRoutes.delete('/customers/:email', async (req, res, next) => {
  try {
    const { email } = emailParam.parse({ email: decodeURIComponent(req.params.email) })
    const contactId = await findCustomerContactIdByEmail(email)
    let zohoResult = { mode: 'skipped', reason: 'No Zoho contact for this email' }
    if (contactId) {
      zohoResult = await deleteOrDeactivateZohoContact(contactId)
    }
    const removedLocal = deleteCustomerUserByEmail(email)
    appendAdminAudit({
      action: 'admin_delete_customer',
      meta: { email, zohoResult, removedLocal }
    })
    res.json({
      message: removedLocal
        ? 'Customer removed from app login' + (contactId ? `; Zoho: ${zohoResult.mode}` : '')
        : 'No app login found for this email',
      zoho: zohoResult,
      removedLocal
    })
  } catch (error) {
    next(error)
  }
})

adminRoutes.put('/customers/:email', async (req, res, next) => {
  try {
    const { email } = emailParam.parse({ email: decodeURIComponent(req.params.email) })
    const body = updateCustomerBody.parse(req.body)

    const contactId = await findCustomerContactIdByEmail(email)
    let zohoUpdated = false
    if (contactId) {
      const zohoPayload = {
        contact_id: contactId,
        ...(body.fullName ? { contact_name: body.fullName } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.mobile !== undefined ? { mobile: body.mobile } : {})
      }
      if (Object.keys(zohoPayload).length > 1) {
        await updateModule('/contacts', contactId, zohoPayload)
        zohoUpdated = true
      }
    }

    const user = updateCustomerUserByEmail(email, {
      fullName: body.fullName,
      email: body.email,
      password: body.password
    })
    if (!user) {
      const err = new Error('Customer not found')
      err.statusCode = 404
      throw err
    }

    appendAdminAudit({
      action: 'admin_update_customer',
      meta: { email, nextEmail: user.email, zohoUpdated }
    })
    res.json({ message: 'Customer updated', user, zohoUpdated })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/drivers', (_req, res) => {
  res.json({ drivers: listDrivers() })
})

adminRoutes.post('/drivers', async (req, res, next) => {
  try {
    const input = createDriverBody.parse(req.body)
    const zohoPayload = {
      contact_name: input.fullName,
      contact_type: env.DRIVER_ZOHO_CONTACT_TYPE,
      email: input.email
    }
    const zoho = await createModule('/contacts', zohoPayload)
    const contact = zoho.contact || zoho
    const contactId = contact?.contact_id
    if (!contactId) {
      const err = new Error('Zoho did not return a driver contact id')
      err.statusCode = 502
      throw err
    }
    const driver = createDriverRecord({
      fullName: input.fullName,
      email: input.email,
      password: input.password,
      zohoContactId: contactId
    })
    appendAdminAudit({
      action: 'admin_create_driver',
      meta: { email: driver.email, zohoContactId: contactId }
    })
    res.status(201).json({ message: 'Driver created', driver })
  } catch (error) {
    next(error)
  }
})

adminRoutes.patch('/drivers/:email', (req, res, next) => {
  try {
    const { email } = emailParam.parse({ email: decodeURIComponent(req.params.email) })
    const body = z.object({ disabled: z.boolean() }).parse(req.body)
    const ok = setDriverDisabled(email, body.disabled)
    if (!ok) {
      const err = new Error('Driver not found')
      err.statusCode = 404
      throw err
    }
    appendAdminAudit({ action: 'admin_patch_driver', meta: { email, disabled: body.disabled } })
    res.json({ message: 'Driver updated' })
  } catch (error) {
    next(error)
  }
})

adminRoutes.delete('/drivers/:email', async (req, res, next) => {
  try {
    const { email } = emailParam.parse({ email: decodeURIComponent(req.params.email) })
    const driver = getDriverByEmail(email)
    if (!driver) {
      const err = new Error('Driver not found')
      err.statusCode = 404
      throw err
    }
    let zohoResult
    try {
      zohoResult = await deleteOrDeactivateZohoContact(driver.zohoContactId)
    } catch (e) {
      zohoResult = { mode: 'error', message: String(e?.message) }
    }
    deleteDriverRecord(email)
    appendAdminAudit({
      action: 'admin_delete_driver',
      meta: { email, zohoContactId: driver.zohoContactId, zohoResult }
    })
    res.json({ message: 'Driver removed from app', zoho: zohoResult })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/deliveries', async (req, res, next) => {
  try {
    const query = z.object({}).passthrough().parse(req.query)
    const data = await listModule('/salesorders', { per_page: 200, ...query })
    const orders = Array.isArray(data.salesorders) ? data.salesorders : []
    const stops = orders.map((order, index) => mapDeliveryStopFromSalesOrder(order, index))
    res.json({ deliveries: stops, salesorders: orders })
  } catch (error) {
    next(error)
  }
})

/** Zoho Books customers (contacts) — for sales order create + delivery address in Zoho */
adminRoutes.get('/zoho/customer-contacts', async (req, res, next) => {
  try {
    const query = z.object({}).passthrough().parse(req.query)
    const data = await listModule('/contacts', { contact_type: 'customer', per_page: 200, ...query })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/sales-orders', async (req, res, next) => {
  try {
    const query = z.object({}).passthrough().parse(req.query)
    const data = await listModule('/salesorders', { per_page: 200, ...query })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/sales-orders/:id', async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const query = z.object({}).passthrough().parse(req.query)
    const data = await getModuleById('/salesorders', id, query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.post('/sales-orders', async (req, res, next) => {
  try {
    const input = createSalesOrderBody.parse(req.body)
    const data = await createSalesOrder({
      customer_id: input.customer_id,
      currency_code: env.ZOHO_DEFAULT_CURRENCY_CODE,
      ...(input.salesorder_number ? { salesorder_number: input.salesorder_number } : {}),
      ...(input.reference_number ? { reference_number: input.reference_number } : {}),
      line_items: input.line_items.map((l) => ({
        item_id: l.item_id,
        quantity: l.quantity,
        rate: l.rate
      }))
    })
    appendAdminAudit({
      action: 'admin_create_sales_order',
      meta: { customer_id: input.customer_id, reference_number: input.reference_number }
    })
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.put('/sales-orders/:id', async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const body = z.record(z.unknown()).parse(req.body)
    const data = await updateModule('/salesorders', id, body)
    appendAdminAudit({ action: 'admin_update_sales_order', meta: { id } })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/items', async (req, res, next) => {
  try {
    const query = z.object({}).passthrough().parse(req.query)
    const data = await listModule('/items', query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.post('/items', async (req, res, next) => {
  try {
    const raw = req.body
    let payload
    if (raw && typeof raw === 'object' && typeof raw.name === 'string' && raw.name.trim() && 'rate' in raw) {
      const parsed = simpleItemCreateSchema.parse(raw)
      payload = {
        name: parsed.name.trim(),
        rate: parsed.rate,
        product_type: parsed.product_type,
        unit: parsed.unit?.trim() || 'unit',
        ...(parsed.sku?.trim() ? { sku: parsed.sku.trim() } : {}),
        ...(parsed.description?.trim() ? { description: parsed.description.trim() } : {})
      }
    } else {
      payload = z.record(z.unknown()).parse(raw)
    }
    const data = await createModule('/items', payload)
    appendAdminAudit({ action: 'admin_create_item', meta: { item: data?.item?.item_id } })
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.post('/items/:id/image', handleItemImageUpload, async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const f = req.file
    await uploadItemImageToZoho(id, {
      buffer: f.buffer,
      mimetype: f.mimetype,
      originalname: f.originalname || 'image.jpg'
    })
    appendAdminAudit({ action: 'admin_upload_item_image', meta: { id } })
    res.json({ message: 'Image uploaded', item_id: id })
  } catch (error) {
    next(error)
  }
})

adminRoutes.put('/items/:id', async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const body = z.record(z.unknown()).parse(req.body)
    const data = await updateModule('/items', id, body)
    appendAdminAudit({ action: 'admin_update_item', meta: { id } })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.delete('/items/:id', async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const data = await deleteModule('/items', id)
    appendAdminAudit({ action: 'admin_delete_item', meta: { id } })
    res.json(data)
  } catch (error) {
    next(error)
  }
})
