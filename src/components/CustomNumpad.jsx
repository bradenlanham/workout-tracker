import { useEffect, useRef, useCallback } from 'react'

// CustomNumpad – fully replaces the iOS system keyboard for reps/weight inputs.
// Props:
//   config    – { fieldKey, label, isDecimalAllowed, initialValue, onChange, onNext, isLastField, themeHex }
//   isOpen    – boolean controlling slide animation
//   onClose   – called when Done is pressed
export default function CustomNumpad({ config, isOpen, onClose }) {
  // Tracks the current typed value without causing re-renders on every keystroke.
  // Synced to config.initialValue whenever the active field changes.
  const currentValueRef = useRef('')

  // Long-press backspace to clear the field
  const longPressTimerRef = useRef(null)
  const longPressFiredRef = useRef(false)

  // Reset the value buffer whenever we switch to a new field (fieldKey changes)
  useEffect(() => {
    if (config) {
      currentValueRef.current = config.initialValue || ''
    }
  }, [config?.fieldKey])

  const handleKey = useCallback((key) => {
    if (!config) return
    const current = currentValueRef.current
    let newValue = current

    if (key === '.') {
      if (!config.isDecimalAllowed || current.includes('.')) return
      newValue = current === '' ? '0.' : current + '.'
    } else {
      if (current.length >= 7) return
      newValue = current + key
    }

    currentValueRef.current = newValue
    config.onChange(newValue)
  }, [config])

  const handleBackspace = useCallback(() => {
    if (!config) return
    const newValue = currentValueRef.current.slice(0, -1)
    currentValueRef.current = newValue
    config.onChange(newValue)
  }, [config])

  const handleClear = useCallback(() => {
    if (!config) return
    currentValueRef.current = ''
    config.onChange('')
  }, [config])

  const startLongPress = useCallback((e) => {
    e.preventDefault()
    longPressFiredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      handleClear()
    }, 500)
  }, [handleClear])

  const endLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
    if (!longPressFiredRef.current) {
      handleBackspace()
    }
  }, [handleBackspace])

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
  }, [])

  const handleNext = useCallback((e) => {
    e.preventDefault()
    config?.onNext?.()
  }, [config])

  const handleDone = useCallback((e) => {
    e.preventDefault()
    onClose()
    // Blur whichever input is focused so there's no ghost cursor
    requestAnimationFrame(() => document.activeElement?.blur())
  }, [onClose])

  const themeColor = config?.themeHex || '#22c55e'

  // Digit key style
  const digitStyle = {
    height: 56,
    borderRadius: 12,
    backgroundColor: 'var(--bg-item)',
    color: 'var(--text-primary)',
    fontSize: 22,
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  }

  const decimalActive = config?.isDecimalAllowed

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        transform: isOpen ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        pointerEvents: isOpen ? 'auto' : 'none',
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border-subtle)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* ── Action row ──────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {config?.label || ''}
        </span>
        <button
          onPointerDown={config?.isLastField ? handleDone : handleNext}
          style={{
            backgroundColor: themeColor,
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            padding: '9px 22px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          {config?.isLastField ? 'Done ✓' : 'Next →'}
        </button>
      </div>

      {/* ── Key grid ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          padding: '10px 12px 12px',
        }}
      >
        {/* Row 1: 7 8 9 */}
        {['7', '8', '9'].map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            style={digitStyle}
          >
            {k}
          </button>
        ))}

        {/* Row 2: 4 5 6 */}
        {['4', '5', '6'].map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            style={digitStyle}
          >
            {k}
          </button>
        ))}

        {/* Row 3: 1 2 3 */}
        {['1', '2', '3'].map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            style={digitStyle}
          >
            {k}
          </button>
        ))}

        {/* Row 4: decimal  0  ⌫ */}
        <button
          onPointerDown={e => { e.preventDefault(); if (decimalActive) handleKey('.') }}
          style={{
            ...digitStyle,
            backgroundColor: decimalActive ? 'var(--bg-item)' : 'transparent',
            color: decimalActive ? 'var(--text-secondary)' : 'var(--text-faint)',
            fontSize: 26,
            cursor: decimalActive ? 'pointer' : 'default',
          }}
        >
          {decimalActive ? '.' : ''}
        </button>

        <button
          onPointerDown={e => { e.preventDefault(); handleKey('0') }}
          style={digitStyle}
        >
          0
        </button>

        <button
          onPointerDown={startLongPress}
          onPointerUp={endLongPress}
          onPointerLeave={cancelLongPress}
          onPointerCancel={cancelLongPress}
          style={{ ...digitStyle, color: 'var(--text-secondary)', fontSize: 20 }}
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
