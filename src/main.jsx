import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Lock orientation to portrait on installed PWAs (no-op in browser)
if (screen?.orientation?.lock) {
  screen.orientation.lock('portrait').catch(() => {})
}

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  // Clear the index.html diagnostic timer — React mounted successfully.
  if (window.__clearDiagnosticTimer) window.__clearDiagnosticTimer()
} catch (e) {
  // Push the error onto the diagnostic queue and let the timer surface it.
  if (window.__appErrors) {
    window.__appErrors.push({
      t: 'mount-error',
      m: (e && e.message) || String(e),
      stack: (e && e.stack) || '',
    })
  }
  throw e
}
