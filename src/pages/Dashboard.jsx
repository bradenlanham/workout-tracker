import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, getRotationItemOnDate, getWorkoutStreak } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE, BB_EXERCISE_GROUPS } from '../data/exercises'

// ── Tutorial overlay ──────────────────────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    text: 'This is your next workout. Tap Start Session to begin.',
    style: { top: 390, left: 16, right: 16 },
  },
  {
    text: 'Log cardio sessions here — before, after, or anytime.',
    style: { top: 488, left: 16, right: 16 },
  },
  {
    text: 'Your week at a glance. Tap any day to preview that workout.',
    style: { top: 566, left: 16, right: 16 },
  },
  {
    text: 'Settings, splits, and more live here.',
    style: { top: 62, right: 16, width: 220 },
  },
]

function TutorialOverlay({ step, onAdvance, onDone, theme }) {
  if (step === null || step === undefined) return null
  const current = TUTORIAL_STEPS[step]
  const isLast = step === TUTORIAL_STEPS.length - 1
  return (
    <div className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div
        className="absolute rounded-2xl p-4 shadow-2xl"
        style={{ ...current.style, backgroundColor: 'var(--bg-card)', position: 'absolute' }}
      >
        <p className="text-sm text-c-primary leading-snug mb-3">{current.text}</p>
        <button
          onClick={isLast ? onDone : onAdvance}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors active:scale-[0.97] ${theme.bg}`}
          style={{ color: theme.contrastText }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

const SORENESS_RATINGS = [
  { id: 'notsore',  label: 'Not Sore',  desc: 'No noticeable muscle soreness or fatigue' },
  { id: 'sore',     label: 'Sore',      desc: 'Mild soreness; does not limit movement' },
  { id: 'verysore', label: 'Very Sore', desc: 'Significant soreness; affects daily movement' },
  { id: 'wrecked',  label: 'Wrecked',   desc: 'Extreme soreness; mobility is noticeably impaired' },
]

function SorenessModal({ workoutLabel, onRate, onSkip }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onSkip}>
      <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5 pb-10" onClick={e => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-1">Soreness Check-in</h3>
        <p className="text-c-dim text-sm mb-5">How sore are you after yesterday's {workoutLabel}?</p>
        <div className="space-y-2">
          {SORENESS_RATINGS.map(r => (
            <button
              key={r.id}
              onClick={() => onRate(r.id)}
              className="w-full text-left p-4 rounded-2xl bg-item hover:bg-hover active:bg-hover transition-colors"
            >
              <p className="font-semibold text-c-primary">{r.label}</p>
              <p className="text-sm text-c-muted mt-0.5">{r.desc}</p>
            </button>
          ))}
        </div>
        <button onClick={onSkip} className="w-full mt-3 py-3 rounded-xl bg-item text-c-dim font-semibold">
          Skip
        </button>
      </div>
    </div>
  )
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysBetween(a, b) {
  const aMs = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const bMs = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((bMs - aMs) / 86400000)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, settings, splits, activeSplitId, updateSession, customTemplates, cardioSessions, updateSettings, activeSession } = useStore()
  const theme = getTheme(settings.accentColor)
  const [showMonth, setShowMonth] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewWorkoutId, setPreviewWorkoutId] = useState(null)
  const [showSorenessModal, setShowSorenessModal] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(() => settings.hasSeenTutorial ? null : 0)

  // ── Count-up animation (runs once on mount) ───────────────────────────────
  const animRef = useRef(false)
  const [animProgress, setAnimProgress] = useState(0)
  useEffect(() => {
    if (animRef.current) return
    animRef.current = true
    const start = performance.now()
    const duration = 700
    function tick(now) {
      const elapsed = now - start
      const p = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setAnimProgress(ease)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])
  const anim = (v) => Math.round(v * animProgress)

  const totalSessions = sessions.length

  const getWeekVolume = (weekOffset = 0) => {
    const now = new Date()
    const startOfThisWeek = new Date(now)
    startOfThisWeek.setDate(now.getDate() - now.getDay() + (weekOffset * 7))
    startOfThisWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfThisWeek)
    endOfWeek.setDate(startOfThisWeek.getDate() + 7)
    return sessions
      .filter(s => {
        const d = new Date(s.date)
        return d >= startOfThisWeek && d < endOfWeek
      })
      .reduce((total, s) => {
        return total + (s.data?.exercises || []).reduce((exTotal, ex) => {
          return exTotal + (ex.sets || []).reduce((setTotal, set) => {
            return setTotal + ((set.weight || 0) * (set.reps || 0))
          }, 0)
        }, 0)
      }, 0)
  }

  const formatVolume = (lbs) => {
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`
    return lbs === 0 ? '—' : `${lbs}`
  }

  const getWeekDuration = (weekOffset = 0) => {
    const now = new Date()
    const startOfThisWeek = new Date(now)
    startOfThisWeek.setDate(now.getDate() - now.getDay() + (weekOffset * 7))
    startOfThisWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfThisWeek)
    endOfWeek.setDate(startOfThisWeek.getDate() + 7)
    return sessions
      .filter(s => { const d = new Date(s.date); return d >= startOfThisWeek && d < endOfWeek })
      .reduce((total, s) => total + (s.duration || 0), 0)
  }

  const formatDuration = (mins) => {
    if (!mins) return '—'
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const volumeThisWeek = getWeekVolume(0)
  const volumeLastWeek = getWeekVolume(-1)
  const durationThisWeek = getWeekDuration(0)
  const durationLastWeek = getWeekDuration(-1)

  const totalVolume = sessions.reduce((total, s) => {
    return total + (s.data?.exercises || []).reduce((exTotal, ex) => {
      return exTotal + (ex.sets || []).reduce((setTotal, set) => {
        return setTotal + ((set.weight || 0) * (set.reps || 0))
      }, 0)
    }, 0)
  }, 0)

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Active split helpers ──────────────────────────────────────────────────
  const activeSplit   = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const rotation      = activeSplit?.rotation || BB_WORKOUT_SEQUENCE
  const workoutSeq    = rotation.filter(t => t !== 'rest')

  const splitSessionCount = sessions.filter(s => {
    if (!activeSplit?.createdAt) return true
    return new Date(s.date) >= new Date(activeSplit.createdAt)
  }).length

  const streak = getWorkoutStreak(sessions, rotation)

  const nextBb           = getNextBbWorkout(sessions, rotation)
  const nextRotationItem = getRotationItemOnDate(toDateStr(new Date()), sessions, rotation) ?? rotation[0]

  const getWorkoutName = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.name || BB_WORKOUT_NAMES[wId] || wId
  }
  const getWorkoutEmoji = (wId) => {
    const w = activeSplit?.workouts?.find(w => w.id === wId)
    return w?.emoji || BB_WORKOUT_EMOJI[wId] || '🏋️'
  }
  const getShortName = (wId) => getWorkoutName(wId).split(' ')[0]

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

  // Get first N exercise names from a workout for the CTA card (Improvement 7)
  const getFirstExercises = (workoutId, count = 3) => {
    const workout = activeSplit?.workouts?.find(w => w.id === workoutId)
    const sections = workout?.sections || BB_EXERCISE_GROUPS[workoutId] || []
    const primarySection = sections.find(s => s.label === 'Primary') || sections[0]
    if (!primarySection) return []
    return (primarySection.exercises || []).slice(0, count).map(ex => typeof ex === 'string' ? ex : ex.name)
  }

  // ── Soreness check-in (yesterday's session) ───────────────────────────────
  const today    = new Date()
  const todayStr = toDateStr(today)
  const todayLogged = sessions.some(s => {
    const d = s.date ? s.date.split('T')[0] : null
    return d === todayStr
  })

  const yesterday    = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = toDateStr(yesterday)

  const yesterdayRotationItem = rotation?.length && sessions.length
    ? getRotationItemOnDate(yesterdayStr, sessions, rotation)
    : null
  const yesterdayLogged = sessions.some(s => s.date?.split('T')[0] === yesterdayStr)
  const missedYesterdayWorkout = (!todayLogged && yesterdayRotationItem && yesterdayRotationItem !== 'rest' && !yesterdayLogged)
    ? yesterdayRotationItem
    : null
  const recommendedWorkout = missedYesterdayWorkout ?? nextBb

  // ── Preview data ─────────────────────────────────────────────────────────
  const activePreviewId = previewWorkoutId || recommendedWorkout
  const previewWorkout = activeSplit?.workouts?.find(w => w.id === activePreviewId)
  const previewSections = previewWorkout?.sections || BB_EXERCISE_GROUPS[activePreviewId] || []

  const pendingSorenessSession = sessions.find(s => {
    const d = s.date ? s.date.split('T')[0] : null
    return d === yesterdayStr && s.mode === 'bb' && !s.soreness
  })

  const getWorkoutLabel = (session) => {
    if (!session) return ''
    if (session.type?.startsWith('tpl_')) {
      const tplId = session.type.slice(4)
      const tpl = customTemplates?.find(t => t.id === tplId)
      return tpl?.name || 'Custom Workout'
    }
    const w = activeSplit?.workouts?.find(w => w.id === session.type)
    return w?.name || BB_WORKOUT_NAMES[session.type] || session.type
  }

  const attachedCardio = pendingSorenessSession
    ? cardioSessions?.find(c => c.attachedToSessionId === pendingSorenessSession.id)
    : null

  const sorenessWorkoutLabel = pendingSorenessSession
    ? attachedCardio
      ? `${getWorkoutLabel(pendingSorenessSession)} + ${attachedCardio.type}`
      : getWorkoutLabel(pendingSorenessSession)
    : ''

  const handleSorenessRate = (rating) => {
    if (!pendingSorenessSession) return
    updateSession(pendingSorenessSession.id, {
      soreness: { rating, date: yesterdayStr },
    })
    setShowSorenessModal(false)
  }

  const handleSorenessSkip = () => {
    if (!pendingSorenessSession) return
    updateSession(pendingSorenessSession.id, {
      soreness: { skipped: true, date: yesterdayStr },
    })
    setShowSorenessModal(false)
  }

  const isRestDay = nextRotationItem === 'rest' && !todayLogged && !missedYesterdayWorkout

  // ── PR count ──────────────────────────────────────────────────────────────
  const prCount = sessions.filter(s => {
    if (activeSplit?.createdAt && new Date(s.date) < new Date(activeSplit.createdAt)) return false
    return (s.data?.exercises || []).some(ex => ex.sets?.some(set => set.isNewPR))
  }).length

  // ── Session map: dateStr → most-recent session that day ───────────────────
  const sessionByDate = {}
  sessions.forEach(s => {
    const d = s.date ? s.date.split('T')[0] : null
    if (!d) return
    if (!sessionByDate[d] || new Date(s.date) > new Date(sessionByDate[d].date)) {
      sessionByDate[d] = s
    }
  })

  const cardioDateSet = new Set(
    (cardioSessions || [])
      .filter(c => !c.attachedToSessionId)
      .map(c => c.date)
  )
  const cardioAndWorkoutDateSet = new Set(
    (cardioSessions || []).map(c => c.date)
  )

  function getPlannedWorkout(daysAhead) {
    if (daysAhead < 0) return null
    const startIdx = workoutSeq.indexOf(nextBb)
    const base     = startIdx === -1 ? 0 : startIdx
    const offset   = todayLogged ? daysAhead - 1 : daysAhead
    if (offset < 0) return null
    return workoutSeq[(base + offset) % workoutSeq.length]
  }

  function getFullRotationItem(daysAhead) {
    if (daysAhead < 0) return null
    const d = new Date(today)
    d.setDate(today.getDate() + daysAhead)
    return getRotationItemOnDate(toDateStr(d), sessions, rotation)
  }

  function getDayInfo(date) {
    const dStr       = toDateStr(date)
    const isToday    = dStr === todayStr
    const ahead      = daysBetween(today, date)
    const session    = sessionByDate[dStr]
    const hasCardio  = cardioAndWorkoutDateSet.has(dStr)
    const cardioOnly = !session && cardioDateSet.has(dStr)

    if (cardioOnly) {
      return { type: isToday ? 'today-cardio' : 'cardio', hasCardio: true }
    }
    if (session) {
      return { type: isToday ? 'today-done' : 'done', session, emoji: getWorkoutEmoji(session.type), hasCardio }
    }
    if (isToday) {
      if (isRestDay) return { type: 'today-rest', hasCardio }
      return { type: 'today-pending', emoji: getWorkoutEmoji(nextBb), hasCardio }
    }
    if (ahead > 0) {
      const rotItem = getFullRotationItem(ahead)
      if (rotItem === 'rest') return { type: 'future-rest' }
      const planned = rotItem || getPlannedWorkout(ahead)
      return { type: 'future', planned, emoji: planned ? getWorkoutEmoji(planned) : null }
    }
    if (rotation?.length && sessions.length) {
      const rotItem = getRotationItemOnDate(dStr, sessions, rotation)
      if (rotItem === 'rest') return { type: 'past-rest' }
    }
    return { type: 'empty' }
  }

  // ── Week days (Sun–Sat of current week) ──────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - today.getDay() + i)
    return d
  })

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

  // ── Momentum line (Improvement 4) ─────────────────────────────────────────
  let momentumLine = ''
  if (isRestDay) {
    momentumLine = `Rest day · ${getWorkoutName(nextBb)} up next`
  } else if (todayLogged) {
    momentumLine = `${totalSessions} sessions and counting`
  } else if (totalSessions > 0 && totalVolume > 0) {
    momentumLine = `${totalSessions} sessions logged · ${formatVolume(totalVolume)} lbs moved`
  } else if (totalSessions > 0) {
    momentumLine = `${totalSessions} sessions logged`
  } else {
    momentumLine = 'Your first session starts here'
  }

  // ── CTA card exercise preview (Improvement 7) ─────────────────────────────
  const ctaExercises = (!isRestDay && !activeSession?.sessionStarted && !todayLogged)
    ? getFirstExercises(recommendedWorkout, 3)
    : []

  // ── Card shared styles ────────────────────────────────────────────────────
  const accentCardStyle = {
    background: theme.hex,
    borderRadius: 20,
    padding: '16px 16px',
    position: 'relative',
    color: theme.contrastText,
    textAlign: 'center',
    overflow: 'hidden',
    boxShadow: `0 8px 32px ${theme.hex}40, 0 2px 8px rgba(0,0,0,0.3)`,
    borderTop: '1px solid rgba(255,255,255,0.25)',
  }

  return (
    <div className="min-h-screen pb-28">

      {/* ── Greeting ────────────────────────────────────────────────────────── */}
      <div className="px-4 pb-2" style={{ paddingTop: 'max(44px, calc(env(safe-area-inset-top) + 16px))' }}>
        <p className="text-c-muted text-sm font-medium tracking-wide">
          {timeGreeting}{settings.userName ? `, ${settings.userName}` : ''}
        </p>
        <h1 className="text-3xl font-bold mt-0.5 mb-1">
          {todayLogged ? 'Your work here is done.' : isRestDay ? 'Rest day.' : 'Ready to train?'}
          {(todayLogged || isRestDay) && (
            <span style={{ color: theme.hex, fontSize: 28, fontWeight: 'bold' }}> ✓</span>
          )}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{momentumLine}</p>
      </div>

      {/* ── Streak Hero ──────────────────────────────────────────────────────── */}
      <div className="px-4 mb-3 flex justify-center">
        {streak > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
            <span style={{
              fontSize: 34,
              fontWeight: 900,
              lineHeight: 1,
              color: 'var(--text-primary)',
              textShadow: `0 0 20px ${theme.hex}99`,
              letterSpacing: '-0.02em',
            }}>
              {streak}
            </span>
            <span style={{ fontSize: 32, lineHeight: 1 }}>🔥</span>
            <span style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              day streak
            </span>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 0' }}>
            Start your streak today
          </p>
        )}
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <div className="grid grid-cols-2 gap-3">
          {/* Volume card */}
          <div className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-c-muted mb-2">Volume</p>
            <div className="flex gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-c-muted mb-0.5">Last Wk</p>
                <p className="text-base font-bold leading-none text-c-secondary">
                  {formatVolume(anim(volumeLastWeek))}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: theme.hex }}>This Wk</p>
                <p className="text-lg font-black leading-none" style={{ color: theme.hex }}>
                  {formatVolume(anim(volumeThisWeek))}
                </p>
              </div>
            </div>
          </div>
          {/* Time in Gym card */}
          <div className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-c-muted mb-2">Time in Gym</p>
            <div className="flex gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-c-muted mb-0.5">Last Wk</p>
                <p className="text-base font-bold leading-none text-c-secondary">
                  {formatDuration(anim(durationLastWeek))}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: theme.hex }}>This Wk</p>
                <p className="text-lg font-black leading-none" style={{ color: theme.hex }}>
                  {formatDuration(anim(durationThisWeek))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Active split label ──────────────────────────────────────────────── */}
      {activeSplit && (
        <div className="px-4 mb-2">
          <p className="text-xs text-c-muted">
            Split: <span className="font-semibold text-c-dim">{activeSplit.emoji} {activeSplit.name}</span>
            {' · '}
            <span className="font-semibold text-c-dim">
              {activeSplit.createdAt
                ? (() => {
                    const days = Math.round((new Date() - new Date(activeSplit.createdAt)) / 86400000)
                    return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`
                  })()
                : 'Today'}
            </span>
          </p>
        </div>
      )}

      {/* ── Main CTA ────────────────────────────────────────────────────────── */}
      <div className="px-4 mb-3" style={{ position: 'relative' }}>
        {/* Atmospheric glow behind card (Improvement 10) */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '75%',
          height: '70%',
          background: theme.hex,
          filter: 'blur(60px)',
          opacity: 0.22,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {activeSession?.sessionStarted ? (
            /* ── Resume in-progress session ── */
            <div style={accentCardStyle}>
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              }} />
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: theme.contrastText }} />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: theme.contrastText, opacity: 0.8 }} />
                </span>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ opacity: 0.7 }}>
                  {activeSession.isPaused ? 'Paused' : 'In Progress'}
                </p>
              </div>
              <p className="text-2xl font-bold leading-tight">
                {getWorkoutEmoji(activeSession.type)} {getWorkoutName(activeSession.type)}
              </p>
              <p className="text-sm mt-1 mb-3" style={{ opacity: 0.6 }}>
                {activeSession.exercises?.filter(ex => ex.sets?.some(s => s.reps || s.weight)).length || 0} exercise{activeSession.exercises?.filter(ex => ex.sets?.some(s => s.reps || s.weight)).length === 1 ? '' : 's'} logged so far
              </p>
              <button
                onClick={() => navigate(`/log/bb/${activeSession.type}`)}
                className="w-full bg-black/20 hover:bg-black/30 active:bg-black/40 font-bold text-lg py-3 rounded-2xl transition-colors"
              >
                Resume Workout →
              </button>
            </div>
          ) : isRestDay ? (
            /* ── Rest day ── */
            <div style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 20,
              padding: '16px 16px',
              textAlign: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
            }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-2 text-c-muted">Today</p>
              <p className="text-2xl font-bold leading-tight">Rest Day</p>
              <p className="text-sm mt-2 text-c-muted">
                Recovery is part of the plan. Come back stronger tomorrow.
              </p>
              <p className="text-sm mt-4 font-semibold text-c-dim">
                Next workout: {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
              </p>
            </div>
          ) : (
            /* ── Upcoming workout ── */
            <div style={accentCardStyle}>
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              }} />
              <button
                onClick={() => setShowPreview(true)}
                style={{ position: 'absolute', top: 12, right: 16, fontSize: 11, color: theme.contrastText, opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', zIndex: 1 }}
              >
                Preview
              </button>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ opacity: 0.6 }}>
                {todayLogged ? 'Next in your split' : missedYesterdayWorkout ? 'Missed Yesterday' : 'Next Up'}
              </p>
              <p className="text-2xl font-bold leading-tight">
                {getWorkoutName(recommendedWorkout)}
              </p>
              {/* Exercise preview line */}
              {ctaExercises.length > 0 && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4, marginBottom: 12 }}>
                  {ctaExercises.join(' · ')}
                </p>
              )}
              {todayLogged ? (
                <p className="text-sm mt-3" style={{ opacity: 0.6 }}>
                  Rest up — come back tomorrow.
                </p>
              ) : (
                <>
                  {ctaExercises.length === 0 && (
                    <p className="text-sm mt-1 mb-5" style={{ opacity: 0.6 }}>
                      {streak > 0 ? `${streak}-day streak` : 'Start your streak today!'}
                    </p>
                  )}
                  <button
                    onClick={() => navigate(`/log/bb/${recommendedWorkout}`)}
                    className="w-full bg-black/20 hover:bg-black/30 active:bg-black/40 font-bold text-lg py-3 rounded-2xl transition-colors"
                  >
                    Start Session →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Soreness check-in prompt ────────────────────────────────────────── */}
      {pendingSorenessSession && (
        <div className="px-4 mb-2">
          <button
            onClick={() => setShowSorenessModal(true)}
            className="w-full bg-card rounded-2xl p-4 flex items-center gap-3 text-left border border-c-subtle"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs text-c-muted font-semibold uppercase tracking-widest mb-0.5">Check-in</p>
              <p className="font-semibold text-c-primary text-sm">
                Review yesterday's {sorenessWorkoutLabel} session.
              </p>
            </div>
            <svg className="w-4 h-4 text-c-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Log Cardio card ──────────────────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-c-muted mb-1.5">Cardio</p>
        <button
          onClick={() => navigate('/cardio')}
          className="w-full rounded-2xl p-3"
          style={{ backgroundColor: theme.hex + '80', color: theme.contrastText, textAlign: 'center' }}
        >
          <p className="font-semibold">Log Cardio ›</p>
        </button>
      </div>

      {/* ── Weekly calendar strip ───────────────────────────────────────────── */}
      <div className="px-4 mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-c-muted mb-2">This week</p>
        <div className="flex gap-1.5">
          {weekDays.map((day, i) => {
            const info           = getDayInfo(day)
            const isToday        = toDateStr(day) === todayStr
            const isTodayDone    = info.type === 'today-done'
            const isTodayPending = info.type === 'today-pending'
            const isTodayRest    = info.type === 'today-rest'
            const isDone         = info.type === 'done'
            const isCardio       = info.type === 'cardio'
            const isTodayCardio  = info.type === 'today-cardio'
            const isFuture       = info.type === 'future'
            const isFutureRest   = info.type === 'future-rest'
            const isPastRest     = info.type === 'past-rest'

            let cellBg = 'bg-white/5'
            if (isTodayDone) cellBg = theme.bg
            else if (isDone) cellBg = theme.bgSubtle
            else if (isCardio || isTodayCardio) cellBg = 'bg-blue-500/20'

            const todayStyle = isTodayPending
              ? { outline: `2.5px solid ${theme.hex}`, outlineOffset: '-2px', boxShadow: `0 0 12px ${theme.hex}80` }
              : (isTodayRest || isTodayCardio || isTodayDone)
                ? { outline: `2px solid rgba(255,255,255,0.15)`, outlineOffset: '-2px' }
                : {}

            return (
              <button
                key={i}
                onClick={() => {
                  if (isDone || isTodayDone || isCardio || isTodayCardio) navigate('/history')
                  else if (isFuture && info.planned) { setPreviewWorkoutId(info.planned); setShowPreview(true) }
                }}
                className={`flex-1 flex flex-col items-center rounded-xl transition-colors ${cellBg}`}
                style={{ minHeight: 50, paddingTop: 6, paddingBottom: 6, ...todayStyle }}
              >
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 2,
                  color: isToday ? theme.hex : 'var(--text-muted)',
                }}>
                  {DAY_LABELS[i]}
                </span>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: isToday ? 'var(--text-primary)' : 'var(--text-dim)',
                }}>
                  {day.getDate()}
                </span>
                <span className={`text-sm leading-none ${info.type === 'empty' ? 'opacity-25' : ''}`}>
                  {isTodayDone
                    ? <span className="flex flex-col items-center gap-0.5">
                        <span>{info.emoji || '✓'}</span>
                        {info.hasCardio && <span style={{ fontSize: 8, color: '#60a5fa' }}>●</span>}
                      </span>
                    : isDone
                      ? <span className="flex flex-col items-center gap-0.5">
                          <span>{info.emoji}</span>
                          {info.hasCardio && <span style={{ fontSize: 8, color: '#60a5fa' }}>●</span>}
                        </span>
                      : isCardio || isTodayCardio
                        ? <span className="text-blue-400 text-[11px] font-bold">C</span>
                        : isTodayPending
                          ? <span style={{ opacity: 0.5 }}>{info.emoji}</span>
                          : isTodayRest
                            ? <span className="text-[9px] text-c-muted font-semibold">R</span>
                            : isFutureRest
                              ? <span className="text-[9px] font-semibold" style={{ opacity: 0.5 }}>R</span>
                              : isPastRest
                                ? <span className="text-[9px] font-semibold" style={{ opacity: 0.3 }}>R</span>
                                : isFuture && info.planned
                                  ? <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.5 }}>{getShortName(info.planned)}</span>
                                  : <span className="text-[8px] text-c-muted">·</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Month toggle ────────────────────────────────────────────────────── */}
      <div className="px-4 mb-3">
        <button
          onClick={() => setShowMonth(v => !v)}
          className={`text-xs font-semibold ${theme.text} py-2`}
        >
          View month {showMonth ? '▾' : '▸'}
        </button>

        {showMonth && (
          <div className="mt-2">
            <p className="text-sm font-bold mb-3 text-c-primary">
              {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
            </p>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((l, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-c-muted">{l}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getMonthDays().map((day, i) => {
                if (!day) return <div key={i} className="aspect-square" />

                const info           = getDayInfo(day)
                const isToday        = toDateStr(day) === todayStr
                const isTodayDone    = info.type === 'today-done'
                const isTodayPending = info.type === 'today-pending'
                const isTodayRest    = info.type === 'today-rest'
                const isDone         = info.type === 'done'
                const isCardio       = info.type === 'cardio'
                const isTodayCardio  = info.type === 'today-cardio'
                const isFuture       = info.type === 'future'
                const isFutureRest   = info.type === 'future-rest'
                const isPastRest     = info.type === 'past-rest'

                let cellBg  = 'bg-white/5'
                let textCol = 'text-c-muted'
                if (isTodayDone)        { cellBg = theme.bg;        textCol = 'text-white'   }
                else if (isDone)        { cellBg = theme.bgSubtle;  textCol = theme.text     }
                else if (isCardio || isTodayCardio) { cellBg = 'bg-blue-500/20'; textCol = 'text-blue-400' }

                return (
                  <button
                    key={i}
                    onClick={() => (isDone || isTodayDone || isCardio || isTodayCardio) && navigate('/history')}
                    className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-colors ${cellBg} ${textCol}`}
                    style={isTodayPending ? { outline: `2px solid ${theme.hex}`, outlineOffset: '-2px' } : {}}
                  >
                    <span className="text-[11px] font-bold leading-none">{day.getDate()}</span>
                    {(isTodayDone || isDone) && (
                      <span className="text-[9px] leading-none mt-0.5">
                        {isTodayDone ? '✓' : info.emoji}
                      </span>
                    )}
                    {(isCardio || isTodayCardio) && (
                      <span className="text-[8px] font-bold leading-none mt-0.5">C</span>
                    )}
                    {isTodayRest && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-50 font-semibold">R</span>
                    )}
                    {isTodayPending && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-50">{info.emoji}</span>
                    )}
                    {isFuture && info.emoji && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-25">{info.emoji}</span>
                    )}
                    {isFutureRest && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-40 font-semibold">R</span>
                    )}
                    {isPastRest && (
                      <span className="text-[9px] leading-none mt-0.5 opacity-30 font-semibold">R</span>
                    )}
                    {info.hasCardio && (isDone || isTodayDone) && (
                      <span style={{ fontSize: 6, color: '#60a5fa', lineHeight: 1 }}>●</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Soreness Modal ──────────────────────────────────────────────────── */}
      {showSorenessModal && pendingSorenessSession && (
        <SorenessModal
          workoutLabel={sorenessWorkoutLabel}
          onRate={handleSorenessRate}
          onSkip={handleSorenessSkip}
        />
      )}

      {/* ── Tutorial overlay ────────────────────────────────────────────────── */}
      <TutorialOverlay
        step={tutorialStep}
        onAdvance={() => setTutorialStep(s => s + 1)}
        onDone={() => {
          setTutorialStep(null)
          updateSettings({ hasSeenTutorial: true })
        }}
        theme={theme}
      />

      {/* ── Workout Preview Overlay ──────────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-base overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="p-4">
            <button onClick={() => { setShowPreview(false); setPreviewWorkoutId(null) }} className="text-sm opacity-60 mb-4">
              ← go back
            </button>
            <h2 className="text-xl font-bold mb-1">
              {getWorkoutEmoji(activePreviewId)} {getWorkoutName(activePreviewId)}
            </h2>
            <p className="text-sm opacity-50 mb-4">
              {previewWorkoutId ? 'Upcoming workout' : todayLogged ? "Tomorrow's workout" : "Next workout"}
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
