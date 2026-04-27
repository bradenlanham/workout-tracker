import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { BB_WORKOUT_NAMES } from '../data/exercises'
import { toLocalDateStr } from '../utils/helpers'

// ── Constants ─────────────────────────────────────────────────────────────────

const BUILTIN_TYPES = ['Incline Treadmill', 'Treadmill', 'Stairmaster', 'Running', 'Walking', 'Assault Bike', 'Other']

const INTENSITIES = [
  { id: 'easy',     label: 'Easy' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'hard',     label: 'Hard' },
  { id: 'allout',   label: 'All Out' },
]

const INTENSITY_LABELS = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', allout: 'All Out' }

function getDistanceUnit(type) {
  if (['Running', 'Walking', 'Treadmill', 'Incline Treadmill'].includes(type)) return 'miles'
  if (type === 'Stairmaster') return 'floors'
  return null
}

function formatSeconds(total) {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function parseHMS(h, m, s) {
  return (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0)
}

function secondsToHMS(total) {
  const s = Math.max(0, Math.floor(total))
  return {
    h: String(Math.floor(s / 3600)),
    m: String(Math.floor((s % 3600) / 60)),
    s: String(s % 60),
  }
}

// ── Type Selection Screen ──────────────────────────────────────────────────────

function TypeScreen({ onSelect, onBack, theme, customCardioTypes }) {
  const [showOtherInput, setShowOtherInput] = useState(false)
  const [otherValue, setOtherValue] = useState('')

  // Custom types used more than once appear in grid; "Other" always present
  const displayTypes = [
    ...BUILTIN_TYPES.filter(t => t !== 'Other'),
    ...customCardioTypes,
    'Other',
  ]

  const handleOther = () => {
    if (otherValue.trim()) onSelect(otherValue.trim())
  }

  return (
    <div className="min-h-screen bg-base pb-12">
      <div className="sticky top-0 bg-base z-10 px-4 pt-12 pb-4">
        <button onClick={onBack} className="text-sm text-c-muted mb-4 block">← back</button>
        <h1 className="text-2xl font-bold">Log Cardio</h1>
        <p className="text-c-muted text-sm mt-1">What are you doing?</p>
      </div>

      <div className="px-4">
        <div className="grid grid-cols-3 gap-3">
          {displayTypes.map(type => (
            type === 'Other' ? (
              <button
                key="Other"
                onClick={() => setShowOtherInput(v => !v)}
                className="aspect-square rounded-2xl bg-card flex items-center justify-center text-sm font-semibold text-c-secondary"
              >
                Other
              </button>
            ) : (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className={`aspect-square rounded-2xl bg-card flex items-center justify-center text-sm font-semibold text-c-secondary hover:bg-item active:bg-item transition-colors`}
              >
                {type}
              </button>
            )
          ))}
        </div>

        {showOtherInput && (
          <div className="mt-4 bg-card rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-c-muted">Custom type</p>
            <input
              autoFocus
              type="text"
              value={otherValue}
              onChange={e => setOtherValue(e.target.value)}
              placeholder="e.g. Rowing, Jump Rope…"
              className="w-full bg-item text-c-primary rounded-xl px-4 py-3 text-base"
              onKeyDown={e => e.key === 'Enter' && otherValue.trim() && handleOther()}
            />
            <button
              onClick={handleOther}
              disabled={!otherValue.trim()}
              className={`w-full py-3 rounded-2xl font-bold ${theme.bg} text-white disabled:opacity-40`}
              style={{ color: theme.contrastText }}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Session Screen ─────────────────────────────────────────────────────────────

function SessionScreen({
  cardioType, onBack, onLogSession, onDiscard, theme,
  accumulatedSeconds, setAccumulatedSeconds,
  timerStartTimestamp, setTimerStartTimestamp,
  displaySeconds, setDisplaySeconds,
  distance, setDistance,
  intensity, setIntensity,
  minHR, setMinHR,
  maxHR, setMaxHR,
  notes, setNotes,
}) {
  const [showNotes, setShowNotes] = useState(!!notes)
  const [useManual, setUseManual] = useState(false)
  const [manualH, setManualH] = useState('')
  const [manualM, setManualM] = useState('')
  const [manualS, setManualS] = useState('')

  const isRunning = !!timerStartTimestamp
  const distanceUnit = getDistanceUnit(cardioType)

  // Live tick when running
  useEffect(() => {
    if (!timerStartTimestamp) return
    const id = setInterval(() => {
      setDisplaySeconds(Math.floor(accumulatedSeconds + (Date.now() - timerStartTimestamp) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [timerStartTimestamp, accumulatedSeconds]) // eslint-disable-line

  // Recalc on app return from background
  useEffect(() => {
    const handleVis = () => {
      if (!document.hidden && timerStartTimestamp) {
        setDisplaySeconds(Math.floor(accumulatedSeconds + (Date.now() - timerStartTimestamp) / 1000))
      }
    }
    document.addEventListener('visibilitychange', handleVis)
    return () => document.removeEventListener('visibilitychange', handleVis)
  }, [timerStartTimestamp, accumulatedSeconds]) // eslint-disable-line

  const toggleTimer = () => {
    if (isRunning) {
      const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000)
      const newAcc = accumulatedSeconds + elapsed
      setAccumulatedSeconds(newAcc)
      setDisplaySeconds(newAcc)
      setTimerStartTimestamp(null)
    } else {
      setTimerStartTimestamp(Date.now())
    }
  }

  const switchToManual = () => {
    // Pause if running
    if (isRunning) {
      const elapsed = Math.floor((Date.now() - timerStartTimestamp) / 1000)
      const newAcc = accumulatedSeconds + elapsed
      setAccumulatedSeconds(newAcc)
      setDisplaySeconds(newAcc)
      setTimerStartTimestamp(null)
      const hms = secondsToHMS(newAcc)
      setManualH(hms.h)
      setManualM(hms.m)
      setManualS(hms.s)
    } else {
      const hms = secondsToHMS(accumulatedSeconds)
      setManualH(hms.h)
      setManualM(hms.m)
      setManualS(hms.s)
    }
    setUseManual(true)
  }

  const switchToTimer = () => {
    const seconds = parseHMS(manualH, manualM, manualS)
    setAccumulatedSeconds(seconds)
    setDisplaySeconds(seconds)
    setUseManual(false)
  }

  const handleLog = () => {
    const duration = useManual
      ? parseHMS(manualH, manualM, manualS)
      : displaySeconds
    if (!duration) return
    onLogSession({ duration, distance, intensity, minHR, maxHR, notes })
  }

  const durationReady = useManual
    ? parseHMS(manualH, manualM, manualS) > 0
    : displaySeconds > 0

  return (
    <div className="min-h-screen bg-base" style={{ paddingBottom: '120px' }}>
      <div className="sticky top-0 bg-base z-10 px-4 pt-12 pb-3">
        <button onClick={onBack} className="text-sm text-c-muted mb-3 block">← back</button>
        <h1 className="text-xl font-bold">{cardioType}</h1>
      </div>

      <div className="px-4 space-y-4">

        {/* ── Timer / Duration ─────────────────────────────────── */}
        <div className="bg-card rounded-3xl p-6">
          {useManual ? (
            <>
              <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">Duration</p>
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="text-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={manualH}
                    onChange={e => setManualH(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-item text-c-primary rounded-xl px-2 py-2 text-center text-2xl font-bold"
                    min={0}
                  />
                  <p className="text-xs text-c-faint mt-1">h</p>
                </div>
                <span className="text-2xl font-bold text-c-muted pb-4">:</span>
                <div className="text-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={manualM}
                    onChange={e => setManualM(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-item text-c-primary rounded-xl px-2 py-2 text-center text-2xl font-bold"
                    min={0} max={59}
                  />
                  <p className="text-xs text-c-faint mt-1">min</p>
                </div>
                <span className="text-2xl font-bold text-c-muted pb-4">:</span>
                <div className="text-center">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={manualS}
                    onChange={e => setManualS(e.target.value)}
                    placeholder="0"
                    className="w-16 bg-item text-c-primary rounded-xl px-2 py-2 text-center text-2xl font-bold"
                    min={0} max={59}
                  />
                  <p className="text-xs text-c-faint mt-1">sec</p>
                </div>
              </div>
              <button onClick={switchToTimer} className={`w-full py-2.5 rounded-xl text-sm font-semibold ${theme.bg} text-white`} style={{ color: theme.contrastText }}>
                Use Timer
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-2">Duration</p>
              <p
                className="text-5xl font-mono font-bold text-center my-4 tracking-wider"
                style={{ color: isRunning ? theme.hex : undefined }}
              >
                {formatSeconds(displaySeconds)}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={toggleTimer}
                  className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-colors ${
                    isRunning
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : `${theme.bg} text-white`
                  }`}
                  style={!isRunning ? { color: theme.contrastText } : {}}
                >
                  {isRunning ? 'Stop' : displaySeconds > 0 ? 'Resume' : 'Start Timer'}
                </button>
                <button
                  onClick={switchToManual}
                  className="px-4 py-3 rounded-2xl bg-item text-c-dim text-sm font-semibold"
                >
                  Manual
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Distance (conditional) ──────────────────────────── */}
        {distanceUnit && (
          <div className="bg-card rounded-2xl p-4">
            <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-2">
              Distance ({distanceUnit}) — optional
            </p>
            <input
              type="number"
              inputMode="decimal"
              value={distance}
              onChange={e => setDistance(e.target.value)}
              placeholder={distanceUnit === 'floors' ? '0' : '0.0'}
              className="w-full bg-item text-c-primary rounded-xl px-4 py-3 text-lg font-semibold text-center"
              min={0}
            />
          </div>
        )}

        {/* ── Intensity ────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-4">
          <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">Intensity</p>
          <div className="flex gap-2">
            {INTENSITIES.map(lvl => (
              <button
                key={lvl.id}
                onClick={() => setIntensity(intensity === lvl.id ? null : lvl.id)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  intensity === lvl.id
                    ? `${theme.bg} text-white`
                    : 'bg-item text-c-dim'
                }`}
                style={intensity === lvl.id ? { color: theme.contrastText } : {}}
              >
                {lvl.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Heart Rate ───────────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-4">
          <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">Heart Rate — optional</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-xs text-c-faint mb-1.5 text-center">Min HR</p>
              <input
                type="number"
                inputMode="numeric"
                value={minHR}
                onChange={e => setMinHR(e.target.value)}
                placeholder="—"
                className="w-full bg-item text-c-primary rounded-xl px-3 py-2.5 text-base font-semibold text-center"
                min={0}
              />
            </div>
            <div className="flex-1">
              <p className="text-xs text-c-faint mb-1.5 text-center">Max HR</p>
              <input
                type="number"
                inputMode="numeric"
                value={maxHR}
                onChange={e => setMaxHR(e.target.value)}
                placeholder="—"
                className="w-full bg-item text-c-primary rounded-xl px-3 py-2.5 text-base font-semibold text-center"
                min={0}
              />
            </div>
          </div>
        </div>

        {/* ── Notes ────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl p-4">
          {showNotes ? (
            <>
              <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-2">Notes</p>
              <textarea
                autoFocus
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Zone 2, felt strong…"
                rows={3}
                className="w-full bg-item text-c-secondary rounded-xl px-3 py-2.5 text-sm placeholder-gray-400 resize-none"
              />
            </>
          ) : (
            <button
              onClick={() => setShowNotes(true)}
              className="w-full text-left text-sm text-c-muted font-semibold"
            >
              + Add a note
            </button>
          )}
        </div>
      </div>

      {/* ── Fixed footer ─────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        background: 'var(--bg-base, #121212)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 50,
        display: 'flex',
        gap: '8px',
      }}>
        <button
          onClick={onDiscard}
          style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', fontSize: '16px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleLog}
          disabled={!durationReady}
          style={{ flex: 2, padding: '14px', borderRadius: '12px', background: durationReady ? (theme?.hex || '#3B82F6') : 'rgba(255,255,255,0.2)', color: 'white', border: 'none', fontSize: '16px', fontWeight: '600', cursor: durationReady ? 'pointer' : 'not-allowed', opacity: durationReady ? 1 : 0.5 }}
        >
          Log Session
        </button>
      </div>
    </div>
  )
}

// ── Confirmation Screen ────────────────────────────────────────────────────────

function ConfirmScreen({ data, cardioType, onConfirm, onBack, onDiscard, theme }) {
  const distanceUnit = getDistanceUnit(cardioType)
  return (
    <div className="min-h-screen bg-base pb-12">
      <div className="px-4 pt-12 pb-4">
        <button onClick={onBack} className="text-sm text-c-muted mb-4 block">← go back</button>
        <h1 className="text-2xl font-bold mb-1">Session Summary</h1>
        <p className="text-c-muted text-sm">Review before saving.</p>
      </div>

      <div className="px-4">
        <div className="bg-card rounded-3xl p-5 space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl">
              🏃
            </div>
            <div>
              <p className="font-bold text-lg">{cardioType}</p>
              <p className="text-sm text-c-muted">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-item-dim rounded-xl p-3 text-center">
              <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Duration</p>
              <p className="text-lg font-bold font-mono">{formatSeconds(data.duration)}</p>
            </div>
            {data.distance && distanceUnit && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Distance</p>
                <p className="text-lg font-bold">{data.distance} {distanceUnit}</p>
              </div>
            )}
            {data.intensity && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Intensity</p>
                <p className="text-lg font-bold">{INTENSITY_LABELS[data.intensity] || data.intensity}</p>
              </div>
            )}
            {data.minHR && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Min HR</p>
                <p className="text-lg font-bold">{data.minHR} <span className="text-sm font-normal text-c-muted">bpm</span></p>
              </div>
            )}
            {data.maxHR && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Max HR</p>
                <p className="text-lg font-bold">{data.maxHR} <span className="text-sm font-normal text-c-muted">bpm</span></p>
              </div>
            )}
          </div>

          {data.notes && (
            <div className="bg-item-dim rounded-xl p-3">
              <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-c-secondary">{data.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 text-center">
          <button
            onClick={onConfirm}
            className={`w-full py-4 rounded-2xl font-bold text-lg ${theme.bg} text-white`}
            style={{ color: theme.contrastText }}
          >
            Confirm
          </button>
          <button
            onClick={onBack}
            className="w-full py-4 rounded-2xl font-semibold bg-item text-c-secondary"
          >
            Go Back
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-3 rounded-2xl text-red-400 font-semibold bg-red-500/10 border border-red-500/20"
          >
            Discard Session
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Attach Prompt ──────────────────────────────────────────────────────────────

function AttachScreen({ workoutSession, workoutName, onAttach, onKeepSeparate, onBack, onDiscard, theme }) {
  return (
    <div className="min-h-screen bg-base pb-12">
      <div className="px-4 pt-12 pb-4">
        <button onClick={onBack} className="text-sm text-c-muted mb-4 block">← go back</button>
      </div>
      <div className="flex items-center justify-center px-4">
        <div className="bg-card rounded-3xl p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <p className="text-2xl mb-3">🔗</p>
            <h2 className="text-xl font-bold mb-2">Attach to workout?</h2>
            <p className="text-c-muted text-sm">
              You also completed <span className="font-semibold text-c-secondary">{workoutName}</span> today. Attach this cardio session to that workout?
            </p>
          </div>
          <button
            onClick={onAttach}
            className={`w-full py-4 rounded-2xl font-bold ${theme.bg} text-white`}
            style={{ color: theme.contrastText }}
          >
            Attach
          </button>
          <button
            onClick={onKeepSeparate}
            className="w-full py-4 rounded-2xl font-semibold bg-item text-c-secondary"
          >
            Keep Separate
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-3 rounded-2xl text-red-400 font-semibold bg-red-500/10 border border-red-500/20"
          >
            Discard Session
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Attach Fallback (no workout found — save immediately without render side-effects) ──

function AttachFallback({ onFinish, onDiscard }) {
  useEffect(() => { onFinish() }, []) // eslint-disable-line
  return null
}

// ── Main CardioLogger ──────────────────────────────────────────────────────────

export default function CardioLogger() {
  const navigate = useNavigate()
  const location = useLocation()
  // When coming from BbLogger "Log Now", auto-attach to that workout session
  const attachToWorkoutId = location.state?.attachToWorkoutId || null

  const {
    sessions, settings, customCardioTypes,
    activeCardioSession, saveActiveCardioSession, clearActiveCardioSession,
    addCardioSession, addCustomCardioType, splits, activeSplitId,
  } = useStore()
  const theme = getTheme(settings.accentColor)

  const hasActive = !!activeCardioSession
  const [screen, setScreen] = useState(hasActive ? 'session' : 'type')
  const [cardioType, setCardioType] = useState(activeCardioSession?.type || null)

  // Timer state
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(activeCardioSession?.accumulatedSeconds || 0)
  const [timerStartTimestamp, setTimerStartTimestamp] = useState(activeCardioSession?.startTimestamp || null)
  const [displaySeconds, setDisplaySeconds] = useState(() => {
    if (!activeCardioSession) return 0
    if (activeCardioSession.startTimestamp) {
      return activeCardioSession.accumulatedSeconds + Math.floor((Date.now() - activeCardioSession.startTimestamp) / 1000)
    }
    return activeCardioSession.accumulatedSeconds || 0
  })

  // Session fields
  const [distance, setDistance] = useState(activeCardioSession?.distance || '')
  const [intensity, setIntensity] = useState(activeCardioSession?.intensity || null)
  const [minHR, setMinHR] = useState(activeCardioSession?.minHR || '')
  const [maxHR, setMaxHR] = useState(activeCardioSession?.maxHR || '')
  const [notes, setNotes] = useState(activeCardioSession?.notes || '')

  // Confirmed session data (between confirm screen and attach screen)
  const [pendingSession, setPendingSession] = useState(null)

  // Persist active session whenever relevant state changes
  useEffect(() => {
    if (screen !== 'session' || !cardioType) return
    saveActiveCardioSession({
      type: cardioType,
      accumulatedSeconds,
      startTimestamp: timerStartTimestamp,
      distance,
      intensity,
      minHR,
      maxHR,
      notes,
    })
  }, [screen, cardioType, accumulatedSeconds, timerStartTimestamp, distance, intensity, minHR, maxHR, notes]) // eslint-disable-line

  const handleTypeSelect = (type) => {
    setCardioType(type)
    setScreen('session')
  }

  const handleLogSession = ({ duration, distance: d, intensity: i, minHR: minH, maxHR: maxH, notes: n }) => {
    setPendingSession({
      type: cardioType,
      duration,
      distance: d ? parseFloat(d) : null,
      distanceUnit: getDistanceUnit(cardioType),
      intensity: i,
      minHR: minH ? parseInt(minH) : null,
      maxHR: maxH ? parseInt(maxH) : null,
      notes: n,
      // Batch 25 timezone-fix: store LOCAL date so an 8 PM entry on the east
      // coast lands on today, not tomorrow (UTC rolls over at 7-8 PM ET).
      date: toLocalDateStr(),
    })
    setScreen('confirm')
  }

  const handleConfirm = () => {
    // Coming from BbLogger "Log Now" — auto-attach, skip the prompt
    if (attachToWorkoutId) {
      saveCardioAndFinish(attachToWorkoutId)
      return
    }

    // Check if a workout was logged today (local date — Batch 25).
    const todayStr = toLocalDateStr()
    const todayWorkouts = sessions.filter(s => {
      const d = toLocalDateStr(s.date)
      return d === todayStr && s.mode === 'bb'
    })
    if (todayWorkouts.length > 0) {
      setScreen('attach')
    } else {
      saveCardioAndFinish(null)
    }
  }

  const saveCardioAndFinish = (attachedToSessionId) => {
    const session = {
      ...pendingSession,
      attachedToSessionId: attachedToSessionId || null,
    }
    addCardioSession(session)

    // Persist custom type if used more than once
    if (!BUILTIN_TYPES.includes(cardioType)) {
      addCustomCardioType(cardioType)
    }

    clearActiveCardioSession()
    navigate('/history')
  }

  const getTodayWorkoutName = () => {
    // Batch 25 timezone-fix: compare via local date so the "attach to today's
    // workout" flow works correctly for users west of UTC logging in evening.
    const todayStr = toLocalDateStr()
    const todayWorkout = sessions.find(s => {
      const d = toLocalDateStr(s.date)
      return d === todayStr && s.mode === 'bb'
    })
    if (!todayWorkout) return null
    const activeSplit = splits?.find(s => s.id === activeSplitId)
    const workout = activeSplit?.workouts?.find(w => w.id === todayWorkout.type)
    return { session: todayWorkout, name: workout?.name || BB_WORKOUT_NAMES[todayWorkout.type] || todayWorkout.type }
  }

  const todayWorkoutInfo = screen === 'attach' ? getTodayWorkoutName() : null

  const handleDiscard = () => {
    clearActiveCardioSession()
    navigate('/dashboard')
  }

  if (screen === 'type') {
    return (
      <TypeScreen
        onSelect={handleTypeSelect}
        onBack={() => navigate('/dashboard')}
        theme={theme}
        customCardioTypes={customCardioTypes}
      />
    )
  }

  if (screen === 'session') {
    return (
      <SessionScreen
        cardioType={cardioType}
        onBack={() => {
          setScreen('type')
          clearActiveCardioSession()
        }}
        onLogSession={handleLogSession}
        onDiscard={handleDiscard}
        theme={theme}
        accumulatedSeconds={accumulatedSeconds}
        setAccumulatedSeconds={setAccumulatedSeconds}
        timerStartTimestamp={timerStartTimestamp}
        setTimerStartTimestamp={setTimerStartTimestamp}
        displaySeconds={displaySeconds}
        setDisplaySeconds={setDisplaySeconds}
        distance={distance}
        setDistance={setDistance}
        intensity={intensity}
        setIntensity={setIntensity}
        minHR={minHR}
        setMinHR={setMinHR}
        maxHR={maxHR}
        setMaxHR={setMaxHR}
        notes={notes}
        setNotes={setNotes}
      />
    )
  }

  if (screen === 'confirm') {
    return (
      <ConfirmScreen
        data={pendingSession}
        cardioType={cardioType}
        onConfirm={handleConfirm}
        onBack={() => setScreen('session')}
        onDiscard={handleDiscard}
        theme={theme}
      />
    )
  }

  if (screen === 'attach' && todayWorkoutInfo) {
    return (
      <AttachScreen
        workoutSession={todayWorkoutInfo.session}
        workoutName={todayWorkoutInfo.name}
        onAttach={() => saveCardioAndFinish(todayWorkoutInfo.session.id)}
        onKeepSeparate={() => saveCardioAndFinish(null)}
        onBack={() => setScreen('confirm')}
        onDiscard={handleDiscard}
        theme={theme}
      />
    )
  }

  // Fallback: skip attach if no workout found (use effect to avoid render-time side effects)
  if (screen === 'attach') {
    return <AttachFallback onFinish={() => saveCardioAndFinish(null)} onDiscard={handleDiscard} />
  }

  return null
}
