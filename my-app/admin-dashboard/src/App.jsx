import { useMemo, useState } from 'react'
import { endpointGroups } from './endpoints'

const endpointItems = endpointGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))

function methodLabel(method) {
  return method === 'GET_BY_ID' ? 'GET (by id)' : method
}

function parseJsonSafe(value, fallback = {}) {
  if (!value.trim()) return fallback
  return JSON.parse(value)
}

function buildUrl(baseUrl, path, method, resourceId, queryParams) {
  let route = path
  if (method === 'GET_BY_ID') {
    if (!resourceId.trim()) throw new Error('Resource ID is required for GET by id')
    route = `${path}/${resourceId.trim()}`
  }

  const url = new URL(`${baseUrl.replace(/\/$/, '')}${route}`)
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value) === '') return
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState('http://localhost:3001')
  const [search, setSearch] = useState('')
  const [activeEndpoint, setActiveEndpoint] = useState(endpointItems[0])
  const [selectedMethod, setSelectedMethod] = useState(endpointItems[0].methods[0])
  const [resourceId, setResourceId] = useState('')
  const [queryInput, setQueryInput] = useState('{ "per_page": 20 }')
  const [bodyInput, setBodyInput] = useState('{}')
  const [responseText, setResponseText] = useState('No request sent yet.')
  const [status, setStatus] = useState({ label: 'Idle', tone: 'idle' })
  const [isLoading, setIsLoading] = useState(false)

  const filteredEndpoints = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return endpointItems
    return endpointItems.filter((item) => `${item.name} ${item.group} ${item.path}`.toLowerCase().includes(term))
  }, [search])

  function selectEndpoint(endpoint) {
    setActiveEndpoint(endpoint)
    setSelectedMethod(endpoint.methods[0])
  }

  async function handleSendRequest() {
    try {
      setIsLoading(true)
      setStatus({ label: 'Loading...', tone: 'idle' })
      setResponseText('Request in progress...')

      const queryParams = parseJsonSafe(queryInput, {})
      const bodyPayload = parseJsonSafe(bodyInput, {})
      const url = buildUrl(baseUrl, activeEndpoint.path, selectedMethod, resourceId, queryParams)
      const httpMethod = selectedMethod === 'GET_BY_ID' ? 'GET' : selectedMethod

      const init = { method: httpMethod, headers: {} }
      if (httpMethod === 'POST') {
        init.headers['Content-Type'] = 'application/json'
        init.body = JSON.stringify(bodyPayload)
      }

      const response = await fetch(url, init)
      const text = await response.text()
      let prettyText = text

      try {
        prettyText = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        // Keep response as-is
      }

      setResponseText(prettyText)
      setStatus({
        label: `${response.status} ${response.statusText}`,
        tone: response.ok ? 'ok' : 'error'
      })
    } catch (error) {
      setStatus({ label: 'Failed', tone: 'error' })
      setResponseText(error instanceof Error ? error.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyResponse() {
    await navigator.clipboard.writeText(responseText)
    setStatus({ label: 'Copied', tone: 'ok' })
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">AF</div>
          <div>
            <h1>Abhyati Admin</h1>
            <p>React Zoho Endpoint Console</p>
          </div>
        </div>

        <label className="field">
          <span>Backend Base URL</span>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>

        <label className="field">
          <span>Search endpoint</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Type module name..."
          />
        </label>

        <div className="endpoint-list">
          {filteredEndpoints.map((endpoint) => (
            <button
              key={endpoint.path}
              type="button"
              className={endpoint.path === activeEndpoint.path ? 'endpoint-item active' : 'endpoint-item'}
              onClick={() => selectEndpoint(endpoint)}
            >
              <h4>{endpoint.name}</h4>
              <p>
                {endpoint.group} - {endpoint.path}
              </p>
            </button>
          ))}
        </div>
      </aside>

      <main className="content">
        <header className="content-head">
          <h2>{activeEndpoint.name}</h2>
          <p>{activeEndpoint.group} endpoint</p>
        </header>

        <section className="panel">
          <div className="row">
            <label className="field">
              <span>Method</span>
              <select value={selectedMethod} onChange={(event) => setSelectedMethod(event.target.value)}>
                {activeEndpoint.methods.map((method) => (
                  <option key={method} value={method}>
                    {methodLabel(method)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field grow">
              <span>Path</span>
              <input value={activeEndpoint.path} readOnly />
            </label>
          </div>

          <label className="field">
            <span>ID (for /:id routes)</span>
            <input
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
              placeholder="Enter resource id when using GET by id"
            />
          </label>

          <label className="field">
            <span>Query Params (JSON)</span>
            <textarea rows={4} value={queryInput} onChange={(event) => setQueryInput(event.target.value)} />
          </label>

          <label className="field">
            <span>Body Payload (JSON for POST)</span>
            <textarea rows={8} value={bodyInput} onChange={(event) => setBodyInput(event.target.value)} />
          </label>

          <div className="actions">
            <button type="button" disabled={isLoading} onClick={handleSendRequest}>
              {isLoading ? 'Sending...' : 'Send Request'}
            </button>
            <button type="button" className="btn-secondary" onClick={handleCopyResponse}>
              Copy Response
            </button>
          </div>
        </section>

        <section className="panel output-panel">
          <div className="output-head">
            <h3>Response</h3>
            <span className={`status-pill ${status.tone}`}>{status.label}</span>
          </div>
          <pre>{responseText}</pre>
        </section>
      </main>
    </div>
  )
}
