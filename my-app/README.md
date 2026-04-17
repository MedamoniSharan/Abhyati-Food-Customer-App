# Abhyati Food Customer App

Mobile-first React + Capacitor app with Zoho Books backend integration.

## Frontend setup

```bash
npm install
npm run dev
```

## Backend setup (Zoho Books)

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs at `http://localhost:4000` by default.

### Required backend env values

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_REGION`
- `ZOHO_ORGANIZATION_ID` (optional; auto-selects first org if omitted)

## Available backend APIs

Base URL (local): `http://localhost:3001`

### Core

- `GET /health`
- `GET /api/zoho/organizations`
- `POST /api/zoho/sync-order` (find/create customer + create invoice)

### Customers / Contacts

- `GET /api/zoho/customers`
- `GET /api/zoho/customers?email=user@example.com`
- `GET /api/zoho/customers/:id`
- `POST /api/zoho/customers`

### Sales

- `GET /api/zoho/quotes`
- `GET /api/zoho/quotes/:id`
- `POST /api/zoho/quotes`
- `GET /api/zoho/sales-orders`
- `GET /api/zoho/sales-orders/:id`
- `POST /api/zoho/sales-orders`
- `GET /api/zoho/invoices`
- `GET /api/zoho/invoices/:id`
- `POST /api/zoho/invoices`
- `GET /api/zoho/recurring-invoices`
- `GET /api/zoho/recurring-invoices/:id`
- `POST /api/zoho/recurring-invoices`
- `GET /api/zoho/delivery-challans`
- `GET /api/zoho/delivery-challans/:id`
- `POST /api/zoho/delivery-challans`
- `GET /api/zoho/payment-links`
- `GET /api/zoho/payment-links/:id`
- `POST /api/zoho/payment-links`
- `GET /api/zoho/payments-received`
- `GET /api/zoho/payments-received/:id`
- `POST /api/zoho/payments-received`
- `GET /api/zoho/sales-returns`
- `GET /api/zoho/sales-returns/:id`
- `POST /api/zoho/sales-returns`
- `GET /api/zoho/credit-notes`
- `GET /api/zoho/credit-notes/:id`
- `POST /api/zoho/credit-notes`

### Items & Inventory

- `GET /api/zoho/items`
- `GET /api/zoho/items/:id`
- `POST /api/zoho/items`
- `GET /api/zoho/price-lists`
- `GET /api/zoho/price-lists/:id`
- `POST /api/zoho/price-lists`
- `GET /api/zoho/inventory-adjustments`
- `GET /api/zoho/inventory-adjustments/:id`
- `POST /api/zoho/inventory-adjustments`
- `GET /api/zoho/shipments`
- `GET /api/zoho/shipments/:id`
- `POST /api/zoho/shipments`
- `GET /api/zoho/transfer-orders`
- `GET /api/zoho/transfer-orders/:id`
- `POST /api/zoho/transfer-orders`

### Purchases

- `GET /api/zoho/vendors`
- `GET /api/zoho/vendors/:id`
- `POST /api/zoho/vendors`
- `GET /api/zoho/purchase-orders`
- `GET /api/zoho/purchase-orders/:id`
- `POST /api/zoho/purchase-orders`
- `GET /api/zoho/bills`
- `GET /api/zoho/bills/:id`
- `POST /api/zoho/bills`
- `GET /api/zoho/recurring-bills`
- `GET /api/zoho/recurring-bills/:id`
- `POST /api/zoho/recurring-bills`
- `GET /api/zoho/vendor-credits`
- `GET /api/zoho/vendor-credits/:id`
- `POST /api/zoho/vendor-credits`
- `GET /api/zoho/expenses`
- `GET /api/zoho/expenses/:id`
- `POST /api/zoho/expenses`

### Time Tracking

- `GET /api/zoho/projects`
- `GET /api/zoho/projects/:id`
- `POST /api/zoho/projects`
- `GET /api/zoho/tasks`
- `GET /api/zoho/tasks/:id`
- `POST /api/zoho/tasks`
- `GET /api/zoho/time-entries`
- `GET /api/zoho/time-entries/:id`
- `POST /api/zoho/time-entries`

### Banking / Accountant

- `GET /api/zoho/bank-accounts`
- `GET /api/zoho/bank-accounts/:id`
- `POST /api/zoho/bank-accounts`
- `GET /api/zoho/bank-transactions`
- `GET /api/zoho/bank-transactions/:id`
- `POST /api/zoho/bank-transactions`
- `GET /api/zoho/journals`
- `GET /api/zoho/journals/:id`
- `POST /api/zoho/journals`

### Reports

- `GET /api/zoho/reports` (returns usage message)
- `GET /api/zoho/reports/:reportName`
  - Example: `/api/zoho/reports/profitandloss?from_date=2025-04-01&to_date=2026-03-31`

### UI-only / Not Exposed as stable public API

- `GET /api/zoho/e-way-bills` -> `501`
- `GET /api/zoho/documents` -> `501`
- `GET /api/zoho/web-tabs` -> `501`

### Common list query params

- `page` (number)
- `per_page` (max 200)
- `search_text` (module support varies in Zoho)

## Capacitor builds

### Android

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

Debug APK:
`android/app/build/outputs/apk/debug/app-debug.apk`

### iOS

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Then build/archive from Xcode.
