import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Lock orientation to portrait on installed PWAs (no-op in browser)
if (screen?.orientation?.lock) {
  screen.orientation.lock('portrait').catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
