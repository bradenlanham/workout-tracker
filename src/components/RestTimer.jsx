import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { playBeep } from '../utils/helpers'

export default function RestTimer() {
  const { settings, updateSettings, restEndTimestamp, setRestEndTimestamp } = useStore()
  const [expanded, setExpanded] = useState(false)
  const [customDuration, setCustomDuration] = useState(settings.restTimerDuration)
  const [position, setPosition] = useState({ x: null, y: null })
  const dragRef = useRef(null)
  const dragStart = useRef(null)
  const location = useLocation()

  // Long-press settings access (1s hold opens the settings panel).
  // Replaces the inline gear button so the toolbar stays clean. A >10px
  // movement cancels the long-press so the outer drag path still wins when
  // the user is repositioning the timer.
  const longPressTimer = useRef(null)
  const longPressFired = useRef(false)
  const pressStartPos  = useRef(null)

  const beginLongPress = (x, y) => {
    longPressFired.current = false
    pressStartPos.current = { x, y }
    clearTimeout(longPressTimer.current)
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setExpanded(v => !v)
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try { navigator.vibrate(15) } catch { /* ignore */ }
      }
    }, 1000)
  }

  const movePressed = (x, y) => {
    if (!pressStartPos.current) return
    const dx = Math.abs(x - pressStartPos.current.x)
    const dy = Math.abs(y - pressStartPos.current.y)
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    pressStartPos.current  = null
  }

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    const rect = dragRef.current.getBoundingClientRect()
    dragStart.current = {
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    }
  }

  const handleTouchMove = (e) => {
    if (!dragStart.current) return
    e.preventDefault()
    const touch = e.touches[0]
    setPosition({
      x: touch.clientX - dragStart.current.offsetX,
      y: touch.clientY - dragStart.current.offsetY,
    })
  }

  const handleTouchEnd = () => {
    dragStart.current = null
  }

  // ── Compute timeLeft from stored timestamp ────────────────────────────────

  const getTimeLeft = useCallback(() => {
    if (!restEndTimestamp) return settings.restTimerDuration
    return Math.max(0, Math.ceil((restEndTimestamp - Date.now()) / 1000))
  }, [restEndTimestamp, settings.restTimerDuration])

  const isRunning = !!(restEndTimestamp && restEndTimestamp > Date.now())
  const timeLeft = getTimeLeft()

  // ── Tick every 500 ms to keep display accurate ────────────────────────────

  const [, tick] = useState(0)
  const tickRef = useRef(null)

  useEffect(() => {
    if (!isRunning) {
      clearInterval(tickRef.current)
      return
    }
    tickRef.current = setInterval(() => {
      const tl = Math.max(0, Math.ceil((restEndTimestamp - Date.now()) / 1000))
      tick(n => n + 1)
      if (tl <= 0) {
        clearInterval(tickRef.current)
        setRestEndTimestamp(null)
        if (settings.restTimerChime !== false) playBeep()
      }
    }, 500)
    return () => clearInterval(tickRef.current)
  }, [isRunning, restEndTimestamp]) // eslint-disable-line

  // ── Re-sync when app returns from background ──────────────────────────────

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) tick(n => n + 1)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // ── Sync customDuration display when setting changes ──────────────────────

  useEffect(() => {
    setCustomDuration(settings.restTimerDuration)
  }, [settings.restTimerDuration])

  // ── Controls ──────────────────────────────────────────────────────────────

  const start = useCallback((duration) => {
    setRestEndTimestamp(Date.now() + duration * 1000)
  }, [setRestEndTimestamp])

  const stop = useCallback(() => {
    setRestEndTimestamp(null)
  }, [setRestEndTimestamp])

  const reset = useCallback(() => {
    setRestEndTimestamp(null)
  }, [setRestEndTimestamp])

  const saveDuration = () => {
    const val = Math.max(10, Math.min(600, parseInt(customDuration) || 90))
    updateSettings({ restTimerDuration: val })
    setCustomDuration(val)
    setExpanded(false)
  }

  const handleTap = () => {
    const tl = getTimeLeft()
    if (isRunning) stop()
    else if (!restEndTimestamp || tl === 0) start(settings.restTimerDuration)
    else start(settings.restTimerDuration)
  }

  // ── Conditional render ────────────────────────────────────────────────────

  const isLogging = location.pathname.startsWith('/log/')
  // Batch 42 — hide the floating rest timer in HYROX mode per design doc §5.4.
  // HYROX gets its own gym-clock timer (B43) and a full-screen yellow rest
  // countdown between rounds (B44); the floating circle would be redundant
  // chrome layered behind the overlay.
  const isHyroxFlow = location.pathname.startsWith('/log/hyrox/')
  if (!isLogging || isHyroxFlow) return null

  // ── Derived display values ─────────────────────────────────────────────────

  const currentTimeLeft = getTimeLeft()
  const pct = Math.round((currentTimeLeft / settings.restTimerDuration) * 100)
  const isAlmostDone = currentTimeLeft <= 10 && currentTimeLeft > 0
  const isDone = !isRunning && restEndTimestamp !== null && currentTimeLeft === 0
  const mm = Math.floor(currentTimeLeft / 60)
  const ss = String(currentTimeLeft % 60).padStart(2, '0')

  return (
    <div
      ref={dragRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        ...(position.x !== null ? {
          left: position.x,
          top: position.y,
          right: 'auto',
          bottom: 'auto',
        } : {
          right: 16,
          top: 70,
        }),
        zIndex: 50,
        touchAction: 'none',
      }}
      className="flex flex-col items-end gap-2"
    >
      <div className="flex items-center gap-2">
        {/* Timer button — tap to start/stop, long-press (1s) for settings.
            Scales 1.5× while running (top-right anchored so it grows down+left
            into empty space rather than off-screen). The user-select + tap
            suppression attributes prevent iOS callout / text highlight on
            hold. */}
        <div
          style={{
            transition: 'transform 0.3s ease',
            transform: isRunning && timeLeft > 0 ? 'scale(1.5)' : 'scale(1)',
            transformOrigin: 'top right',
          }}
        >
          <button
            onClick={(e) => {
              if (longPressFired.current) {
                longPressFired.current = false
                e.preventDefault()
                e.stopPropagation()
                return
              }
              handleTap()
            }}
            onTouchStart={(e) => {
              const t = e.touches[0]
              beginLongPress(t.clientX, t.clientY)
            }}
            onTouchMove={(e) => {
              const t = e.touches[0]
              movePressed(t.clientX, t.clientY)
            }}
            onTouchEnd={cancelLongPress}
            onTouchCancel={cancelLongPress}
            onMouseDown={(e) => beginLongPress(e.clientX, e.clientY)}
            onMouseMove={(e) => movePressed(e.clientX, e.clientY)}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={isRunning ? 'Pause rest timer (long-press for settings)' : 'Start rest timer (long-press for settings)'}
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
            className={`relative w-16 h-16 rounded-full shadow-lg flex flex-col items-center justify-center transition-colors font-bold ${
              isDone
                ? 'bg-green-500 text-white'
                : isAlmostDone
                ? 'bg-amber-500 text-white'
                : isRunning
                ? 'bg-blue-500 text-white'
                : 'bg-item text-c-secondary'
            }`}
          >
            {/* Progress ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - Math.max(0, Math.min(100, pct)) / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="text-sm font-bold z-10">
              {isDone ? '✓' : `${mm}:${ss}`}
            </span>
            <span className="text-xs z-10 opacity-70">
              {isRunning ? 'REST' : isDone ? 'DONE' : 'TAP'}
            </span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-card border border-c-base rounded-2xl p-4 shadow-xl w-52">
          <p className="text-xs text-c-dim mb-2 font-medium">REST DURATION</p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              value={customDuration}
              onChange={e => setCustomDuration(e.target.value)}
              className="flex-1 bg-item rounded-lg px-3 py-2 text-c-primary text-center text-lg font-bold"
              min={10}
              max={600}
            />
            <span className="text-c-dim text-sm">sec</span>
          </div>
          <div className="flex gap-2 mt-3">
            {[60, 90, 120, 180].map(d => (
              <button
                key={d}
                onClick={() => setCustomDuration(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  customDuration == d ? 'bg-blue-500 text-white' : 'bg-item text-c-secondary'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
          <button
            onClick={saveDuration}
            className="w-full mt-3 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold"
          >
            Save
          </button>
        </div>
      )}
    </div>
  )
}
