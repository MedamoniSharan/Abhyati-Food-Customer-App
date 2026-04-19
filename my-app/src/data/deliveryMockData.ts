export type RouteStop = {
  id: string
  businessName: string
  orderId: string
  amount: number
  paymentLabel: 'COD' | 'Credit' | 'Paid'
  statusTag: string
  timeLabel: string
  isNext: boolean
  address: string
  note?: string
  contactName: string
  contactRole: string
  initials: string
}

export const routeStops: RouteStop[] = [
  {
    id: '12345',
    businessName: "Joe's Pizza Place",
    orderId: 'Order #12345',
    amount: 450,
    paymentLabel: 'COD',
    statusTag: 'Next Stop',
    timeLabel: '10:30 AM',
    isNext: true,
    address: '123 Main St, New York, NY 10001',
    note: 'Leave at the back door, code 4590.',
    contactName: 'John Doe',
    contactRole: 'Manager',
    initials: 'JD',
  },
  {
    id: '12346',
    businessName: 'Burger King #402',
    orderId: 'Order #12346',
    amount: 1250,
    paymentLabel: 'Credit',
    statusTag: 'Scheduled',
    timeLabel: '11:15 AM',
    isNext: false,
    address: '450 Broadway, New York, NY 10013',
    contactName: 'Sarah Miller',
    contactRole: 'Supervisor',
    initials: 'SM',
  },
  {
    id: '12347',
    businessName: 'The Bagel Shop',
    orderId: 'Order #12347',
    amount: 220.5,
    paymentLabel: 'Paid',
    statusTag: 'Scheduled',
    timeLabel: '12:45 PM',
    isNext: false,
    address: '890 5th Ave, New York, NY 10021',
    contactName: 'Mike K.',
    contactRole: 'Owner',
    initials: 'MK',
  },
]

export type DeliveryLineItem = {
  name: string
  sku: string
  qty: number
  unit: string
  image: string
}

export type DeliveryStopDetail = {
  id: string
  deliveryNumber: string
  customerName: string
  verified: boolean
  addressLine1: string
  addressLine2: string
  /** Full place string for Google Maps (geocoding / directions destination). */
  mapsQuery: string
  phone: string
  contactLine: string
  arrivalWindow: string
  mapImage: string
  driverNote: string
  items: DeliveryLineItem[]
  podOrderLabel: string
  podSubtitle: string
}

const IMG_PLATES =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuA_M4Us3Q1p4GIYBddF4NILInFMmupPMcKp6Otx0pB5r57q1B0NnjJuBSfktOfscSLEtVGbcN7_yyv1ZqoPAMxm_MVm_7NudcOXKFHobItSAr3Mx1wS7ol7JthB1seYwmUDCCBkHj2hDJXD0uCHtgOX-7t5TRh547bbt76X72Geeh-8tqyMD3pDPYFGIupCngrVWO6VBL1LEAMSgsSX_phmWq6oWsFiy-MQz1Ec6KQdsZ0sW-_LdDKDHBbEGF5n7yQRB_SgdTCUDpsA'
const IMG_DESSERT =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBy0XDmKxIACjsa2pFLe6MadyckmozupKHOltZJ_ZG_H-6bXWO_8XrBLQb0APJdfMrpsxxb9xHngwfD6VvB_tyTZlANoZ_Wm_qAPLRJ2QHyhllInEznn9396q9uFi5LD0vhTCFLxgoxOSLoubbeR2hKP1bS6gaje-s3zl7VExP96PGiAUC8GH52KKhJPCg-Y0xEANtGoPw6UPqK83JWWM3S7JEDqiwPsfDFoANtuNwHz8tskZ16K0OYjiHlPVtLyYddObJCvXr-bS1e'
const IMG_NAPKINS =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAZsY-MuwQOJetak9ZupjHWSUXx2D2OXmPCIZw5bGb19WntN2pIjDqejQK7TDKIAFyNJJgThtCWekjVD_Mpc1B09oa8lDH62fUSVlDdBw45TuKtoEiP7ZM6LrSYn1It4xUvbu-l2k8sgfN91qgNexuRiBQnOFk_uyJOf2LnMpbBQYRSO-v7q0ZyBmY9SRxWO7u1AVNqwpArqdo-EG4Jf48wsY2kdrnGpWyjftr25a5u3KZF9mb9au6Sux-GEtODmt9PiBpCPQSI4_Ip'
const MAP_SF =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC5iVo_LdABi6aRzDGeaMHu2lsZcT-i2pPA7ppKUWB-HsKlBSP1ZyoJDx2kBcNshYpgGZYOx9PetLlZDLxzvGgdwz1afVX2Q5bdGb_s1M2S760s8kCJ8QNeiwIawld9f1KzjKdqmd-2QI_kChVAUO8QJXvrlNC-JzZb4OYqVQXYHCzGMJWW7GxlwKoLv-utBJCXFlcSd7akRk5jurlB7eWKl4ZLEiEUZ0JpksqHfyBS-JQhJ-YIp3D0uN8Haely0v8oxSbsn2Pv1c0f'

