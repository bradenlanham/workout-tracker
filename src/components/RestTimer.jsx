import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { playBeep } from '../utils/helpers'

export default function RestTimer() {
  const { settings, updateSettings, restEndTimestamp, setRestEndTimestamp } = useStore()
  const [expanded, setExpanded] = useState(false)
  const [customDuration, setCustomDuration] = useState(settings.restTimerDuration)
  const location = useLocation()

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
        playBeep()
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
  if (!isLogging) return null

  // ── Derived display values ─────────────────────────────────────────────────

  const currentTimeLeft = getTimeLeft()
  const pct = Math.round((currentTimeLeft / settings.restTimerDuration) * 100)
  const isAlmostDone = currentTimeLeft <= 10 && currentTimeLeft > 0
  const isDone = !isRunning && restEndTimestamp !== null && currentTimeLeft === 0
  const mm = Math.floor(currentTimeLeft / 60)
  const ss = String(currentTimeLeft % 60).padStart(2, '0')

  return (
    <div className="fixed bottom-16 right-3 z-50 flex flex-col items-end gap-2">
      {expanded && (
        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-xl w-52">
          <p className="text-xs text-gray-400 mb-2 font-medium">REST DURATION</p>
          <div className="flex gap-2 items-center">
            <input
              type="number"
              inputMode="numeric"
              value={customDuration}
              onChange={e => setCustomDuration(e.target.value)}
              className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-white text-center text-lg font-bold"
              min={10}
              max={600}
            />
            <span className="text-gray-400 text-sm">sec</span>
          </div>
          <div className="flex gap-2 mt-3">
            {[60, 90, 120, 180].map(d => (
              <button
                key={d}
                onClick={() => setCustomDuration(d)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  customDuration == d ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'
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

      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-700 text-gray-300 shadow"
          aria-label="Timer settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <button
          onClick={handleTap}
          className={`relative w-16 h-16 rounded-full shadow-lg flex flex-col items-center justify-center transition-colors font-bold ${
            isDone
              ? 'bg-green-500 text-white'
              : isAlmostDone
              ? 'bg-amber-500 text-white'
              : isRunning
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-200'
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
  )
}
