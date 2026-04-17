import { useState } from 'react'

type Props = {
  onNavigateOrders: () => void
  onOpenAddresses: () => string[]
  onOpenPayments: () => string[]
  onLogout: () => void
}

export function AccountScreen({ onNavigateOrders, onOpenAddresses, onOpenPayments, onLogout }: Props) {
  const [addresses, setAddresses] = useState<string[]>([])
  const [payments, setPayments] = useState<string[]>([])
  const [openSection, setOpenSection] = useState<'none' | 'addresses' | 'payments'>('none')

  function handleOpenAddresses() {
    setAddresses(onOpenAddresses())
    setOpenSection('addresses')
  }

  function handleOpenPayments() {
    setPayments(onOpenPayments())
    setOpenSection('payments')
  }

  return (
    <>
      <header className="top-header light-header">
        <div className="header-row centered-title">
          <div className="icon-btn" />
          <h1>Account</h1>
          <div className="icon-btn" />
        </div>
      </header>

      <main className="content">
        <section className="account-card">
          <div className="avatar">MS</div>
          <div>
            <h3>Mahesh Sharan</h3>
            <p>Procurement Manager, PlatePro Buyer</p>
          </div>
        </section>

        <div className="account-actions">
          <button type="button" className="btn btn-muted block" onClick={onNavigateOrders}>
            My Orders
          </button>
          <button type="button" className="btn btn-muted block" onClick={handleOpenAddresses}>
            Delivery Addresses
          </button>
          <button type="button" className="btn btn-muted block" onClick={handleOpenPayments}>
            Payment Methods
          </button>
          <button type="button" className="btn btn-dark block" onClick={onLogout}>
            Logout
          </button>
        </div>

        {openSection === 'addresses' ? (
          <section className="info-list-card">
            <h4>Saved Addresses</h4>
            {addresses.map((address) => (
              <p key={address}>{address}</p>
            ))}
          </section>
        ) : null}

        {openSection === 'payments' ? (
          <section className="info-list-card">
            <h4>Payment Methods</h4>
            {payments.map((method) => (
              <p key={method}>{method}</p>
            ))}
          </section>
        ) : null}
      </main>
    </>
  )
}
