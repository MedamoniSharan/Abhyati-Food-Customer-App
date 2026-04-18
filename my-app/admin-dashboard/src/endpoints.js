export const endpointGroups = [
  {
    label: 'Core',
    items: [
      { name: 'Organizations', path: '/api/zoho/organizations', methods: ['GET'] },
      { name: 'Sync Order', path: '/api/zoho/sync-order', methods: ['POST'] },
      { name: 'Home', path: '/api/zoho/home', methods: ['GET'] }
    ]
  },
  {
    label: 'Customers',
    items: [{ name: 'Customers', path: '/api/zoho/customers', methods: ['GET', 'POST', 'GET_BY_ID'] }]
  },
  {
    label: 'Sales',
    items: [
      { name: 'Quotes', path: '/api/zoho/quotes', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Sales Orders', path: '/api/zoho/sales-orders', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Invoices', path: '/api/zoho/invoices', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Recurring Invoices', path: '/api/zoho/recurring-invoices', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Delivery Challans', path: '/api/zoho/delivery-challans', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Payment Links', path: '/api/zoho/payment-links', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Payments Received', path: '/api/zoho/payments-received', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Sales Returns', path: '/api/zoho/sales-returns', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Credit Notes', path: '/api/zoho/credit-notes', methods: ['GET', 'POST', 'GET_BY_ID'] }
    ]
  },
  {
    label: 'Items & Inventory',
    items: [
      { name: 'Items', path: '/api/zoho/items', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Price Lists', path: '/api/zoho/price-lists', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Inventory Adjustments', path: '/api/zoho/inventory-adjustments', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Shipments', path: '/api/zoho/shipments', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Transfer Orders', path: '/api/zoho/transfer-orders', methods: ['GET', 'POST', 'GET_BY_ID'] }
    ]
  },
  {
    label: 'Purchases',
    items: [
      { name: 'Vendors', path: '/api/zoho/vendors', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Purchase Orders', path: '/api/zoho/purchase-orders', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Bills', path: '/api/zoho/bills', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Recurring Bills', path: '/api/zoho/recurring-bills', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Vendor Credits', path: '/api/zoho/vendor-credits', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Expenses', path: '/api/zoho/expenses', methods: ['GET', 'POST', 'GET_BY_ID'] }
    ]
  },
  {
    label: 'Time Tracking',
    items: [
      { name: 'Projects', path: '/api/zoho/projects', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Tasks', path: '/api/zoho/tasks', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Time Entries', path: '/api/zoho/time-entries', methods: ['GET', 'POST', 'GET_BY_ID'] }
    ]
  },
  {
    label: 'Banking / Accountant',
    items: [
      { name: 'Bank Accounts', path: '/api/zoho/bank-accounts', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Bank Transactions', path: '/api/zoho/bank-transactions', methods: ['GET', 'POST', 'GET_BY_ID'] },
      { name: 'Journals', path: '/api/zoho/journals', methods: ['GET', 'POST', 'GET_BY_ID'] }
    ]
  },
  {
    label: 'Reports / Special',
    items: [
      { name: 'Reports', path: '/api/zoho/reports', methods: ['GET', 'GET_BY_ID'] },
      { name: 'Documents', path: '/api/zoho/documents', methods: ['GET'] },
      { name: 'Web Tabs', path: '/api/zoho/web-tabs', methods: ['GET'] },
      { name: 'E-Way Bills', path: '/api/zoho/e-way-bills', methods: ['GET'] }
    ]
  }
]
