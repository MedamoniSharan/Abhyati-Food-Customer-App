import { useMemo, useState } from 'react'
import type { AuthUser } from '../../services/authApi'
import { DeliveryGoogleMap } from '../../components/DeliveryGoogleMap'
import { dashboardCurrentTask, getDeliveryDetail, routeStops } from '../../data/deliveryMockData'
import { AssignedDeliveriesScreen } from './AssignedDeliveriesScreen'
import { DeliveryBottomNav, type DriverTab } from './DeliveryBottomNav'
import { DeliveryDashboardScreen } from './DeliveryDashboardScreen'
import { DeliveryDetailScreen } from './DeliveryDetailScreen'
import { ProofOfDeliveryScreen } from './ProofOfDeliveryScreen'

type Props = {
  user: AuthUser
  onLogout: () => void
  onNotify: (message: string) => void
}

export function DeliveryDriverApp({ user, onLogout, onNotify }: Props) {
  const [tab, setTab] = useState<DriverTab>('dashboard')
  const [detailStopId, setDetailStopId] = useState<string | null>(null)
  const [podStopId, setPodStopId] = useState<string | null>(null)
  const [routeMapQuery, setRouteMapQuery] = useState<string | null>(null)

  function nextStopMapsQuery() {
    const stop = routeStops.find((s) => s.isNext) ?? routeStops[0]
    return `${stop.address}, USA`
  }

  const detail = useMemo(() => (detailStopId ? getDeliveryDetail(detailStopId) : null), [detailStopId])
  const podDetail = useMemo(() => (podStopId ? getDeliveryDetail(podStopId) : null), [podStopId])

  function closeOverlays() {
    setDetailStopId(null)
    setPodStopId(null)
  }

  if (podDetail) {
    return (
      <div className="driver-app">
        <div className="driver-phone-frame">
          <ProofOfDeliveryScreen
            detail={podDetail}
            onBack={() => setPodStopId(null)}
            onConfirm={() => {
              onNotify('Delivery confirmed')
              closeOverlays()
              setTab('deliveries')
            }}
            onNotify={onNotify}
          />
        </div>
      </div>
    )
  }

  if (detail) {
    return (
      <div className="driver-app">
        <div className="driver-phone-frame">
          <DeliveryDetailScreen
            detail={detail}
            onBack={() => setDetailStopId(null)}
            onStartNavigation={() => onNotify('Navigation started (demo)')}
            onOpenProof={() => setPodStopId(detail.id)}
            onNotify={onNotify}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="driver-app">
      <div className="driver-phone-frame">
        {tab === 'dashboard' ? (
          <DeliveryDashboardScreen
            onStartNavigation={() => setDetailStopId(dashboardCurrentTask.stopId)}
            onViewAllDeliveries={() => setTab('deliveries')}
            onNotify={onNotify}
          />
        ) : null}
        {tab === 'deliveries' ? (
          <AssignedDeliveriesScreen
            onOpenStop={(id) => setDetailStopId(id)}
            onBackToDashboard={() => setTab('dashboard')}
            onViewMap={() => setRouteMapQuery(nextStopMapsQuery())}
            onNotify={onNotify}
          />
        ) : null}
        {tab === 'history' ? (
          <>
            <header className="dd-header">
              <div className="dd-header-row">
                <h1>History</h1>
              </div>
            </header>
            <main className="dd-main">
              <div className="dd-card" style={{ padding: 16 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Office Supply Co.</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', color: 'var(--dd-muted)' }}>Delivered at 9:15 AM</p>
              </div>
            </main>
          </>
        ) : null}
        {tab === 'profile' ? (
          <>
            <header className="dd-header">
              <div className="dd-header-row">
                <h1>Profile</h1>
              </div>
            </header>
            <main className="dd-main">
              <div className="dd-card" style={{ padding: 20 }}>
                <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--dd-muted)' }}>SIGNED IN AS</p>
                <p style={{ margin: '8px 0 0', fontSize: '1.2rem', fontWeight: 700 }}>{user.fullName}</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--dd-muted)' }}>{user.email}</p>
                <p style={{ margin: '14px 0 0', fontSize: '0.8rem', color: 'var(--dd-muted)' }}>Delivery driver</p>
              </div>
              <button type="button" className="dd-accent-btn" style={{ marginTop: 20, background: '#0f172a', boxShadow: 'none' }} onClick={onLogout}>
                Log out
              </button>
            </main>
          </>
        ) : null}
      </div>
      <DeliveryBottomNav active={tab} onChange={setTab} onScan={() => onNotify('QR scanner (demo)')} />

      {routeMapQuery ? (
        <div className="dd-map-overlay" role="dialog" aria-modal="true" aria-label="Route map">
          <header className="dd-header">
            <div className="dd-header-row">
              <button type="button" className="dd-icon-btn" aria-label="Close map" onClick={() => setRouteMapQuery(null)}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h1>Today&apos;s route</h1>
              <span style={{ width: 40 }} aria-hidden />
            </div>
          </header>
          <div className="dd-map-overlay-body">
            <DeliveryGoogleMap destination={routeMapQuery} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
