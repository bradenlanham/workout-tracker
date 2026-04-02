import { useState, useMemo } from 'react'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { formatDate, formatTime } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI } from '../data/exercises'
import ShareCard from './log/ShareCard'

const SORENESS_LABELS = {
  notsore:  'Not Sore',
  sore:     'Sore',
  verysore: 'Very Sore',
  wrecked:  'Wrecked',
}

const INTENSITY_LABELS = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard', allout: 'All Out' }

function formatCardioTime(totalSeconds) {
  if (!totalSeconds) return '—'
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}
// ── Calendar heatmap ───────────────────────────────────────────────────────────

const GRADE_COLORS = {
  'A+': null,       // filled in at render time from theme.hex
  'A':  '#10b981',
  'B':  '#f59e0b',
  'C':  '#ef4444',
  'D':  '#7f1d1d',
}
const GRADE_ORDER = { 'A+': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4 }

function CalendarHeatmap({ sessions, onSelectSession, themeHex, backgroundTheme }) {
  const WEEKS = 13   // ~3 months

  const isDaylight = backgroundTheme === 'daylight'
  const cellEmpty   = isDaylight ? '#e0e0e0' : '#1f2937'
  const cellFuture  = isDaylight ? '#f5f5f5' : '#111827'
  const cellNoGrade = isDaylight ? '#b8b8b8' : '#374151'

  // Build the grid starting from Monday of the oldest week
  const today    = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }, [])
  const gridStart = useMemo(() => {
    const daysToMonday = (today.getDay() + 6) % 7  // 0 on Mon, 6 on Sun
    const d = new Date(today)
    d.setDate(today.getDate() - daysToMonday - (WEEKS - 1) * 7)
    d.setHours(0, 0, 0, 0)
    return d
  }, [today])

  // Map date string → sessions
  const sessionsByDate = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const key = new Date(s.date).toDateString()
      if (!map[key]) map[key] = []
      map[key].push(s)
    })
    return map
  }, [sessions])

  // Build WEEKS × 7 grid
  const grid = useMemo(() => {
    const weeks = []
    const cur   = new Date(gridStart)
    for (let w = 0; w < WEEKS; w++) {
      const week = []
      for (let d = 0; d < 7; d++) {
        const date       = new Date(cur)
        const daySessions = sessionsByDate[date.toDateString()] || []
        week.push({
          date,
          daySessions,
          isToday:    date.toDateString() === new Date().toDateString(),
          inFuture:   date > today,
        })
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(week)
    }
    return weeks
  }, [gridStart, sessionsByDate, today])

  const getCellColor = (cell) => {
    if (cell.inFuture)           return cellFuture
    if (!cell.daySessions.length) return cellEmpty
    const best = [...cell.daySessions]
      .filter(s => s.grade && GRADE_ORDER[s.grade] !== undefined)
      .sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade])[0]
    if (!best) return cellNoGrade                      // session but no grade
    if (best.grade === 'A+') return themeHex
    return GRADE_COLORS[best.grade]
  }

  const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div className="bg-card rounded-2xl p-4 mb-5">
      <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">Activity</p>

      <div className="flex gap-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 shrink-0 mr-0.5">
          {DOW.map((label, i) => (
            <div key={i} className="h-5 w-4 flex items-center justify-center">
              <span className="text-xs text-c-faint">{label}</span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        {grid.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((cell, di) => (
              <button
                key={di}
                onClick={() => cell.daySessions.length > 0 && onSelectSession(cell.daySessions[0].id)}
                disabled={cell.daySessions.length === 0 || cell.inFuture}
                title={
                  cell.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
                  (cell.daySessions.length > 0 ? ` · ${cell.daySessions.length} session${cell.daySessions.length > 1 ? 's' : ''}` : '')
                }
                className={`h-5 w-full rounded-sm transition-opacity ${
                  cell.isToday ? 'ring-1 ring-white/50 ring-offset-1 ring-offset-card' : ''
                }`}
                style={{ backgroundColor: getCellColor(cell) }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Grade legend */}
      <div className="flex items-center gap-x-3 gap-y-1.5 mt-3 flex-wrap">
        <span className="text-xs text-c-faint">Grade:</span>
        {[
          { label: 'A+', color: themeHex },
          { label: 'A',  color: '#10b981' },
          { label: 'B',  color: '#f59e0b' },
          { label: 'C',  color: '#ef4444' },
          { label: 'D',  color: '#7f1d1d' },
          { label: '—',  color: cellNoGrade },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs text-c-muted">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Session detail modal ───────────────────────────────────────────────────────

function buildShareData(session, settings, theme, splits) {
  const exercises = session.data?.exercises || []
  const totalVolume = exercises.reduce((t, ex) =>
    t + ex.sets.reduce((s, set) => s + (set.reps || 0) * (set.weight || 0), 0), 0)
  const totalSets = exercises.reduce((t, ex) =>
    t + ex.sets.filter(s => s.reps || s.weight).length, 0)
  const totalPRs = exercises.reduce((t, ex) =>
    t + ex.sets.filter(s => s.isNewPR).length, 0)
  const exerciseSummary = [...exercises]
    .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
    .map(ex => ({
      name: ex.name,
      sets: ex.sets,
      hasPR: ex.sets.some(s => s.isNewPR),
      notes: ex.notes,
    }))
  const totalMinutes = session.duration || 0
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const durationStr = h > 0 ? `${h}h ${m}m` : `${m}m`
  const dateStr = new Date(session.date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })
  return {
    userName: settings.userName || '',
    workoutName: resolveWorkoutName(session.type, splits),
    workoutEmoji: resolveWorkoutEmoji(session.type, splits),
    dateStr,
    durationStr,
    totalVolume,
    totalSets,
    totalPRs,
    exerciseSummary,
    grade: session.grade,
    cardio: session.cardio || { completed: session.completedCardio || false },
    theme,
  }
}

function Stat({ label, value }) {
  return (
    <div className="bg-item-dim rounded-xl p-3 text-center">
      <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function SessionDetail({ session, onClose, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const { settings, updateSession, cardioSessions, splits } = useStore()
  const theme = getTheme(settings.accentColor)
  const d        = session.data || {}
  const isBb     = session.mode === 'bb'
  const sessionName  = resolveWorkoutName(session.type, splits)
  const sessionEmoji = resolveWorkoutEmoji(session.type, splits)

  // Find any cardio session attached to this strength session
  const attachedCardio = cardioSessions?.find(c => c.attachedToSessionId === session.id)

  if (showShareCard) {
    return (
      <ShareCard
        data={buildShareData(session, settings, theme, splits)}
        onDone={() => setShowShareCard(false)}
        sessionId={session.id}
        onUpdateSession={updateSession}
        initialSelfie={session.selfie || null}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-end">
        <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5 pb-10" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top, 1.25rem))' }} onClick={e => e.stopPropagation()}>

          {/* Selfie */}
          {session.selfie && (
            <img
              src={session.selfie}
              alt="Workout selfie"
              className="w-full mb-4"
              style={{ borderRadius: 12, maxHeight: 280, objectFit: 'contain', backgroundColor: 'rgba(0,0,0,0.2)' }}
            />
          )}

          <div className="flex items-start gap-3 mb-4">
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-item text-c-dim shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h2 className="text-xl font-bold">{sessionEmoji} {sessionName}</h2>
              <p className="text-sm text-c-dim">{formatDate(session.date)} · {formatTime(session.date)}</p>
              {session.duration && <p className="text-xs text-c-muted">{session.duration} min session</p>}
              <div className="flex items-center gap-2 mt-1">
                {session.grade && (
                  <span className="text-xs font-bold bg-item px-2 py-0.5 rounded-lg">{session.grade}</span>
                )}
                {session.completedCardio === true && (
                  <span className="text-xs text-emerald-400 font-semibold">Cardio ✓</span>
                )}
                {session.soreness?.rating && (
                  <span className="text-xs font-semibold bg-item px-2 py-0.5 rounded-lg text-c-secondary">
                    {SORENESS_LABELS[session.soreness.rating] || session.soreness.rating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* BB exercises */}
          {isBb && d.exercises && (
            <div className="space-y-3">
              {d.exercises.map((ex, i) => (
                <div key={i} className="bg-item-dim rounded-2xl p-3">
                  <p className="font-semibold mb-2">{ex.name}</p>
                  <div className="space-y-1">
                    {ex.sets.map((s, si) => (
                      <div key={si} className="flex items-center gap-2 text-sm text-c-secondary">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          s.type === 'warmup' ? 'bg-amber-500/30 text-amber-400'
                          : s.type === 'drop' ? 'bg-orange-500/30 text-orange-400'
                          : 'bg-blue-500/30 text-blue-400'
                        }`}>
                          {s.type === 'warmup' ? 'Warm' : s.type === 'drop' ? 'Drop' : 'Work'}
                        </span>
                        <span>{s.reps} reps × {s.weight} lbs</span>
                        {s.isNewPR && <span className="text-amber-400 text-xs">🏆 PR</span>}
                      </div>
                    ))}
                  </div>
                  {ex.notes && <p className="text-xs text-c-muted mt-2 italic">{ex.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Attached cardio session */}
          {attachedCardio && (
            <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <p className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-2">Cardio</p>
              <p className="font-semibold text-c-primary">{attachedCardio.type}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                <span className="text-sm text-c-dim">{formatCardioTime(attachedCardio.duration)}</span>
                {attachedCardio.distance && (
                  <span className="text-sm text-c-dim">{attachedCardio.distance} {attachedCardio.distanceUnit}</span>
                )}
                {attachedCardio.intensity && (
                  <span className="text-sm text-c-dim">{INTENSITY_LABELS[attachedCardio.intensity] || attachedCardio.intensity}</span>
                )}
                {attachedCardio.minHR && (
                  <span className="text-sm text-c-dim">↓{attachedCardio.minHR} bpm</span>
                )}
                {attachedCardio.maxHR && (
                  <span className="text-sm text-c-dim">↑{attachedCardio.maxHR} bpm</span>
                )}
              </div>
              {attachedCardio.notes && (
                <p className="text-xs text-c-muted mt-1 italic">{attachedCardio.notes}</p>
              )}
            </div>
          )}

          {session.notes && (
            <div className="mt-4 bg-item-dim rounded-xl p-3">
              <p className="text-xs text-c-muted font-semibold mb-1">NOTES</p>
              <p className="text-sm text-c-secondary">{session.notes}</p>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={() => setShowShareCard(true)}
              className="w-full py-3 rounded-2xl bg-item text-c-secondary font-semibold"
            >
              📋 View Share Card
            </button>
            {confirmDelete ? (
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-item text-c-secondary py-3 rounded-2xl font-semibold">
                  Cancel
                </button>
                <button onClick={() => { onDelete(session.id); onClose() }} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold">
                  Delete
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-semibold border border-red-500/20">
                Delete Session
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Cardio session detail ─────────────────────────────────────────────────────

function CardioSessionDetail({ session, onClose, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { settings } = useStore()
  const theme = getTheme(settings.accentColor)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-end">
        <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5 pb-10" style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top, 1.25rem))' }} onClick={e => e.stopPropagation()}>

          <div className="flex items-start gap-3 mb-5">
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-item text-c-dim shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏃</span>
                <h2 className="text-xl font-bold">{session.type}</h2>
              </div>
              <p className="text-sm text-c-dim">{formatDate(session.createdAt)} · {formatTime(session.createdAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-item-dim rounded-xl p-3 text-center">
              <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Duration</p>
              <p className="text-lg font-bold font-mono">{formatCardioTime(session.duration)}</p>
            </div>
            {session.distance && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Distance</p>
                <p className="text-lg font-bold">{session.distance} {session.distanceUnit}</p>
              </div>
            )}
            {session.intensity && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Intensity</p>
                <p className="text-lg font-bold">{INTENSITY_LABELS[session.intensity] || session.intensity}</p>
              </div>
            )}
            {session.minHR && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Min HR</p>
                <p className="text-lg font-bold">{session.minHR} <span className="text-sm font-normal text-c-muted">bpm</span></p>
              </div>
            )}
            {session.maxHR && (
              <div className="bg-item-dim rounded-xl p-3 text-center">
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Max HR</p>
                <p className="text-lg font-bold">{session.maxHR} <span className="text-sm font-normal text-c-muted">bpm</span></p>
              </div>
            )}
          </div>

          {session.notes && (
            <div className="bg-item-dim rounded-xl p-3 mb-4">
              <p className="text-xs text-c-muted font-semibold mb-1">NOTES</p>
              <p className="text-sm text-c-secondary">{session.notes}</p>
            </div>
          )}

          {confirmDelete ? (
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 bg-item text-c-secondary py-3 rounded-2xl font-semibold">
                Cancel
              </button>
              <button onClick={() => { onDelete(session.id); onClose() }} className="flex-1 bg-red-500 text-white py-3 rounded-2xl font-bold">
                Delete
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full py-3 rounded-2xl bg-red-500/10 text-red-400 font-semibold border border-red-500/20">
              Delete Session
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Session card ───────────────────────────────────────────────────────────────

function SessionCard({ session, onClick, themeHex, splits }) {
  const d    = session.data || {}

  const name  = resolveWorkoutName(session.type, splits)
  const emoji = resolveWorkoutEmoji(session.type, splits)

  const subtitle = `${d.exercises?.filter(e => e.sets.some(s => s.reps)).length || 0} exercises · ${d.exercises?.reduce((t, e) => t + e.sets.filter(s => s.reps).length, 0) || 0} sets`

  const hasPR = d.exercises?.some(e => e.sets.some(s => s.isNewPR))

  return (
    <button onClick={onClick} className="w-full bg-card rounded-2xl p-4 flex items-center gap-4 text-left">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
        style={{ backgroundColor: `${themeHex}22`, border: `1px solid ${themeHex}33` }}
      >
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{name}</p>
          {hasPR && <span className="text-xs text-amber-400 shrink-0">🏆 PR</span>}
        </div>
        <p className="text-sm text-c-dim truncate">{subtitle}</p>
        <p className="text-xs text-c-faint">
          {formatTime(session.date)}
          {session.duration ? ` · ${session.duration}min` : ''}
          {session.grade    ? ` · ${session.grade}`       : ''}
        </p>
      </div>
      <svg className="w-4 h-4 text-c-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Cardio session card ────────────────────────────────────────────────────────

function CardioSessionCard({ session, onClick }) {
  return (
    <button onClick={onClick} className="w-full bg-card rounded-2xl p-4 flex items-center gap-4 text-left">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-blue-500/20 border border-blue-500/30">
        🏃
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{session.type}</p>
        <p className="text-sm text-c-dim truncate">
          {formatCardioTime(session.duration)}
          {session.distance ? ` · ${session.distance} ${session.distanceUnit}` : ''}
        </p>
        <p className="text-xs text-c-faint">
          {formatTime(session.createdAt)}
          {session.intensity ? ` · ${INTENSITY_LABELS[session.intensity] || session.intensity}` : ''}
        </p>
      </div>
      <svg className="w-4 h-4 text-c-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

// ── Main History ───────────────────────────────────────────────────────────────

// ── Resolve workout name / emoji from splits + built-in data ──────────────────

function resolveWorkoutName(type, splits) {
  if (BB_WORKOUT_NAMES[type]) return BB_WORKOUT_NAMES[type]
  for (const split of (splits || [])) {
    const w = split.workouts?.find(w => w.id === type)
    if (w?.name) return w.name
  }
  return type
}

function resolveWorkoutEmoji(type, splits) {
  if (BB_WORKOUT_EMOJI[type]) return BB_WORKOUT_EMOJI[type]
  for (const split of (splits || [])) {
    const w = split.workouts?.find(w => w.id === type)
    if (w?.emoji) return w.emoji
  }
  return '🏋️'
}

export default function History() {
  const { sessions, settings, deleteSession, cardioSessions, deleteCardioSession, splits } = useStore()
  const theme = getTheme(settings.accentColor)
  const backgroundTheme = settings.backgroundTheme

  const [selected, setSelected] = useState(null)
  const [selectedCardio, setSelectedCardio] = useState(null)

  const sortedStrength = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date))

  // Standalone cardio sessions (not attached to a workout) — sorted newest first
  const standaloneCardio = [...(cardioSessions || [])]
    .filter(c => !c.attachedToSessionId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Group both session types by date string
  const groups = {}
  sortedStrength.forEach(s => {
    const key = new Date(s.date).toDateString()
    if (!groups[key]) groups[key] = { date: s.date, strength: [], cardio: [] }
    groups[key].strength.push(s)
  })
  standaloneCardio.forEach(s => {
    const key = new Date(s.createdAt).toDateString()
    if (!groups[key]) groups[key] = { date: s.createdAt, strength: [], cardio: [] }
    groups[key].cardio.push(s)
  })

  // Sort date keys newest first
  const sortedKeys = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a))

  const selectedSession = selected ? sessions.find(s => s.id === selected) : null
  const selectedCardioSession = selectedCardio ? (cardioSessions || []).find(s => s.id === selectedCardio) : null

  const hasAny = sortedStrength.length > 0 || standaloneCardio.length > 0

  return (
    <div className="pb-10 min-h-screen">

      {/* Sticky header */}
      <div className="sticky top-0 bg-base z-30 px-4 pt-12 pb-3">
        <h1 className="text-2xl font-bold">History</h1>
      </div>

      <div className="px-4">

        {/* Calendar heatmap */}
        <div className="mt-2">
          <CalendarHeatmap
            sessions={sessions}
            onSelectSession={id => setSelected(id)}
            themeHex={theme.hex}
            backgroundTheme={backgroundTheme}
          />
        </div>

        {/* Session list grouped by day */}
        <div className="space-y-6">
          {!hasAny && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-c-dim font-medium">No sessions yet</p>
              <p className="text-c-faint text-sm mt-1">Log a workout or cardio session to see your history</p>
            </div>
          )}
          {sortedKeys.map(dateKey => {
            const group = groups[dateKey]
            return (
              <div key={dateKey}>
                <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-2">
                  {formatDate(group.date)}
                </p>
                <div className="space-y-2">
                  {group.strength.map(s => (
                    <SessionCard key={s.id} session={s} onClick={() => setSelected(s.id)} themeHex={theme.hex} splits={splits} />
                  ))}
                  {group.cardio.map(s => (
                    <CardioSessionCard key={s.id} session={s} onClick={() => setSelectedCardio(s.id)} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedSession && (
        <SessionDetail
          session={selectedSession}
          onClose={() => setSelected(null)}
          onDelete={id => { deleteSession(id); setSelected(null) }}
        />
      )}

      {selectedCardioSession && (
        <CardioSessionDetail
          session={selectedCardioSession}
          onClose={() => setSelectedCardio(null)}
          onDelete={id => { deleteCardioSession(id); setSelectedCardio(null) }}
        />
      )}
    </div>
  )
}
