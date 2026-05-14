import axios from 'axios'
import { env } from '../config/env.js'
import { getZohoAccessToken } from './zohoAuthService.js'

async function request(method, path, { params, data } = {}) {
  const accessToken = await getZohoAccessToken()
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` }

  const response = await axios({
    method,
    url: `${env.ZOHO_BOOKS_BASE_URL}${path}`,
    headers,
    params,
    data
  })

  const body = response.data
  // Zoho Books uses HTTP 2xx with a JSON `code` field: 0 = success, non-zero = error (see API "Response").
  if (body && typeof body === 'object' && 'code' in body) {
    const raw = body.code
    const codeNum = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(codeNum) && codeNum !== 0) {
      const err = new Error(body.message || `Zoho Books error (code ${codeNum})`)
      err.statusCode = 400
      throw err
    }
  }

  return body
}

export async function getOrganizations() {
  return request('get', '/organizations')
}

export async function getOrganizationId() {
  if (env.ZOHO_ORGANIZATION_ID) return env.ZOHO_ORGANIZATION_ID

  const organizations = await getOrganizations()
  const orgId = organizations?.organizations?.[0]?.organization_id

  if (!orgId) {
    throw new Error('No Zoho Books organization found. Set ZOHO_ORGANIZATION_ID in backend .env')
  }

  return orgId
}

export async function searchCustomerByEmail(email) {
  const organizationId = await getOrganizationId()
  return request('get', '/contacts', {
    params: { organization_id: organizationId, contact_name_contains: email }
  })
}

export async function findCustomerByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return null
  const organizationId = await getOrganizationId()
  const data = await request('get', '/contacts', {
    params: { organization_id: organizationId, email: normalized, contact_type: 'customer', per_page: 50 }
  })
  const contacts = Array.isArray(data?.contacts) ? data.contacts : []
  return contacts.find((contact) => String(contact?.email || '').trim().toLowerCase() === normalized) || null
}

export async function ensureCustomerContact({ fullName, email, mobile }) {
  const existing = await findCustomerByEmail(email)
  if (existing?.contact_id) {
    return existing
  }
  const created = await createCustomer({
    contact_name: fullName || email,
    email,
    mobile
  })
  return created?.contact || null
}

export async function createCustomer({ contact_name, email, mobile }) {
  const organizationId = await getOrganizationId()
  return request('post', '/contacts', {
    params: { organization_id: organizationId },
    data: {
      contact_name,
      contact_type: 'customer',
      email,
      mobile
    }
  })
}

export async function createInvoice(payload) {
  const organizationId = await getOrganizationId()
  return request('post', '/invoices', {
    params: { organization_id: organizationId },
    data: payload
  })
}

export async function createSalesOrder(payload) {
  const organizationId = await getOrganizationId()
  return request('post', '/salesorders', {
    params: { organization_id: organizationId },
    data: payload
  })
}

export async function listModule(modulePath, query = {}) {
  const organizationId = await getOrganizationId()
  return request('get', modulePath, {
    params: { organization_id: organizationId, ...query }
  })
}

export async function getModuleById(modulePath, id, query = {}) {
  const organizationId = await getOrganizationId()
  return request('get', `${modulePath}/${id}`, {
    params: { organization_id: organizationId, ...query }
  })
}

export async function createModule(modulePath, payload, query = {}) {
  const organizationId = await getOrganizationId()
  return request('post', modulePath, {
    params: { organization_id: organizationId, ...query },
    data: payload
  })
}

export async function updateModule(modulePath, id, payload, query = {}) {
  const organizationId = await getOrganizationId()
  return request('put', `${modulePath}/${encodeURIComponent(id)}`, {
    params: { organization_id: organizationId, ...query },
    data: payload
  })
}

export async function deleteModule(modulePath, id, query = {}) {
  const organizationId = await getOrganizationId()
  return request('delete', `${modulePath}/${encodeURIComponent(id)}`, {
    params: { organization_id: organizationId, ...query }
  })
}

/** Zoho Books: POST /items/{id}/inactive — used when hard delete is not allowed (e.g. item on transactions). */
export async function markZohoItemInactive(itemId) {
  const organizationId = await getOrganizationId()
  return request('post', `/items/${encodeURIComponent(itemId)}/inactive`, {
    params: { organization_id: organizationId }
  })
}

export async function uploadInvoiceAttachment(invoiceId, { buffer, mimetype, originalname }) {
  const organizationId = await getOrganizationId()
  const accessToken = await getZohoAccessToken()
  const form = new FormData()
  const blob = new Blob([buffer], { type: mimetype || 'application/octet-stream' })
  form.append('attachment', blob, originalname || 'proof.jpg')

  const response = await axios({
    method: 'post',
    url: `${env.ZOHO_BOOKS_BASE_URL}/invoices/${encodeURIComponent(invoiceId)}/attachment`,
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    params: { organization_id: organizationId },
    data: form
  })
  return response.data
}

export async function getInvoiceAttachment(invoiceId) {
  const organizationId = await getOrganizationId()
  const accessToken = await getZohoAccessToken()
  const response = await axios({
    method: 'get',
    url: `${env.ZOHO_BOOKS_BASE_URL}/invoices/${encodeURIComponent(invoiceId)}/attachment`,
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    params: { organization_id: organizationId },
    responseType: 'arraybuffer'
  })
  return {
    data: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'application/octet-stream',
    contentDisposition: response.headers['content-disposition'] || ''
  }
}

export async function createInvoiceForOrder(orderPayload) {
  const organizationId = await getOrganizationId()
  const {
    customer_name,
    customer_email,
    customer_phone,
    invoice_number,
    reference_number,
    line_items
  } = orderPayload

  const contacts = await request('get', '/contacts', {
    params: { organization_id: organizationId, email: customer_email }
  })
  let customerId = contacts?.contacts?.[0]?.contact_id

  if (!customerId) {
    const customerResult = await createCustomer({
      contact_name: customer_name,
      email: customer_email,
      mobile: customer_phone
    })
    customerId = customerResult.contact.contact_id
  }

  return createInvoice({
    customer_id: customerId,
    currency_code: env.ZOHO_DEFAULT_CURRENCY_CODE,
    payment_terms_label: env.ZOHO_DEFAULT_PAYMENT_TERMS,
    invoice_number,
    reference_number,
    line_items
  })
}
