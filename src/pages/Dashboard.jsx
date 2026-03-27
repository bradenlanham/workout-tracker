import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, getNextRotationItem, getWorkoutStreak } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE, BB_EXERCISE_GROUPS } from '../data/exercises'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a, b) {
  // Integer days from date a to date b (b - a)
  const aMs = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const bMs = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((bMs - aMs) / 86400000)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, settings, splits, activeSplitId } = useStore()
  const theme = getTheme(settings.accentColor)
  const [showMonth, setShowMonth] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const totalSessions = sessions.length

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Active split helpers ──────────────────────────────────────────────────
  const activeSplit   = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const rotation      = activeSplit?.rotation || BB_WORKOUT_SEQUENCE
  const workoutSeq    = rotation.filter(t => t !== 'rest')

  const streak        = getWorkoutStreak(sessions, rotation)

  const nextBb            = getNextBbWorkout(sessions, rotation)
  const nextRotationItem  = getNextRotationItem(sessions, rotation)

  const getWorkoutName = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.name || BB_WORKOUT_NAMES[wId] || wId
  }
  const getWorkoutEmoji = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.emoji || BB_WORKOUT_EMOJI[wId] || '🏋️'
  }

  // ── Preview data ─────────────────────────────────────────────────────────
  const previewWorkout = activeSplit?.workouts?.find(w => w.id === nextBb)
  const previewSections = previewWorkout?.sections || BB_EXERCISE_GROUPS[nextBb] || []

  function getLastExerciseData(exName) {
    const name = typeof exName === 'string' ? exName : exName?.name
    if (!name) return null
    const relevant = sessions
      .filter(s => s.data?.exercises?.some(e => e.name === name))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (!relevant.length) return null
    const ex = relevant[0].data.exercises.find(e => e.name === name)
    const lastWorking = ex?.sets?.slice().reverse().find(s => s.type === 'working' && s.weight && s.reps)
    if (!lastWorking) return null
    return `Last: ${lastWorking.weight}×${lastWorking.reps}`
  }

  // ── Today detection ───────────────────────────────────────────────────────
  const today    = new Date()
  const todayStr = toDateStr(today)
  const todayLogged = sessions.some(s => {
    const d = s.date ? s.date.split('T')[0] : null
    return d === todayStr
  })
  const isRestDay = nextRotationItem === 'rest' && !todayLogged

  // ── Session map: dateStr → most-recent session that day ───────────────────
  const sessionByDate = {}
  sessions.forEach(s => {
    const d = s.date ? s.date.split('T')[0] : null
    if (!d) return
    if (!sessionByDate[d] || new Date(s.date) > new Date(sessionByDate[d].date)) {
      sessionByDate[d] = s
    }
  })

  // ── Planned workout N days from today (non-rest only, for the CTA card) ──
  function getPlannedWorkout(daysAhead) {
    if (daysAhead < 0) return null
    const startIdx = workoutSeq.indexOf(nextBb)
    const base     = startIdx === -1 ? 0 : startIdx
    const offset   = todayLogged ? daysAhead - 1 : daysAhead
    if (offset < 0) return null
    return workoutSeq[(base + offset) % workoutSeq.length]
  }

  // ── Full rotation item N days from today (includes 'rest') ────────────────
  // Used by the calendar to show rest-day indicators on future dates.
  function getFullRotationItem(daysAhead) {
    if (daysAhead < 0) return null
    const bbSessions = sessions.filter(s => s.mode === 'bb' && s.type !== 'custom' && !s.type?.startsWith('tpl_'))
    let nextIdx
    if (!bbSessions.length) {
      nextIdx = 0
    } else {
      const sorted   = [...bbSessions].sort((a, b) => new Date(b.date) - new Date(a.date))
      const lastType = sorted[0].type
      const pos      = rotation.indexOf(lastType)
      nextIdx        = pos === -1 ? 0 : (pos + 1) % rotation.length
    }
    const offset = todayLogged ? daysAhead - 1 : daysAhead
    if (offset < 0) return null
    return rotation[(nextIdx + offset) % rotation.length]
  }

  // ── Per-day info ─────────────────────────────────────────────────────────
  function getDayInfo(date) {
    const dStr    = toDateStr(date)
    const isToday = dStr === todayStr
    const ahead   = daysBetween(today, date)
    const session = sessionByDate[dStr]

    if (session) {
      return { type: isToday ? 'today-done' : 'done', session, emoji: getWorkoutEmoji(session.type) }
    }
    if (isToday) {
      if (isRestDay) return { type: 'today-rest', emoji: '😴' }
      return { type: 'today-pending', emoji: getWorkoutEmoji(nextBb) }
    }
    if (ahead > 0) {
      const rotItem = getFullRotationItem(ahead)
      if (rotItem === 'rest') return { type: 'future-rest', emoji: '😴' }
      const planned = rotItem || getPlannedWorkout(ahead)
      return { type: 'future', planned, emoji: planned ? getWorkoutEmoji(planned) : null }
    }
    return { type: 'empty' }
  }

  // ── Week days (Sun–Sat of current week) ──────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - today.getDay() + i)
    return d
  })

  // ── Month days (with leading nulls for alignment) ─────────────────────────
  function getMonthDays() {
    const year     = today.getFullYear()
    const month    = today.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay  = new Date(year, month + 1, 0)
    const days     = []
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }

  return (
    <div className="min-h-screen pb-12">

      {/* ── Greeting ────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-16 pb-5">
        <p className="text-c-muted text-sm font-medium">
          {timeGreeting}{settings.userName ? `, ${settings.userName}` : ''}{' '}
          <span>{todayLogged ? '✓' : '💪'}</span>
        </p>
        <h1 className="text-3xl font-bold mt-0.5">
          {todayLogged ? 'Your work here is done.' : 'Ready to train?'}
        </h1>
      </div>

      {/* ── Stat badges ─────────────────────────────────────────────────────── */}
      <div className="px-4 flex gap-3 mb-5">
        <div className="flex-1 bg-card rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <p className="text-xl font-bold leading-none">{streak}</p>
            <p className="text-xs text-c-muted mt-0.5">Day streak</p>
          </div>
        </div>
        <div className="flex-1 bg-card rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">💪</span>
          <div>
            <p className={`text-xl font-bold leading-none ${theme.text}`}>{totalSessions}</p>
            <p className="text-xs text-c-muted mt-0.5">Sessions total</p>
          </div>
        </div>
      </div>

      {/* ── Active split label ──────────────────────────────────────────────── */}
      {activeSplit && (
        <div className="px-4 mb-3 flex items-center gap-2">
          <p className="text-xs text-c-muted">
            Training: <span className="font-semibold text-c-dim">{activeSplit.emoji} {activeSplit.name}</span>
          </p>
          {splits.length > 1 && (
            <button
              onClick={() => navigate('/splits')}
              className={`text-xs font-semibold ${theme.text} ml-1`}
            >
              Switch
            </button>
          )}
        </div>
      )}

      {/* ── Main CTA ────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        {isRestDay ? (
          <div className="bg-card rounded-3xl p-6">
            <p className="text-xs font-bold uppercase tracking-widest mb-2 text-c-muted">Today</p>
            <p className="text-3xl font-bold leading-tight">😴 Rest Day</p>
            <p className="text-sm mt-2 text-c-muted">
              Recovery is part of the plan. Come back stronger tomorrow.
            </p>
            <p className="text-sm mt-4 font-semibold text-c-dim">
              Next workout: {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
            </p>
          </div>
        ) : (
          <div className={`${theme.bg} rounded-3xl p-6`} style={{ color: theme.contrastText }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ opacity: 0.6 }}>
              {todayLogged ? 'Next in your split' : 'Next Up'}
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-3xl font-bold leading-tight">
                {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
              </p>
              <button
                onClick={() => setShowPreview(true)}
                style={{ fontSize: 12, color: theme.hex, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.85, flexShrink: 0 }}
              >
                Preview
              </button>
            </div>
            {todayLogged ? (
              <p className="text-sm mt-1" style={{ opacity: 0.6 }}>
                Rest up — come back tomorrow 💤
              </p>
            ) : (
              <>
                <p className="text-sm mt-1 mb-5" style={{ opacity: 0.6 }}>
                  {streak > 0 ? `${streak}-day streak 🔥` : 'Start your streak today!'}
                </p>
                <button
                  onClick={() => navigate(`/log/bb/${nextBb}`)}
                  className="w-full bg-black/20 hover:bg-black/30 active:bg-black/40 font-bold text-lg py-4 rounded-2xl transition-colors"
                >
                  Start Session →
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Weekly calendar strip ───────────────────────────────────────────── */}
      <div className="px-4 mb-1">
        <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">This week</p>
        <div className="flex gap-1">
          {weekDays.map((day, i) => {
            const info           = getDayInfo(day)
            const isToday        = toDateStr(day) === todayStr
            const isTodayDone    = info.type === 'today-done'
            const isTodayPending = info.type === 'today-pending'
            const isTodayRest    = info.type === 'today-rest'
            const isDone         = info.type === 'done'
            const isFuture       = info.type === 'future'
            const isFutureRest   = info.type === 'future-rest'

            let cellBg = 'bg-white/5'
            if (isTodayDone) cellBg = theme.bg
            else if (isDone) cellBg = theme.bgSubtle

            return (
              <button
                key={i}
                onClick={() => (isDone || isTodayDone) && navigate('/history')}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-colors ${cellBg}`}
                style={isTodayPending ? { outline: `2px solid ${theme.hex}`, outlineOffset: '-2px' } : {}}
              >
                {/* Day label */}
                <span className={`text-[10px] font-semibold mb-0.5 ${isToday ? theme.text : 'text-c-muted'}`}>
                  {DAY_LABELS[i]}
                </span>
                {/* Date number */}
                <span className={`text-xs font-bold mb-1.5 ${isToday ? 'text-white' : 'text-c-dim'}`}>
                  {day.getDate()}
                </span>
                {/* Status indicator */}
                <span className={`text-sm leading-none ${(isFuture || isFutureRest || info.type === 'empty') ? 'opacity-25' : ''}`}>
                  {isTodayDone
                    ? '✓'
                    : isDone
                      ? info.emoji
                      : isTodayPending
                        ? <span style={{ opacity: 0.5 }}>{info.emoji}</span>
                        : isTodayRest
                          ? <span style={{ opacity: 0.5 }}>😴</span>
                          : (isFuture || isFutureRest) && info.emoji
                            ? info.emoji
                            : <span className="text-[8px] text-c-muted">·</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Month toggle ────────────────────────────────────────────────────── */}
      <div className="px-4 mb-6">
        <button
          onClick={() => setShowMonth(v => !v)}
          className={`text-xs font-semibold ${theme.text} py-2`}
        >
          View month {showMonth ? '▾' : '▸'}
        </button>

        {showMonth && (
          <div className="mt-2">
            {/* Month header */}
            <p className="text-sm font-bold mb-3 text-c-primary">
              {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
            </p>
            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((l, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-c-muted">{l}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {getMonthDays().map((day, i) => {
                if (!day) return <div key={i} className="aspect-square" />

                const info           = getDayInfo(day)
                const isToday        = toDateStr(day) === todayStr
                const isTodayDone    = info.type === 'today-done'
                const isTodayPending = info.type === 'today-pending'
                const isTodayRest    = info.type === 'today-rest'
                const isDone         = info.type === 'done'
                const isFuture       = info.type === 'future'
                const isFutureRest   = info.type === 'future-rest'

                let cellBg   = 'bg-white/5'
                let textCol  = 'text-c-muted'
                if (isTodayDone) { cellBg = theme.bg;       textCol = 'text-white' }
                else if (isDone) { cellBg = theme.bgSubtle; textCol = theme.text   }

                return (
                  <button
                    key={i}
                    onClick={() => (isDone || isTodayDone) && navigate('/history')}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-colors ${cellBg} ${textCol}`}
                    style={isTodayPending ? { outline: `2px solid ${theme.hex}`, outlineOffset: '-2px' } : {}}
                  >
                    <span className="text-[11px] font-bold leading-none">{day.getDate()}</span>
                    {(isTodayDone || isDone) && (
                      <span className="text-[9px] leading-none mt-0.5">
                        {isTodayDone ? '✓' : info.emoji}
                      </span>
                    )}
                    {(isTodayRest || isTodayPending) && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-50">
                        {isTodayRest ? '😴' : info.emoji}
                      </span>
                    )}
                    {(isFuture || isFutureRest) && info.emoji && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-25">{info.emoji}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Workout Preview Overlay ──────────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-base overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="p-4">
            <button onClick={() => setShowPreview(false)} className="text-sm opacity-60 mb-4">
              ← go back
            </button>
            <h2 className="text-xl font-bold mb-1">
              {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
            </h2>
            <p className="text-sm opacity-50 mb-4">
              {todayLogged ? "Tomorrow's workout" : "Next workout"}
            </p>

            {previewSections.map(section => (
              <div key={section.label} className="mb-4">
                <div className="text-xs uppercase tracking-wider opacity-40 mb-2">{section.label}</div>
                {section.exercises.map((ex, i) => {
                  const name = typeof ex === 'string' ? ex : ex.name
                  const note = typeof ex === 'string' ? null : ex.note
                  const last = getLastExerciseData(ex)
                  return (
                    <div key={i} className="py-2 border-b border-white/5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm">{name}</div>
                        {last && <div className="text-xs opacity-40 shrink-0">{last}</div>}
                      </div>
                      {note && <div className="text-xs opacity-40 mt-0.5">{note}</div>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