const detail9024: DeliveryStopDetail = {
  id: '9024',
  deliveryNumber: '9024',
  customerName: 'Paper Cafe Inc.',
  verified: true,
  addressLine1: '123 Market St',
  addressLine2: 'San Francisco, CA 94103',
  mapsQuery: '123 Market St, San Francisco, CA 94103, USA',
  phone: '(555) 123-4567',
  contactLine: 'Main Contact: Sarah J.',
  arrivalWindow: 'Today, 2:00 PM - 4:00 PM',
  mapImage: MAP_SF,
  driverNote: 'Please use the rear loading dock. The gate code is #4455. Ask for Mike upon arrival.',
  podOrderLabel: 'Order #1234-88',
  podSubtitle: 'Green Leaf Bistro • 5 Items',
  items: [
    {
      name: '10" Eco Paper Plates',
      sku: 'SKU: PP-10-ECO • 500/Case',
      qty: 5,
      unit: 'Cases',
      image: IMG_PLATES,
    },
    {
      name: '6" Dessert Plates',
      sku: 'SKU: PP-06-STD • 1000/Case',
      qty: 2,
      unit: 'Cases',
      image: IMG_DESSERT,
    },
    {
      name: 'Premium Napkins',
      sku: 'SKU: NP-PRM-WHT • 2000/Box',
      qty: 10,
      unit: 'Boxes',
      image: IMG_NAPKINS,
    },
  ],
}

const MAP_SPRINGFIELD =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCHeoM-fkAv-jcGxEncbMjqOkMSxut7lR6pc5pkUmhswiwsPi7sHDOJGxcN6_DLV-a2DezaUee96E0r7u3o1RjYXDV2iZpQbfdqPxlVLGLxkl8Aug76ylZ0omQF8tTX9E_BTnxSLRip6c_rmQPS8Wv9SbU_Xt_vk3S8OHgjy0PdCy7Dd1kP0G6S22xfW51WLdPwSDG89zc6AqsxWMm955iRdBfdomaCxm0R6Ss4dRDTDGS1HEKqHv2_-0p49PIIgZnfg3-qClgyZOv3'

export const dashboardCurrentTask = {
  stopId: 'green-earth',
  businessName: 'Green Earth Cafe',
  address: '123 Main St, Springfield',
  /** Destination for Google Maps (disambiguated Springfield). */
  mapsDestination: '123 Main St, Springfield, IL, USA',
  orderId: '#ORD-39201',
  itemsSummary: '5 Boxes (Plate Type A)',
  eta: '10:45 AM',
  mapImage: MAP_SPRINGFIELD,
}

export function getDeliveryDetail(stopId: string): DeliveryStopDetail {
  if (stopId === '9024') {
    return detail9024
  }

  if (stopId === 'green-earth') {
    return {
      ...detail9024,
      id: 'green-earth',
      deliveryNumber: '39201',
      customerName: 'Green Earth Cafe',
      podOrderLabel: '#ORD-39201',
      podSubtitle: 'Green Earth Cafe • 5 Items',
      addressLine1: '123 Main St',
      addressLine2: 'Springfield',
      mapsQuery: '123 Main St, Springfield, IL, USA',
      phone: '(555) 010-3920',
      contactLine: 'Receiving: Alex P.',
      arrivalWindow: 'Today, 10:30 AM - 11:30 AM',
      mapImage: MAP_SPRINGFIELD,
      driverNote: 'Ring the service bell at the kitchen entrance.',
      items: detail9024.items,
    }
  }

  const row = routeStops.find((s) => s.id === stopId)
  if (!row) return detail9024

  const parts = row.address.split(',').map((p) => p.trim())
  const addressLine1 = parts[0] ?? row.address
  const addressLine2 = parts.slice(1).join(', ')

  const mapsQuery = [addressLine1, addressLine2].filter(Boolean).join(', ') + ', USA'

  return {
    id: row.id,
    deliveryNumber: row.id,
    customerName: row.businessName,
    verified: false,
    addressLine1,
    addressLine2,
    mapsQuery,
    phone: '(555) 000-0000',
    contactLine: `${row.contactName} (${row.contactRole})`,
    arrivalWindow: `Today, near ${row.timeLabel}`,
    mapImage: MAP_SF,
    driverNote: row.note || 'Standard delivery to front desk.',
    podOrderLabel: row.orderId,
    podSubtitle: `${row.businessName} • 3 Items`,
    items: [
      {
        name: 'Wholesale paper goods',
        sku: 'Mixed SKU',
        qty: 1,
        unit: 'Pallet',
        image: IMG_PLATES,
      },
    ],
  }
}
