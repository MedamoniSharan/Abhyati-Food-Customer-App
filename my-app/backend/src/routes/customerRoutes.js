import { Router } from 'express'
import { z } from 'zod'
import { requireCustomer } from '../middleware/requireCustomer.js'
import { listAssignments } from '../services/deliveryAssignmentStore.js'
import {
  createInvoice,
  createSalesOrder,
  ensureCustomerContact,
  getInvoiceAttachment,
  getModuleById,
  listModule
} from '../services/zohoBooksService.js'

const lineItemSchema = z.object({
  item_id: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  rate: z.number().nonnegative()
})

const createOrderSchema = z.object({
  line_items: z.array(lineItemSchema).min(1),
  reference_number: z.string().optional()
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional()
})

const idParamSchema = z.object({
  id: z.string().min(1)
})

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

/** Zoho list payloads sometimes omit `customer_email`; `customer_id` is reliable after checkout. */
function invoiceBelongsToAppCustomer(invoice, customerEmail, zohoCustomerId) {
  const email = normalizeEmail(customerEmail)
  const invEmail = normalizeEmail(invoice?.customer_email)
  if (invEmail && invEmail === email) return true
  const zid = String(zohoCustomerId || '').trim()
  if (zid && String(invoice?.customer_id || '').trim() === zid) return true
  return false
}

function compareOrderDateDesc(a, b) {
  const ta = Date.parse(String(a?.date || '')) || 0
  const tb = Date.parse(String(b?.date || '')) || 0
  return tb - ta
}

function buildOrderItemsLabel(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return 'Items'
  return lineItems
    .slice(0, 3)
    .map((line) => {
      const qty = Number(line?.quantity) || 1
      const name = line?.name || line?.description || 'Item'
      return `${qty}x ${name}`
    })
    .join(', ')
}

function mapStatus(invoiceStatus, assignmentStatus) {
  const status = String(assignmentStatus || invoiceStatus || '').toLowerCase()
  if (status.includes('deliver')) return 'Delivered'
  if (status.includes('transit') || status.includes('ship') || status.includes('sent')) return 'Shipped'
  return 'Processing'
}

function mapInvoiceToOrder(invoice, assignment) {
  const invoiceId = String(invoice?.invoice_id || '')
  const lineItems = Array.isArray(invoice?.line_items) ? invoice.line_items : []
  const proof = assignment?.proof || null
  return {
    id: invoiceId,
    invoiceId,
    invoiceNumber: String(invoice?.invoice_number || invoice?.reference_number || invoiceId),
    date: String(invoice?.date || invoice?.invoice_date || ''),
    status: mapStatus(invoice?.status, assignment?.status),
    items: buildOrderItemsLabel(lineItems),
    amountInr: Number(invoice?.total) || 0,
    deliveredAt: assignment?.deliveredAt || null,
    proofAvailable: Boolean(proof),
    proofMeta: proof
      ? {
          fileName: proof.fileName || '',
          mimeType: proof.mimeType || '',
          uploadedAt: proof.uploadedAt || null,
          recipientName: proof.recipientName || ''
        }
      : null
  }
}

export const customerRoutes = Router()

customerRoutes.use(requireCustomer)

customerRoutes.get('/items', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const data = await listModule('/items', query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

customerRoutes.get('/items/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const data = await getModuleById('/items', id)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

customerRoutes.post('/orders', async (req, res, next) => {
  try {
    const body = createOrderSchema.parse(req.body)
    const customer = req.customer
    const contact = await ensureCustomerContact({
      fullName: customer.fullName,
      email: customer.email
    })
    const customerId = String(contact?.contact_id || '')
    if (!customerId) {
      const err = new Error('Unable to resolve customer contact in Zoho')
      err.statusCode = 502
      throw err
    }

    const salesOrderPayload = {
      customer_id: customerId,
      reference_number: body.reference_number,
      line_items: body.line_items
    }
    const invoicePayload = {
      customer_id: customerId,
      reference_number: body.reference_number,
      line_items: body.line_items
    }

    const [salesOrderData, invoiceData] = await Promise.all([
      createSalesOrder(salesOrderPayload),
      createInvoice(invoicePayload)
    ])

    const invoice = invoiceData?.invoice || invoiceData
    const order = invoice ? mapInvoiceToOrder(invoice, null) : null

    res.status(201).json({
      message: 'Order created',
      salesorder: salesOrderData?.salesorder || salesOrderData,
      invoice,
      ...(order ? { order } : {})
    })
  } catch (error) {
    next(error)
  }
})

customerRoutes.get('/orders', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const email = normalizeEmail(req.customer.email)
    const contact = await ensureCustomerContact({
      fullName: req.customer.fullName,
      email: req.customer.email
    })
    const zohoCustomerId = String(contact?.contact_id || '')
    const data = await listModule('/invoices', { per_page: 200, ...query })
    const rows = Array.isArray(data?.invoices) ? data.invoices : []
    const invoices = rows.filter((invoice) => invoiceBelongsToAppCustomer(invoice, email, zohoCustomerId))
    const assignmentsByInvoice = new Map(listAssignments().map((row) => [String(row.invoiceId), row]))
    const orders = invoices
      .map((invoice) => mapInvoiceToOrder(invoice, assignmentsByInvoice.get(String(invoice.invoice_id))))
      .sort(compareOrderDateDesc)
    res.json({ orders })
  } catch (error) {
    next(error)
  }
})

customerRoutes.get('/invoices', async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query)
    const email = normalizeEmail(req.customer.email)
    const contact = await ensureCustomerContact({
      fullName: req.customer.fullName,
      email: req.customer.email
    })
    const zohoCustomerId = String(contact?.contact_id || '')
    const data = await listModule('/invoices', { per_page: 200, ...query })
    const invoices = (Array.isArray(data?.invoices) ? data.invoices : []).filter((invoice) =>
      invoiceBelongsToAppCustomer(invoice, email, zohoCustomerId)
    )
    res.json({ ...data, invoices })
  } catch (error) {
    next(error)
  }
})

customerRoutes.get('/invoices/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const data = await getModuleById('/invoices', id)
    const invoice = data?.invoice || data
    const contact = await ensureCustomerContact({
      fullName: req.customer.fullName,
      email: req.customer.email
    })
    const zohoCustomerId = String(contact?.contact_id || '')
    if (!invoiceBelongsToAppCustomer(invoice, req.customer.email, zohoCustomerId)) {
      const err = new Error('Invoice not found')
      err.statusCode = 404
      throw err
    }
    res.json(data)
  } catch (error) {
    next(error)
  }
})

customerRoutes.get('/orders/:id/proof', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const data = await getModuleById('/invoices', id)
    const invoice = data?.invoice || data
    const contact = await ensureCustomerContact({
      fullName: req.customer.fullName,
      email: req.customer.email
    })
    const zohoCustomerId = String(contact?.contact_id || '')
    if (!invoiceBelongsToAppCustomer(invoice, req.customer.email, zohoCustomerId)) {
      const err = new Error('Order proof not found')
      err.statusCode = 404
      throw err
    }
    const assignment = listAssignments().find((row) => String(row.invoiceId) === id)
    if (!assignment?.proof) {
      const err = new Error('Proof is not available yet')
      err.statusCode = 404
      throw err
    }
    const attachment = await getInvoiceAttachment(id)
    if (attachment.contentDisposition) {
      res.setHeader('Content-Disposition', attachment.contentDisposition)
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${assignment.proof.fileName || 'proof.jpg'}"`)
    }
    res.setHeader('Content-Type', attachment.contentType)
    res.send(attachment.data)
  } catch (error) {
    next(error)
  }
})
