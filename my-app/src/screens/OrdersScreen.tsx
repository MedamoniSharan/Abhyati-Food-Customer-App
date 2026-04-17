import { useMemo, useState } from 'react'
import type { Order } from '../types/app'
import { OrderCard } from '../components/OrderCard'

type Props = {
  orders: Order[]
  onBackHome: () => void
  onTrackOrder: (order: Order) => void
  onViewDetails: (order: Order) => void
  onInvoice: (order: Order) => void
  onReorder: (order: Order) => void
  onQuickAddFromOrder: (order: Order) => void
}

export function OrdersScreen({
  orders,
  onBackHome,
  onTrackOrder,
  onViewDetails,
  onInvoice,
  onReorder,
  onQuickAddFromOrder,
}: Props) {
  const [tab, setTab] = useState<'active' | 'past'>('active')

  const visibleOrders = useMemo(() => {
    if (tab === 'active') return orders.filter((order) => order.status !== 'Delivered')
    return orders.filter((order) => order.status === 'Delivered')
  }, [orders, tab])

  return (
    <>
      <header className="top-header light-header">
        <div className="header-row centered-title">
          <button type="button" className="icon-btn" onClick={onBackHome}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1>My Orders</h1>
          <button type="button" className="icon-btn" onClick={() => setTab((t) => (t === 'active' ? 'past' : 'active'))}>
            <span className="material-symbols-outlined">filter_list</span>
          </button>
        </div>
      </header>

      <div className="tabs">
        <button type="button" className={tab === 'active' ? 'tab active' : 'tab'} onClick={() => setTab('active')}>
          Active Orders
        </button>
        <button type="button" className={tab === 'past' ? 'tab active' : 'tab'} onClick={() => setTab('past')}>
          Past Orders
        </button>
      </div>

      <main className="content orders-content">
        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onTrackOrder={onTrackOrder}
            onViewDetails={onViewDetails}
            onInvoice={onInvoice}
            onReorder={onReorder}
          />
        ))}

        {tab === 'past' && visibleOrders.length > 0 ? (
          <button
            type="button"
            className="btn btn-dark block"
            onClick={() => onQuickAddFromOrder(visibleOrders[0])}
          >
            Add Past Order to Cart
          </button>
        ) : null}

        {visibleOrders.length === 0 ? (
          <div className="empty-state">
            <h3>No orders in this tab</h3>
            <p>Orders will appear here once they are placed.</p>
          </div>
        ) : null}
      </main>
    </>
  )
}
