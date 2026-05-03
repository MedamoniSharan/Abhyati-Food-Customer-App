import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuthUser } from '../../services/authApi'
import { DeliveryGoogleMap } from '../../components/DeliveryGoogleMap'
import { confirmDeliveryStop, getDeliveryStopDetail, getDeliveryStops, type DeliveryStop } from '../../services/deliveryBackendApi'
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
  const [stops, setStops] = useState<DeliveryStop[]>([])
  const [loadingStops, setLoadingStops] = useState(true)
  const [detailFromApi, setDetailFromApi] = useState<DeliveryStop | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const scannerVideoRef = useRef<HTMLVideoElement>(null)
  const scannerStreamRef = useRef<MediaStream | null>(null)

  function nextStopMapsQuery() {
    const stop = stops.find((s) => s.isNext) ?? stops[0]
    return stop?.mapsQuery || ''
  }

  function safePhoneNumber(phone: string) {
    return phone.replace(/[^\d+]/g, '')
  }

  function openUrl(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openNavigation(destination: string) {
    if (!destination.trim()) {
      onNotify('No destination available')
      return
    }
    // Public Google Maps directions URL (no private API key needed)
    openUrl(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`)
  }

  function callCustomer(phone: string) {
    const normalized = safePhoneNumber(phone)
    if (!normalized) {
      onNotify('Phone number not available')
      return
    }
    openUrl(`tel:${normalized}`)
  }

  function messageCustomer(phone: string) {
    const normalized = safePhoneNumber(phone)
    if (!normalized) {
      onNotify('Phone number not available')
      return
    }
    openUrl(`sms:${normalized}`)
  }

  async function openScanner() {
    setScannerError(null)
    setScannerOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      scannerStreamRef.current = stream
      if (scannerVideoRef.current) {
        scannerVideoRef.current.srcObject = stream
        await scannerVideoRef.current.play()
      }
    } catch {
      setScannerError('Camera permission denied or unavailable')
      onNotify('Camera permission is required to scan')
    }
  }

  function closeScanner() {
    scannerStreamRef.current?.getTracks().forEach((track) => track.stop())
    scannerStreamRef.current = null
    setScannerOpen(false)
  }

  useEffect(() => {
    let mounted = true
    setLoadingStops(true)
    getDeliveryStops()
      .then((data) => {
        if (!mounted) return
        setStops(data)
      })
      .catch(() => {
        if (!mounted) return
        onNotify('Could not load deliveries from Zoho Books')
      })
      .finally(() => {
        if (!mounted) return
        setLoadingStops(false)
      })
    return () => {
      mounted = false
    }
  }, [onNotify])

  useEffect(() => {
    if (!detailStopId) {
      setDetailFromApi(null)
      setLoadingDetail(false)
      return
    }
    setLoadingDetail(true)
    const direct = stops.find((stop) => stop.id === detailStopId)
    if (direct) {
      setDetailFromApi(direct)
      setLoadingDetail(false)
      return
    }
    let mounted = true
    getDeliveryStopDetail(detailStopId).then((stop) => {
      if (!mounted) return
      setDetailFromApi(stop)
      setLoadingDetail(false)
    })
    return () => {
      mounted = false
    }
  }, [detailStopId, stops])

  useEffect(() => () => closeScanner(), [])

  const detail = useMemo(() => detailFromApi, [detailFromApi])

  const podDetail = useMemo(() => {
    if (!podStopId) return null
    if (detail && detail.id === podStopId) return detail
    const stop = stops.find((s) => s.id === podStopId)
    if (stop) return stop
    return null
  }, [detail, podStopId, stops])

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
            onConfirm={async (recipient) => {
              if (!podDetail.id) return
              setConfirming(true)
              try {
                await confirmDeliveryStop(podDetail.id, recipient)
                onNotify('Delivery confirmed and synced to Zoho Books')
                setStops((prev) => prev.filter((s) => s.id !== podDetail.id))
                closeOverlays()
                setTab('deliveries')
              } catch {
                onNotify('Could not sync delivery confirmation')
              } finally {
                setConfirming(false)
              }
            }}
            onNotify={onNotify}
          />
          {confirming ? <p style={{ textAlign: 'center', marginTop: 12, color: 'var(--dd-muted)' }}>Syncing confirmation...</p> : null}
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
            onStartNavigation={() => openNavigation(detail.mapsQuery)}
            onOpenProof={() => setPodStopId(detail.id)}
            onOpenAddress={() => openNavigation(detail.mapsQuery)}
            onMessage={() => messageCustomer(detail.phone)}
            onCall={() => callCustomer(detail.phone)}
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
            currentStop={stops.find((s) => s.isNext) ?? stops[0] ?? null}
            totalStops={stops.length}
            completedStops={stops.filter((s) => s.statusTag.toLowerCase().includes('deliver')).length}
            onStartNavigation={() => {
              const stop = stops.find((s) => s.isNext) ?? stops[0]
              if (!stop) {
                onNotify('No active delivery')
                return
              }
              openNavigation(stop.mapsQuery)
            }}
            onCallCurrent={() => {
              const stop = stops.find((s) => s.isNext) ?? stops[0]
              if (!stop) {
                onNotify('No active delivery')
                return
              }
              callCustomer(stop.phone)
            }}
            onViewAllDeliveries={() => setTab('deliveries')}
            onNotify={onNotify}
          />
        ) : null}
        {tab === 'deliveries' ? (
          <AssignedDeliveriesScreen
            stops={stops}
            loading={loadingStops}
            onOpenStop={(id) => setDetailStopId(id)}
            onBackToDashboard={() => setTab('dashboard')}
            onViewMap={() => {
              const query = nextStopMapsQuery()
              if (!query) {
                onNotify('No route available')
                return
              }
              setRouteMapQuery(query)
            }}
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
      <DeliveryBottomNav active={tab} onChange={setTab} onScan={openScanner} />

      {scannerOpen ? (
        <div className="dd-scanner-overlay" role="dialog" aria-modal="true" aria-label="Scanner">
          <header className="dd-header">
            <div className="dd-header-row">
              <button type="button" className="dd-icon-btn" aria-label="Close scanner" onClick={closeScanner}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <h1>Scan QR</h1>
              <span style={{ width: 40 }} aria-hidden />
            </div>
          </header>
          <div className="dd-scanner-video-wrap">
            <video ref={scannerVideoRef} className="dd-scanner-video" playsInline muted autoPlay />
            <div className="dd-scanner-frame" aria-hidden />
          </div>
          <footer className="dd-footer-fixed">
            <button type="button" className="dd-accent-btn" onClick={closeScanner}>
              Done
            </button>
            {scannerError ? <p style={{ margin: '10px 0 0', color: '#b91c1c', fontSize: '0.85rem' }}>{scannerError}</p> : null}
          </footer>
        </div>
      ) : null}

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

      {(loadingStops || loadingDetail || confirming) ? (
        <div className="dd-loader-overlay" aria-live="polite">
          <div className="dd-loader-card">
            <span className="dd-loader-spin" aria-hidden />
            {confirming ? 'Syncing delivery...' : 'Loading...'}
          </div>
        </div>
      ) : null}
    </div>
  )
}
