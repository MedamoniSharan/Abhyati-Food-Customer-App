import axios from 'axios'
import { env } from '../config/env.js'
import { getOrganizationId } from './zohoBooksService.js'
import { resolveZohoAccessToken } from './zohoTokenProvider.js'

/**
 * Streams item image bytes from Zoho Books (no local persistence).
 * GET {ZOHO_BOOKS_BASE_URL}/items/{item_id}/image?organization_id=...
 */
export async function streamItemImageFromZoho(itemId) {
  const organizationId = await getOrganizationId()
  const accessToken = await resolveZohoAccessToken()

  const url = `${env.ZOHO_BOOKS_BASE_URL}/items/${encodeURIComponent(itemId)}/image`

  const zohoResponse = await axios({
    method: 'GET',
    url,
    params: { organization_id: organizationId },
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    responseType: 'stream',
    validateStatus: () => true,
    timeout: 60_000
  })

  const status = zohoResponse.status
  const contentType = zohoResponse.headers['content-type'] || 'application/octet-stream'

  if (status === 404) {
    return { ok: false, status: 404, message: 'Image not found' }
  }

  if (status < 200 || status >= 300) {
    if (zohoResponse.data && typeof zohoResponse.data.destroy === 'function') {
      zohoResponse.data.destroy()
    }
    return {
      ok: false,
      status: 500,
      message: `Zoho image request failed with status ${status}`
    }
  }

  return {
    ok: true,
    stream: zohoResponse.data,
    contentType,
    contentLength: zohoResponse.headers['content-length']
  }
}
