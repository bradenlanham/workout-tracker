import { Component } from 'react'

// Top-level error boundary. Wrap the route tree in App.jsx so any render
// error in any page component lands here instead of unmounting the whole
// app to a gray screen. Shows the error message + a Reload button + a
// link to /recovery.html so the user can export their data even if the
// crash is persistent.
//
// Why this exists: two render bugs in one day (missedYesterdayWorkout
// dangling ref + CreateExerciseModal Rules of Hooks violation) both
// manifested as "all the buttons are gone" because React, with no
// boundary above, unmounts the entire subtree on uncaught render errors.
// A boundary turns "data-loss-flavored panic" into "recoverable banner."
//
// Captured errors are also pushed onto window.__appErrors so the boot-time
// diagnostic in index.html (commit 7d46906) sees them when probed.

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    if (typeof window !== 'undefined') {
      window.__appErrors = window.__appErrors || []
      window.__appErrors.push({
        t: 'boundary',
        m: error?.message || String(error),
        stack: error?.stack || '',
        componentStack: info?.componentStack || '',
      })
    }
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload = () => {
    // Cache-bust query so iOS Safari fetches fresh HTML, not whatever
    // stale copy might have caused the crash.
    const bust = Date.now().toString(36)
    location.replace(location.origin + location.pathname + '?recover=' + bust + location.hash)
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error?.message || String(this.state.error)
    const stack = this.state.error?.stack || ''
    const compStack = this.state.info?.componentStack || ''

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0A0A0E',
          color: '#F9FAFB',
          padding: '32px 20px 80px',
          maxWidth: 640,
          margin: '0 auto',
          fontFamily: '-apple-system, system-ui, sans-serif',
          lineHeight: 1.55,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>
          The app hit an error and stopped rendering. Your data is still saved on this device — try reloading first.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <button
            onClick={this.handleReload}
            style={{
              background: '#EAB308',
              color: '#1A1A1A',
              fontWeight: 700,
              fontSize: 15,
              padding: '14px 18px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ↻ Reload (fresh copy)
          </button>
          <a
            href="/recovery.html"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: '#F9FAFB',
              fontWeight: 700,
              fontSize: 14,
              padding: '12px 18px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              textDecoration: 'none',
              textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            📦 Open data recovery page
          </a>
        </div>

        <details style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
          <summary style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', userSelect: 'none' }}>
            Diagnostic details (for support)
          </summary>
          <div style={{ fontFamily: 'ui-monospace, SF Mono, monospace', fontSize: 11, marginTop: 10, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
            <strong style={{ color: '#FBBF24' }}>Error:</strong>{' '}{msg}
            {stack && (
              <>
                {'\n\n'}<strong style={{ color: '#FBBF24' }}>Stack:</strong>{'\n'}{stack.slice(0, 1200)}
              </>
            )}
            {compStack && (
              <>
                {'\n\n'}<strong style={{ color: '#FBBF24' }}>Component tree:</strong>{compStack.slice(0, 800)}
              </>
            )}
          </div>
        </details>
      </div>
    )
  }
}
