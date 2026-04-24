import { Router } from 'express'
import { z } from 'zod'
import {
  createCustomer,
  createInvoice,
  createInvoiceForOrder,
  createModule,
  createSalesOrder,
  getModuleById,
  getOrganizations,
  listModule,
  searchCustomerByEmail
} from '../services/zohoBooksService.js'

const createCustomerSchema = z.object({
  contact_name: z.string().min(1),
  email: z.string().email(),
  mobile: z.string().optional()
})

const lineItemSchema = z.object({
  name: z.string().optional(),
  item_id: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  rate: z.number().nonnegative()
})

const createInvoiceSchema = z.object({
  customer_id: z.string().min(1),
  invoice_number: z.string().optional(),
  reference_number: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1)
})

const createSalesOrderSchema = z.object({
  customer_id: z.string().min(1),
  salesorder_number: z.string().optional(),
  reference_number: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1)
})

const syncOrderSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().optional(),
  invoice_number: z.string().optional(),
  reference_number: z.string().optional(),
  line_items: z.array(lineItemSchema).min(1)
})

const deliveryConfirmationSchema = z.object({
  recipient_name: z.string().min(1),
  notes: z.string().max(500).optional()
})

const idParamSchema = z.object({
  id: z.string().min(1)
})

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(200).optional(),
  search_text: z.string().optional(),
  email: z.string().email().optional()
})

const modulePayloadSchema = z.object({}).passthrough()
const genericQuerySchema = z.object({}).passthrough()

export const zohoRoutes = Router()

