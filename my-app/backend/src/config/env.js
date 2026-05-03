import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173', 'http://localhost:5174', '*'),

  ZOHO_CLIENT_ID: z.string().min(1),
  ZOHO_CLIENT_SECRET: z.string().min(1),
  ZOHO_REFRESH_TOKEN: z.string().min(1),
  ZOHO_REGION: z.enum(['in', 'com', 'eu', 'com.au', 'jp', 'com.cn']).default('in'),
  ZOHO_ORGANIZATION_ID: z.string().optional(),
  /** Optional static access token (dev only). Prefer refresh-token flow via ZOHO_REFRESH_TOKEN. */
  ZOHO_ACCESS_TOKEN: z.string().optional(),

  ZOHO_DEFAULT_CURRENCY_CODE: z.string().default('INR'),
  ZOHO_DEFAULT_PAYMENT_TERMS: z.string().default('Due on Receipt'),
  AUTH_DEFAULT_CUSTOMER_EMAIL: z.string().email().default('customer@abhyati.com'),
  AUTH_DEFAULT_CUSTOMER_PASSWORD: z.string().min(6).default('Abhyati@123'),

  /** Admin dashboard + /api/admin/* (override in production) */
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(6).default('adminadmin'),
  JWT_SECRET: z.string().min(16).default('dev-jwt-secret-change-in-prod-32'),

  DRIVER_ZOHO_CONTACT_TYPE: z.enum(['vendor', 'customer']).default('vendor'),

  /** Chart account id for quantity inventory adjustments (POD stock sync) */
  ZOHO_INVENTORY_ADJUSTMENT_ACCOUNT_ID: z.string().optional()
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const regionHosts = {
  in: { accounts: 'accounts.zoho.in', books: 'www.zohoapis.in' },
  com: { accounts: 'accounts.zoho.com', books: 'www.zohoapis.com' },
  eu: { accounts: 'accounts.zoho.eu', books: 'www.zohoapis.eu' },
  'com.au': { accounts: 'accounts.zoho.com.au', books: 'www.zohoapis.com.au' },
  jp: { accounts: 'accounts.zoho.jp', books: 'www.zohoapis.jp' },
  'com.cn': { accounts: 'accounts.zoho.com.cn', books: 'www.zohoapis.com.cn' }
}

export const env = {
  ...parsed.data,
  ALLOWED_ORIGINS: parsed.data.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()),
  ZOHO_ACCOUNTS_BASE_URL: `https://${regionHosts[parsed.data.ZOHO_REGION].accounts}`,
  ZOHO_BOOKS_BASE_URL: `https://${regionHosts[parsed.data.ZOHO_REGION].books}/books/v3`
}
