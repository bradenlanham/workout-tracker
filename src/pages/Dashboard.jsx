import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, getWorkoutStreak } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE } from '../data/exercises'

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

  const streak        = getWorkoutStreak(sessions)
  const totalSessions = sessions.length

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Active split helpers ──────────────────────────────────────────────────
  const activeSplit   = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const rotation      = activeSplit?.rotation || BB_WORKOUT_SEQUENCE
  const workoutSeq    = rotation.filter(t => t !== 'rest')

  const nextBb = getNextBbWorkout(sessions, rotation)

  const getWorkoutName = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.name || BB_WORKOUT_NAMES[wId] || wId
  }
  const getWorkoutEmoji = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.emoji || BB_WORKOUT_EMOJI[wId] || '🏋️'
  }

  // ── Today detection ───────────────────────────────────────────────────────
  const today    = new Date()
  const todayStr = toDateStr(today)
  const todayLogged = sessions.some(s => {
    const d = s.date ? s.date.split('T')[0] : null
    return d === todayStr
  })

  // ── Session map: dateStr → most-recent session that day ───────────────────
  const sessionByDate = {}
  sessions.forEach(s => {
    const d = s.date ? s.date.split('T')[0] : null
    if (!d) return
    if (!sessionByDate[d] || new Date(s.date) > new Date(sessionByDate[d].date)) {
      sessionByDate[d] = s
    }
  })

  // ── Planned workout N days from today ─────────────────────────────────────
  // nextBb is "tomorrow's workout" when today is done, "today's workout" when not.
  function getPlannedWorkout(daysAhead) {
    if (daysAhead < 0) return null
    const startIdx = workoutSeq.indexOf(nextBb)
    const base     = startIdx === -1 ? 0 : startIdx
    // When todayLogged, nextBb maps to daysAhead=1; when not, to daysAhead=0
    const offset   = todayLogged ? daysAhead - 1 : daysAhead
    if (offset < 0) return null
    return workoutSeq[(base + offset) % workoutSeq.length]
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
      return { type: 'today-pending', emoji: getWorkoutEmoji(nextBb) }
    }
    if (ahead > 0) {
      const planned = getPlannedWorkout(ahead)
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
        <div className={`${theme.bg} rounded-3xl p-6`} style={{ color: theme.contrastText }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ opacity: 0.6 }}>
            {todayLogged ? 'Next in your split' : 'Next Up'}
          </p>
          <p className="text-3xl font-bold leading-tight">
            {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
          </p>
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
      </div>

      {/* ── Weekly calendar strip ───────────────────────────────────────────── */}
      <div className="px-4 mb-1">
        <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-3">This week</p>
        <div className="flex gap-1">
          {weekDays.map((day, i) => {
            const info       = getDayInfo(day)
            const isToday    = toDateStr(day) === todayStr
            const isTodayDone    = info.type === 'today-done'
            const isTodayPending = info.type === 'today-pending'
            const isDone         = info.type === 'done'
            const isFuture       = info.type === 'future'

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
                <span className={`text-sm leading-none ${(isFuture || info.type === 'empty') ? 'opacity-25' : ''}`}>
                  {isTodayDone
                    ? '✓'
                    : isDone
                      ? info.emoji
                      : isTodayPending
                        ? <span style={{ opacity: 0.5 }}>{info.emoji}</span>
                        : isFuture && info.emoji
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
                const isDone         = info.type === 'done'
                const isFuture       = info.type === 'future'

                let cellBg   = 'bg-white/5'
                let textCol  = 'text-c-muted'
                if (isTodayDone) { cellBg = theme.bg;      textCol = 'text-white' }
                else if (isDone) { cellBg = theme.bgSubtle; textCol = theme.text  }

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
                    {isFuture && info.emoji && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-25">{info.emoji}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