zohoRoutes.get('/organizations', async (_req, res, next) => {
  try {
    const data = await getOrganizations()
    res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/customers', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query)
    if (query.email) {
      const data = await searchCustomerByEmail(query.email)
      return res.json(data)
    }

    const data = await listModule('/contacts', query)
    return res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.post('/customers', async (req, res, next) => {
  try {
    const input = createCustomerSchema.parse(req.body)
    const data = await createCustomer(input)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.post('/invoices', async (req, res, next) => {
  try {
    const input = createInvoiceSchema.parse(req.body)
    const data = await createInvoice(input)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/invoices', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query)
    const data = await listModule('/invoices', query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/invoices/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const query = querySchema.parse(req.query)
    const data = await getModuleById('/invoices', id, query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.post('/sales-orders', async (req, res, next) => {
  try {
    const input = createSalesOrderSchema.parse(req.body)
    const data = await createSalesOrder(input)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/sales-orders', async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query)
    const data = await listModule('/salesorders', query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/sales-orders/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const query = querySchema.parse(req.query)
    const data = await getModuleById('/salesorders', id, query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.post('/sync-order', async (req, res, next) => {
  try {
    const input = syncOrderSchema.parse(req.body)
    const data = await createInvoiceForOrder(input)
    res.status(201).json(data)
  } catch (error) {
    next(error)
  }
})

function mapDeliveryStopFromSalesOrder(order, index) {
  const shipping = order.shipping_address || {}
  const billing = order.billing_address || {}
  const cityStateZip = [shipping.city, shipping.state, shipping.zip].filter(Boolean).join(', ')
  const addressLine1 = shipping.address || billing.address || 'Address unavailable'
  const addressLine2 = cityStateZip || shipping.country || billing.country || ''
  const mapsQuery = [addressLine1, addressLine2].filter(Boolean).join(', ')
  const contactName = shipping.attention || order.customer_name || 'Customer'
  const amount = Number(order.total) || 0
  const lineItems = Array.isArray(order.line_items) ? order.line_items : []
  const status = (order.status || '').toLowerCase()
  const isNext = index === 0

  return {
    id: order.salesorder_id,
    salesorder_id: order.salesorder_id,
    deliveryNumber: order.salesorder_number || order.reference_number || order.salesorder_id,
    businessName: order.customer_name || 'Customer',
    orderId: `Order #${order.salesorder_number || order.salesorder_id}`,
    amount,
    paymentLabel: order.payment_terms_label || 'Credit',
    statusTag: status.includes('deliver') ? 'Delivered' : isNext ? 'Next Stop' : 'Scheduled',
    timeLabel: order.date || 'Today',
    isNext,
    address: [addressLine1, addressLine2].filter(Boolean).join(', '),
    contactName,
    contactRole: 'Receiving',
    initials: contactName
      .split(' ')
      .map((part) => part[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    customerName: order.customer_name || 'Customer',
    verified: true,
    addressLine1,
    addressLine2,
    mapsQuery,
    phone: shipping.phone || billing.phone || '',
    contactLine: `Main Contact: ${contactName}`,
    arrivalWindow: order.date || 'Today',
    driverNote: order.notes || order.terms || 'Handle package with care.',
    podOrderLabel: `Order #${order.salesorder_number || order.salesorder_id}`,
    podSubtitle: `${order.customer_name || 'Customer'} • ${lineItems.length} Items`,
    items: lineItems.map((item) => ({
      name: item.name || 'Item',
      sku: item.sku || item.item_id || '',
      qty: Number(item.quantity) || 1,
      unit: item.unit || 'unit',
      image: ''
    }))
  }
}

zohoRoutes.get('/delivery/stops', async (req, res, next) => {
  try {
    const query = genericQuerySchema.parse(req.query)
    const data = await listModule('/salesorders', { per_page: 200, ...query })
    const orders = Array.isArray(data.salesorders) ? data.salesorders : []
    const stops = orders.map((order, index) => mapDeliveryStopFromSalesOrder(order, index))
    res.json({ stops })
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/delivery/stops/:id', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const data = await getModuleById('/salesorders', id)
    const salesOrder = data.salesorder || data
    const stop = mapDeliveryStopFromSalesOrder(salesOrder, 0)
    res.json({ stop })
  } catch (error) {
    next(error)
  }
})

zohoRoutes.post('/delivery/stops/:id/confirm', async (req, res, next) => {
  try {
    const { id } = idParamSchema.parse(req.params)
    const payload = deliveryConfirmationSchema.parse(req.body)
    const salesOrderData = await getModuleById('/salesorders', id)
    const salesOrder = salesOrderData.salesorder || salesOrderData
    const lineItems = Array.isArray(salesOrder.line_items) ? salesOrder.line_items : []
    const challanPayload = {
      customer_id: salesOrder.customer_id,
      reference_number: salesOrder.salesorder_number || salesOrder.reference_number || id,
      notes: payload.notes || `Delivered to ${payload.recipient_name}`,
      line_items: lineItems.map((item) => ({
        item_id: item.item_id,
        quantity: Number(item.quantity) || 1,
        rate: Number(item.rate) || 0
      }))
    }
    const challan = await createModule('/deliverychallans', challanPayload)
    res.status(201).json({
      message: 'Delivery confirmed and synced to Zoho Books',
      delivery_challan: challan.deliverychallan || challan
    })
  } catch (error) {
    next(error)
  }
})

function createModuleRoutes(moduleConfigs) {
  for (const moduleConfig of moduleConfigs) {
    const baseQuery = moduleConfig.baseQuery || {}

    zohoRoutes.get(`/${moduleConfig.route}`, async (req, res, next) => {
      try {
        const query = genericQuerySchema.parse(req.query)
        const data = await listModule(moduleConfig.path, { ...baseQuery, ...query })
        res.json(data)
      } catch (error) {
        next(error)
      }
    })

    zohoRoutes.get(`/${moduleConfig.route}/:id`, async (req, res, next) => {
      try {
        const { id } = idParamSchema.parse(req.params)
        const query = genericQuerySchema.parse(req.query)
        const data = await getModuleById(moduleConfig.path, id, { ...baseQuery, ...query })
        res.json(data)
      } catch (error) {
        next(error)
      }
    })

    zohoRoutes.post(`/${moduleConfig.route}`, async (req, res, next) => {
      try {
        const payload = modulePayloadSchema.parse(req.body)
        const mergedPayload =
          moduleConfig.defaultPayload && typeof moduleConfig.defaultPayload === 'object'
            ? { ...moduleConfig.defaultPayload, ...payload }
            : payload
        const data = await createModule(moduleConfig.path, mergedPayload, baseQuery)
        res.status(201).json(data)
      } catch (error) {
        next(error)
      }
    })
  }
}

// Sales modules
createModuleRoutes([
  { route: 'quotes', path: '/estimates' },
  { route: 'recurring-invoices', path: '/recurringinvoices' },
  { route: 'delivery-challans', path: '/deliverychallans' },
  { route: 'payment-links', path: '/paymentlinks' },
  { route: 'payments-received', path: '/customerpayments' },
  { route: 'sales-returns', path: '/salesreturns' },
  { route: 'credit-notes', path: '/creditnotes' }
])

// Items + Inventory modules
createModuleRoutes([
  { route: 'items', path: '/items' },
  { route: 'price-lists', path: '/pricebooks' },
  { route: 'inventory-adjustments', path: '/inventoryadjustments' },
  { route: 'shipments', path: '/packages' },
  { route: 'transfer-orders', path: '/transferorders' }
])

// Purchase modules
createModuleRoutes([
  {
    route: 'vendors',
    path: '/contacts',
    baseQuery: { contact_type: 'vendor' },
    defaultPayload: { contact_type: 'vendor' }
  },
  { route: 'purchase-orders', path: '/purchaseorders' },
  { route: 'bills', path: '/bills' },
  { route: 'recurring-bills', path: '/recurringbills' },
  { route: 'vendor-credits', path: '/vendorcredits' },
  { route: 'expenses', path: '/expenses' }
])

// Time tracking modules
createModuleRoutes([
  { route: 'projects', path: '/projects' },
  { route: 'tasks', path: '/tasks' },
  { route: 'time-entries', path: '/timeentries' }
])

// Banking / Accountant / Reports modules
createModuleRoutes([
  { route: 'bank-accounts', path: '/bankaccounts' },
  { route: 'bank-transactions', path: '/banktransactions' },
  { route: 'journals', path: '/journals' }
])

zohoRoutes.get('/reports', async (_req, res) => {
  return res.status(400).json({
    message:
      'Report list endpoint requires a report name. Use /api/zoho/reports/:reportName (example: /reports/profitandloss).'
  })
})

zohoRoutes.get('/reports/:reportName', async (req, res, next) => {
  try {
    const query = genericQuerySchema.parse(req.query)
    const reportName = req.params.reportName
    const data = await getModuleById('/reports', reportName, query)
    res.json(data)
  } catch (error) {
    next(error)
  }
})

zohoRoutes.get('/home', async (_req, res) => {
  return res.json({
    message: 'Use /health and module endpoints for dashboard data aggregation.'
  })
})

zohoRoutes.get('/documents', async (_req, res) => {
  return res.status(501).json({
    message:
      'Zoho Books documents module is not exposed as a stable public API list endpoint. Use specific transaction attachments endpoints.'
  })
})

zohoRoutes.get('/web-tabs', async (_req, res) => {
  return res.status(501).json({
    message: 'Zoho Books web tabs are UI-only and not exposed through public API endpoints.'
  })
})

zohoRoutes.get('/e-way-bills', async (_req, res) => {
  return res.status(501).json({
    message:
      'Zoho Books public API does not expose a stable e-Way Bills endpoint. Use the Zoho Books UI/GSP flow for e-Way bill generation.'
  })
})
