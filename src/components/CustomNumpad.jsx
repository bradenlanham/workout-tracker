import { useEffect, useRef, useCallback } from 'react'

// CustomNumpad – fully replaces the iOS system keyboard for reps/weight inputs.
// Props:
//   config  – { fieldKey, label, isDecimalAllowed, initialValue, onChange,
//               onNext, onDone, themeHex, themeContrastText }
//               onNext: weight field → focus reps; reps field → submit set & open next
//               onDone: marks the exercise as completed (called before closing numpad)
//   isOpen  – boolean controlling slide animation
//   onClose – called to dismiss the numpad (blur + slide away)
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

    if (current.length >= 7) return
    newValue = current + key

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
  // Pass the current numpad value so the callback has the freshest data
  // (React state may not have flushed yet when onNext fires)
  const handleNext = useCallback((e) => {
    e.preventDefault()
    config?.onNext?.(currentValueRef.current)
  }, [config])

  // "Done ✓": marks the exercise as completed, then closes the numpad
  const handleDone = useCallback((e) => {
    e.preventDefault()
    config?.onDone?.()
    document.activeElement?.blur()
    onClose()
  }, [config, onClose])

  // "Hide ↓": just closes the numpad without marking done
  const handleHide = useCallback((e) => {
    e.preventDefault()
    document.activeElement?.blur()
    onClose()
  }, [onClose])

  const themeColor        = config?.themeHex          || '#22c55e'
  const themeContrastText = config?.themeContrastText || '#0a0a0a'

  const digitStyle = {
    height: 44,
    borderRadius: 10,
    backgroundColor: 'var(--bg-item)',
    color: 'var(--text-primary)',
    fontSize: 20,
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
      // Swallow click events so delayed clicks from pointerdown-driven buttons
      // don't bleed through to elements repositioned behind the numpad after a
      // React re-render (e.g. the "Tap to show all exercises" zone).
      onClick={e => { e.preventDefault(); e.stopPropagation() }}
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
      {/* ── Action row ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
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

        {/* Done ✓ – primary accent — marks exercise as completed + closes numpad */}
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

      {/* ── Key grid (compact) ────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 6,
          padding: '6px 12px 10px',
        }}
      >
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(k => (
          <button
            key={k}
            onPointerDown={e => { e.preventDefault(); handleKey(k) }}
            style={digitStyle}
          >
            {k}
          </button>
        ))}

        {/* Bottom-left: Hide ⌄ — always, for both weight and reps */}
        <button
          onPointerDown={handleHide}
          style={{
            ...digitStyle,
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 600,
            gap: 4,
          }}
        >
          Hide
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ marginLeft: 2 }}>
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          style={{ ...digitStyle, color: 'var(--text-secondary)', fontSize: 18 }}
        >
          ⌫
        </button>
      </div>
    </div>
  )
}
