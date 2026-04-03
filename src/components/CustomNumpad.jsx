import { useEffect, useRef, useCallback } from 'react'

// CustomNumpad – fully replaces the iOS system keyboard for reps/weight inputs.
// Props:
//   config  – { fieldKey, label, isDecimalAllowed, initialValue, onChange,
//               onNext, themeHex, themeContrastText }
//               onNext: weight field → focus reps; reps field → submit set & open next
//   isOpen  – boolean controlling slide animation
//   onClose – called when Done is pressed
export default function CustomNumpad({ config, isOpen, onClose }) {
  const currentValueRef   = useRef('')
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

  // "Next →": weight → focus reps; reps → submit set & open next row
  const handleNext = useCallback((e) => {
    e.preventDefault()
    config?.onNext?.()
  }, [config])

  const handleDone = useCallback((e) => {
    e.preventDefault()
    // Blur synchronously before closing so any browser-triggered refocus (e.g. Chrome/Safari
    // returning focus to the previously-focused element) is batched with the closeNumpad call.
    // Both state updates land in the same React flush; closeNumpad's false wins.
    document.activeElement?.blur()
    onClose()
  }, [onClose])

  const themeColor        = config?.themeHex          || '#22c55e'
  const themeContrastText = config?.themeContrastText || '#0a0a0a'
  const decimalActive     = config?.isDecimalAllowed

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
      {/* ── Action row – Liquid Glass panel ─────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)',
          backdropFilter: 'blur(24px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.35)',  // top-edge specular highlight
            'inset 0 -1px 0 rgba(0,0,0,0.20)',        // inner bottom shadow
            '0 4px 16px rgba(0,0,0,0.40)',             // outer drop shadow
          ].join(', '),
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

        {/* Next → – secondary outlined */}
        <button
          onPointerDown={handleNext}
          style={{
            backgroundColor: 'rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: 14,
            padding: '8px 18px',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.14)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          Next →
        </button>

        {/* Done ✓ – primary accent */}
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

        {/* Decimal – disabled (invisible) for Reps */}
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
