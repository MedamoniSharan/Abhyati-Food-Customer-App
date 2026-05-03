import { useState } from 'react'
import type { DeliveryStop } from '../../services/deliveryBackendApi'
import { formatInr } from '../../utils/currency'

type Props = {
  stops: DeliveryStop[]
  loading?: boolean
  onOpenStop: (stopId: string) => void
  onBackToDashboard: () => void
  onViewMap: () => void
  onNotify: (message: string) => void
}

const WEEK = [
  { day: 'Mon', date: 23 },
  { day: 'Tue', date: 24 },
  { day: 'Wed', date: 25 },
  { day: 'Thu', date: 26 },
  { day: 'Fri', date: 27 },
  { day: 'Sat', date: 28 },
]

export function AssignedDeliveriesScreen({ stops, loading, onOpenStop, onBackToDashboard, onViewMap, onNotify }: Props) {
  const [selectedDay, setSelectedDay] = useState(23)

  return (
    <>
      <header className="dd-header">
        <div className="dd-header-row">
          <button type="button" className="dd-icon-btn" aria-label="Back" onClick={onBackToDashboard}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1>Assigned Deliveries</h1>
          <button type="button" className="dd-icon-btn" aria-label="Search" onClick={() => onNotify('Search coming soon')}>
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" className="dd-icon-btn" aria-label="Previous month">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chevron_left
              </span>
            </button>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>October 2023</span>
            <button type="button" className="dd-icon-btn" aria-label="Next month">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                chevron_right
              </span>
            </button>
          </div>
          <div className="dd-week-strip">
            {WEEK.map(({ day, date }) => (
              <div key={date} className="dd-week-day">
                <span>{day}</span>
                <button
                  type="button"
                  className={selectedDay === date ? 'selected' : ''}
                  onClick={() => setSelectedDay(date)}
                >
                  {date}
                </button>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="dd-main">
        <div className="dd-stat-grid" style={{ marginBottom: 8 }}>
          <div className="dd-stat-card">
            <div className="dd-stat-label">
              <span className="material-symbols-outlined" style={{ fontSize: 20, background: '#f1f5f9', borderRadius: 8, padding: 4 }}>
                local_shipping
              </span>
              Total Stops
            </div>
            <p className="dd-stat-value">{stops.length}</p>
          </div>
          <div className="dd-stat-card">
            <div className="dd-stat-label">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, background: '#fff7ed', borderRadius: 8, padding: 4, color: 'var(--dd-accent)' }}
              >
                check_circle
              </span>
              Completed
            </div>
            <p className="dd-stat-value">{stops.filter((s) => s.statusTag.toLowerCase().includes('deliver')).length}</p>
          </div>
        </div>

        <div className="dd-section-title">
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Today&apos;s Route</h2>
          <button type="button" className="dd-link" onClick={onViewMap}>
            View Map
          </button>
        </div>

        {loading ? <p style={{ color: 'var(--dd-muted)' }}>Loading deliveries...</p> : null}
        {!loading && stops.length === 0 ? <p style={{ color: 'var(--dd-muted)' }}>No deliveries assigned.</p> : null}
        {stops.map((stop) => (
          <article key={stop.id} className={`dd-route-card ${stop.isNext ? 'next' : ''}`}>
            <div className="dd-route-inner">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <span className={`dd-tag ${stop.isNext ? 'orange' : 'gray'}`}>
                    {stop.statusTag} • {stop.timeLabel}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.25 }}>{stop.businessName}</h3>
                  <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: 'var(--dd-muted)', fontWeight: 600 }}>{stop.orderId}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '1.1rem', fontWeight: 700 }}>
                    {formatInr(stop.amount)}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--dd-muted)' }}>{stop.paymentLabel}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: stop.note ? 12 : 0 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--dd-muted)', fontSize: 20, marginTop: 2 }}>
                  location_on
                </span>
                <div>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>{stop.address}</p>
                  {stop.note ? <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--dd-muted)' }}>{stop.note}</p> : null}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--dd-border)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    color: 'var(--dd-muted)',
                  }}
                >
                  {stop.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>{stop.contactName}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--dd-muted)' }}>{stop.contactRole}</p>
                </div>
                {stop.isNext ? (
                  <button type="button" className="dd-accent-btn" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => onOpenStop(stop.id)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      play_arrow
                    </span>
                    Start
                  </button>
                ) : (
                  <button type="button" className="dd-muted-btn" onClick={() => onOpenStop(stop.id)}>
                    Details
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </main>
    </>
  )
}
