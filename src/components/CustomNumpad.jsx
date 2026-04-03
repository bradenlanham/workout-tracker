import { useEffect, useRef, useCallback } from 'react'

// CustomNumpad – fully replaces the iOS system keyboard for reps/weight inputs.
// Props:
//   config  – { fieldKey, label, isDecimalAllowed, initialValue, onChange,
//               onNextSet, themeHex, themeContrastText }
//   isOpen  – boolean controlling slide animation
//   onClose – called when Done is pressed
export default function CustomNumpad({ config, isOpen, onClose }) {
  const currentValueRef  = useRef('')
  const longPressTimerRef = useRef(null)
  const longPressFiredRef = useRef(false)

  // Reset value buffer when switching to a new field
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
    if (!longPressFiredRef.current) handleBackspace()
  }, [handleBackspace])

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
  }, [])

  const handleNextSet = useCallback((e) => {
    e.preventDefault()
    config?.onNextSet?.()
  }, [config])

  const handleDone = useCallback((e) => {
    e.preventDefault()
    onClose()
    requestAnimationFrame(() => document.activeElement?.blur())
  }, [onClose])

  const themeColor        = config?.themeHex          || '#22c55e'
  const themeContrastText = config?.themeContrastText || '#0a0a0a'
  const decimalActive     = config?.isDecimalAllowed

  // Base style for digit keys
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
      {/* ── Action row ─────────────────────────────────────────────────
          Frosted/raised feel so it visually separates from the key grid */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Field label */}
        <span
          style={{
            flex: 1,
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {config?.label || ''}
        </span>

        {/* Next Set – secondary/outlined */}
        <button
          onPointerDown={handleNextSet}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.07)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 14,
            padding: '8px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.12)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          + Next Set
        </button>

        {/* Done – primary accent */}
        <button
          onPointerDown={handleDone}
          style={{
            backgroundColor: themeColor,
            color: themeContrastText,
            fontWeight: 700,
            fontSize: 14,
            padding: '8px 18px',
            borderRadius: 12,
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          Done ✓
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
        {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            style={digitStyle}
          >
            {k}
          </button>
        ))}

        {/* Decimal */}
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

        {/* 0 */}
        <button
          onPointerDown={e => { e.preventDefault(); handleKey('0') }}
          style={digitStyle}
        >
          0
        </button>

        {/* Backspace – short tap deletes last char, long press clears */}
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
