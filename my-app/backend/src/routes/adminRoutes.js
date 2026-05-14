import axios from 'axios'
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
  getInvoiceAttachment,
  getModuleById,
  listModule,
  markZohoItemInactive,
  updateModule
} from '../services/zohoBooksService.js'
import { signAdminToken } from '../services/jwtService.js'
import { mapDeliveryStopFromSalesOrder } from '../services/zohoDeliveryMap.js'
import { uploadItemImageToZoho } from '../services/zohoItemImageService.js'
import { createAssignment, getAssignmentById, listAssignments } from '../services/deliveryAssignmentStore.js'

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

/** Zoho list/detail may expose quantity on the item or under `locations[]`. */
const ZOHO_STOCK_BODY_KEYS = ['stock_on_hand', 'available_stock', 'actual_available_stock', 'opening_stock']

function readZohoItemQuantity(item) {
  if (!item || typeof item !== 'object') return null
  for (const k of ZOHO_STOCK_BODY_KEYS) {
    if (!(k in item)) continue
    const raw = item[k]
    if (raw === '' || raw == null) continue
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  const locs = item.locations
  if (!Array.isArray(locs)) return null
  let fallback = null
  for (const loc of locs) {
    if (!loc || typeof loc !== 'object') continue
    for (const field of ['location_actual_available_stock', 'location_available_stock', 'location_stock_on_hand']) {
      const raw = loc[field]
      if (raw === '' || raw == null) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      if (loc.is_primary === true || loc.is_primary === 'true') return n
      if (fallback === null) fallback = n
    }
  }
  return fallback
}

function extractStockTargetFromBody(body) {
  if (!body || typeof body !== 'object') return null
  for (const k of ZOHO_STOCK_BODY_KEYS) {
    if (!(k in body)) continue
    const raw = body[k]
    if (raw === '' || raw == null) continue
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  return null
}

function stripStockFieldsFromBody(body) {
  const clean = { ...body }
  for (const k of ZOHO_STOCK_BODY_KEYS) delete clean[k]
  return clean
}

/** Zoho refuses hard-delete when an item is referenced on transactions; we fall back to inactive. */
function shouldFallbackItemDeleteToInactive(zohoBody) {
  if (!zohoBody || typeof zohoBody !== 'object') return false
  const msg = String(zohoBody.message || zohoBody.error || '').toLowerCase()
  if (!msg) return false
  return (
    msg.includes('cannot be deleted') ||
    msg.includes('part of a transaction') ||
    msg.includes('part of transaction') ||
    (msg.includes('transaction') && msg.includes('delete')) ||
    (msg.includes('associated') && msg.includes('transaction'))
  )
}

/**
 * Build `locations[]` for a PUT so primary (or first) row gets `targetQty` on hand.
 * Used together with other item fields in **one** PUT — a second PUT with only `locations`
 * can overwrite name/rate on APIs that treat the body as a full replace.
 */
function buildZohoItemLocationsForStock(existingItem, targetQty) {
  const locs = existingItem?.locations
  if (!Array.isArray(locs) || locs.length === 0) return null
  const primaryIdx = locs.findIndex((l) => l && (l.is_primary === true || l.is_primary === 'true'))
  const idx = primaryIdx >= 0 ? primaryIdx : 0
  return locs.map((loc, j) => {
    if (!loc || typeof loc !== 'object') return { location_id: String(loc.location_id) }
    const base = {
      location_id: String(loc.location_id),
      ...(loc.location_name != null && loc.location_name !== '' ? { location_name: loc.location_name } : {}),
      ...(loc.status != null && loc.status !== '' ? { status: loc.status } : {}),
      ...(loc.is_primary != null ? { is_primary: loc.is_primary } : {})
    }
    if (j === idx) {
      return { ...base, location_stock_on_hand: String(targetQty) }
    }
    const keep = loc.location_stock_on_hand
    return keep != null && keep !== '' ? { ...base, location_stock_on_hand: String(keep) } : base
  })
}

/**
 * Zoho often ignores plain `stock_on_hand` on item PUT when warehousing/locations are used.
 * Prefer inventory adjustment (needs ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID); else merge locations into the same item PUT as `cleanBody`.
 */
async function applyZohoItemStockAndMetadata(id, existingItem, targetQty, cleanBody) {
  const accountId = env.ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID
  const current = readZohoItemQuantity(existingItem)

  if (accountId && current !== null) {
    const data = await updateModule('/items', id, cleanBody)
    const delta = targetQty - current
    if (delta !== 0) {
      const today = new Date().toISOString().slice(0, 10)
      await createModule('/inventoryadjustments', {
        date: today,
        reason: `Admin — stock update (item ${id})`,
        adjustment_type: 'quantity',
        line_items: [
          {
            item_id: String(id),
            quantity_adjusted: String(delta),
            adjustment_account_id: accountId
          }
        ]
      })
    }
    return data
  }

  const newLocs = buildZohoItemLocationsForStock(existingItem, targetQty)
  if (newLocs) {
    return updateModule('/items', id, { ...cleanBody, locations: newLocs })
  }

  return updateModule('/items', id, { ...cleanBody, stock_on_hand: targetQty })
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

const updateZohoCustomerByIdBody = z.object({
  fullName: z.string().trim().min(2).optional(),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  password: z.string().min(6).optional(),
  currentEmail: z.string().email().optional()
})

const createDriverBody = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(6)
})

const assignInvoiceBody = z.object({
  driver_email: z.string().email(),
  invoice_id: z.string().min(1)
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

adminRoutes.put('/customers/contact/:contactId', async (req, res, next) => {
  try {
    const contactId = z.string().min(1).parse(req.params.contactId)
    const body = updateZohoCustomerByIdBody.parse(req.body)

    const zohoPayload = {
      contact_id: contactId,
      ...(body.fullName ? { contact_name: body.fullName } : {}),
      ...(body.email ? { email: body.email } : {}),
      ...(body.mobile !== undefined ? { mobile: body.mobile } : {})
    }
    if (Object.keys(zohoPayload).length > 1) {
      await updateModule('/contacts', contactId, zohoPayload)
    }

    const lookupEmail = body.currentEmail || body.email
    let user = null
    let loginAction = 'none'
    if (lookupEmail) {
      user = updateCustomerUserByEmail(lookupEmail, {
        fullName: body.fullName,
        email: body.email,
        password: body.password
      })
      if (user) loginAction = 'updated'
      else if (body.password && body.email && body.fullName) {
        user = createCustomerUser({
          fullName: body.fullName,
          email: body.email,
          password: body.password
        })
        loginAction = 'created'
      }
    }

    appendAdminAudit({
      action: 'admin_update_customer_contact',
      meta: { contactId, email: body.email, loginAction }
    })
    res.json({ message: 'Customer updated', zohoUpdated: true, loginAction, user })
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/drivers', (_req, res) => {
  res.json({ drivers: listDrivers() })
})

adminRoutes.get('/invoices', async (req, res, next) => {
  try {
    const query = z.object({}).passthrough().parse(req.query)
    const data = await listModule('/invoices', { per_page: 200, ...query })
    res.json(data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.get('/delivery-assignments', (_req, res) => {
  res.json({ assignments: listAssignments() })
})

adminRoutes.get('/delivery-assignments/:id/proof', async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    const row = getAssignmentById(id)
    if (!row?.proof) {
      const err = new Error('Proof not found for this assignment')
      err.statusCode = 404
      throw err
    }
    const attachment = await getInvoiceAttachment(row.invoiceId)
    if (attachment.contentDisposition) {
      res.setHeader('Content-Disposition', attachment.contentDisposition)
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${row.proof.fileName || 'proof.jpg'}"`)
    }
    res.setHeader('Content-Type', attachment.contentType)
    res.send(attachment.data)
  } catch (error) {
    next(error)
  }
})

adminRoutes.post('/delivery-assignments', async (req, res, next) => {
  try {
    const input = assignInvoiceBody.parse(req.body)
    const driver = getDriverByEmail(input.driver_email)
    if (!driver) {
      const err = new Error('Driver not found')
      err.statusCode = 404
      throw err
    }
    const invoiceData = await getModuleById('/invoices', input.invoice_id)
    const invoice = invoiceData.invoice || invoiceData
    const assignment = createAssignment({
      driverEmail: driver.email,
      driverName: driver.fullName,
      invoiceId: String(invoice.invoice_id || input.invoice_id),
      invoiceNumber: String(invoice.invoice_number || invoice.reference_number || input.invoice_id),
      customerName: String(invoice.customer_name || ''),
      customerEmail: String(invoice.customer_email || ''),
      amount: Number(invoice.total) || 0,
      address: String(invoice.billing_address?.address || invoice.shipping_address?.address || '')
    })
    appendAdminAudit({ action: 'admin_assign_invoice', meta: { driver: driver.email, invoice: input.invoice_id } })
    res.status(201).json({ message: 'Invoice assigned to driver', assignment })
  } catch (error) {
    next(error)
  }
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
    orders.sort((a, b) => (Date.parse(String(b?.date || '')) || 0) - (Date.parse(String(a?.date || '')) || 0))
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
    const targetStock = extractStockTargetFromBody(body)
    const cleanBody = stripStockFieldsFromBody(body)

    let existingItem = null
    if (targetStock != null) {
      try {
        const existing = await getModuleById('/items', id)
        existingItem = existing?.item ?? existing
      } catch {
        existingItem = null
      }
    }

    let data
    if (targetStock != null && existingItem) {
      data = await applyZohoItemStockAndMetadata(id, existingItem, targetStock, cleanBody)
    } else if (targetStock != null) {
      data = await updateModule('/items', id, { ...cleanBody, stock_on_hand: targetStock })
    } else {
      data = await updateModule('/items', id, cleanBody)
    }
    appendAdminAudit({ action: 'admin_update_item', meta: { id } })

    try {
      const fresh = await getModuleById('/items', id)
      res.json(fresh)
    } catch {
      res.json(data)
    }
  } catch (error) {
    next(error)
  }
})

adminRoutes.delete('/items/:id', async (req, res, next) => {
  try {
    const id = z.string().min(1).parse(req.params.id)
    try {
      const data = await deleteModule('/items', id)
      appendAdminAudit({ action: 'admin_delete_item', meta: { id } })
      return res.json(data)
    } catch (err) {
      if (!axios.isAxiosError(err)) throw err
      const zohoBody = err.response?.data
      if (shouldFallbackItemDeleteToInactive(zohoBody)) {
        const data = await markZohoItemInactive(id)
        appendAdminAudit({ action: 'admin_deactivate_item', meta: { id, reason: 'zoho_refused_delete' } })
        const hint =
          typeof zohoBody?.message === 'string' && zohoBody.message.trim()
            ? `${zohoBody.message.trim()} It was marked inactive in Zoho instead.`
            : 'This item cannot be deleted while it is linked to transactions. It was marked inactive in Zoho instead.'
        return res.json({
          ...data,
          deactivated_instead_of_delete: true,
          message: hint
        })
      }
      throw err
    }
  } catch (error) {
    next(error)
  }
})
