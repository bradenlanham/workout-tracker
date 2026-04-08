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
    text: 'Your week at a glance. Tap any day to see your history.',
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

const MON_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
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

// Checkmark SVG for completed circle
function Checkmark({ color = '#fff' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, settings, splits, activeSplitId, updateSession, customTemplates, cardioSessions, updateSettings, activeSession } = useStore()
  const theme = getTheme(settings.accentColor)

  const isDark = settings.backgroundTheme !== 'daylight'

  // Determine if accent color is light (needs dark text)
  const accentIsLight = (() => {
    const hex = (theme.hex || '#000000').replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160
  })()
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
      const ease = 1 - Math.pow(1 - p, 3)
      setAnimProgress(ease)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])
  const anim = (v) => Math.round(v * animProgress)

  const totalSessions = sessions.length

  // ── Volume computation ────────────────────────────────────────────────────
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

  // ── Time in gym computation ───────────────────────────────────────────────
  const getWeekTime = (weekOffset = 0) => {
    const now = new Date()
    const startOfThisWeek = new Date(now)
    startOfThisWeek.setDate(now.getDate() - now.getDay() + (weekOffset * 7))
    startOfThisWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfThisWeek)
    endOfWeek.setDate(startOfThisWeek.getDate() + 7)
    return sessions
      .filter(s => {
        const d = new Date(s.date)
        return d >= startOfThisWeek && d < endOfWeek && s.duration
      })
      .reduce((total, s) => total + (s.duration || 0), 0)
  }

  const formatVolume = (lbs) => {
    if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`
    return lbs === 0 ? '—' : `${lbs}`
  }

  const formatTime = (mins) => {
    if (!mins || mins === 0) return '—'
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const volumeThisWeek = getWeekVolume(0)
  const volumeLastWeek = getWeekVolume(-1)
  const timeThisWeek   = getWeekTime(0)
  const timeLastWeek   = getWeekTime(-1)

  // Days into the current Sun-start week (1 = Sun, 7 = Sat)
  const daysIntoWeek = new Date().getDay() + 1

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

  // ── Session map ───────────────────────────────────────────────────────────
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

  // ── Mon-Sun week days for circle calendar ─────────────────────────────────
  const mondayOffset = (today.getDay() + 6) % 7 // 0=Mon, 1=Tue, ..., 6=Sun
  const mondayWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - mondayOffset + i)
    return d
  })

  // Count completed workout days this Mon-Sun week
  const weekCompletedCount = mondayWeekDays.filter(d => {
    const info = getDayInfo(d)
    return info.type === 'done' || info.type === 'today-done'
  }).length

  // ── Sun-Sat week days (for monthly calendar) ──────────────────────────────
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

  // ── Smart headline ────────────────────────────────────────────────────────
  const lastSession = sessions.length > 0
    ? sessions.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    : null
  const daysSinceLastWorkout = lastSession
    ? Math.round((new Date() - new Date(lastSession.date)) / 86400000)
    : 999

  function getSmartHeadline() {
    if (isRestDay) {
      return {
        headline: 'Rest day.',
        sub: `Recovery is part of the plan. ${getWorkoutName(nextBb)} is up next.`,
      }
    }
    if (todayLogged) {
      return {
        headline: 'Your work here is done ✓',
        sub: `${totalSessions} sessions and counting.`,
      }
    }
    if (daysSinceLastWorkout > 7 && streak <= 2) {
      return {
        headline: `Welcome back${settings.userName ? `, ${settings.userName}` : ''}.`,
        sub: `You were gone ${daysSinceLastWorkout} days. You showed up — that's what matters.`,
      }
    }
    if (streak >= 7) {
      return {
        headline: `${streak} days strong.`,
        sub: `You're building something. Don't stop now.`,
      }
    }
    return {
      headline: `Day ${streak || 1}. Let's build.`,
      sub: `${totalSessions} sessions logged. Keep stacking.`,
    }
  }

  const { headline, sub } = getSmartHeadline()

  // ── Volume & time insights ────────────────────────────────────────────────
  function getVolumeInsight() {
    if (volumeLastWeek === 0) {
      if (volumeThisWeek > 0) return { text: '↑ Great start to the week.', color: '#34d399' }
      return { text: 'No data yet.', color: 'var(--text-muted)' }
    }
    const pct = ((volumeThisWeek - volumeLastWeek) / volumeLastWeek) * 100
    if (pct < -15) return { text: `↓ Volume down ${Math.round(Math.abs(pct))}% — but pace is fine.`, color: '#fbbf24' }
    if (pct > 10)  return { text: `↑ Up ${Math.round(pct)}% from last week. Pushing harder.`, color: '#34d399' }
    return { text: '≈ Tracking close to last week.', color: '#93c5fd' }
  }

  function getTimeInsight() {
    if (timeLastWeek === 0) {
      if (timeThisWeek > 0) return { text: '↑ Good start.', color: '#34d399' }
      return { text: 'No data yet.', color: 'var(--text-muted)' }
    }
    const diff = timeThisWeek - timeLastWeek
    const absDiff = Math.abs(diff)
    const label = absDiff < 60 ? `${absDiff}m` : `${Math.floor(absDiff/60)}h ${absDiff%60 > 0 ? `${absDiff%60}m` : ''}`
    if (diff > 5)  return { text: `↑ ${label.trim()} more than last week.`, color: '#34d399' }
    if (diff < -5) return { text: `↓ ${label.trim()} less than last week.`, color: '#fbbf24' }
    return { text: '≈ About the same as last week.', color: '#93c5fd' }
  }

  const volumeInsight = getVolumeInsight()
  const timeInsight   = getTimeInsight()

  // ── CTA card styles ───────────────────────────────────────────────────────
  const accentCardStyle = {
    background: theme.hex,
    borderRadius: 20,
    padding: '24px 20px',
    position: 'relative',
    color: theme.contrastText,
    textAlign: 'center',
    overflow: 'hidden',
    boxShadow: `0 8px 32px ${theme.hex}40, 0 2px 8px rgba(0,0,0,0.3)`,
    borderTop: '1px solid rgba(255,255,255,0.25)',
  }

  const ctaExercises = (!isRestDay && !activeSession?.sessionStarted && !todayLogged)
    ? getFirstExercises(recommendedWorkout, 3)
    : []

  // ── Volume/time bar widths ────────────────────────────────────────────────
  const volBarPct = volumeLastWeek === 0
    ? (volumeThisWeek > 0 ? 100 : 0)
    : Math.min((volumeThisWeek / volumeLastWeek) * 100, 100)
  const timeBarPct = timeLastWeek === 0
    ? (timeThisWeek > 0 ? 100 : 0)
    : Math.min((timeThisWeek / timeLastWeek) * 100, 100)

  // ── Fade-in animation delays ──────────────────────────────────────────────
  const fadeIn = (delay) => ({
    animation: 'dashFadeIn 0.45s ease forwards',
    animationDelay: `${delay}ms`,
    opacity: 0,
  })

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 100 }}>
      <style>{`
        @keyframes dashFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes circleRingPulse {
          0%, 100% { box-shadow: 0 0 0 2px VAR_REPLACE, 0 0 0 4px VAR_REPLACE_20; }
          50%       { box-shadow: 0 0 0 2px VAR_REPLACE, 0 0 0 6px VAR_REPLACE_10; }
        }
      `}</style>

      {/* ── SECTION 1: Hero Header ──────────────────────────────────────────── */}
      <div
        style={{
          ...fadeIn(0),
          position: 'relative',
          paddingTop: 'max(64px, calc(env(safe-area-inset-top) + 28px))',
          padding: 'max(64px, calc(env(safe-area-inset-top) + 28px)) 16px 20px',
        }}
      >
        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.01em' }}>
          {timeGreeting}{settings.userName ? `, ${settings.userName}` : ''}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, marginBottom: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            {headline}
          </h1>
          {streak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1, flexShrink: 0 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: theme.hex, textShadow: `0 0 16px ${theme.hex}99`, lineHeight: 1 }}>{streak}</span>
              <span style={{ fontSize: 26, lineHeight: 1 }}>🔥</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{sub}</p>
      </div>

      {/* ── SECTION 2: Circle Calendar ──────────────────────────────────────── */}
      <div style={{ ...fadeIn(100), padding: '0 16px', marginBottom: 10 }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <button
            onPointerDown={() => setShowMonth(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
          >
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              THIS WEEK
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.7 }}>
              {showMonth ? '▾' : '▸'}
            </span>
          </button>
        </div>

        {/* Circle row */}
        <div style={{ display: 'flex', gap: 6 }}>
          {mondayWeekDays.map((day, i) => {
            const info        = getDayInfo(day)
            const isToday     = toDateStr(day) === todayStr
            const isDone      = info.type === 'done' || info.type === 'today-done' || info.type === 'cardio' || info.type === 'today-cardio'
            const isPending   = info.type === 'today-pending'
            const isRestType  = info.type === 'today-rest' || info.type === 'past-rest' || info.type === 'future-rest'
            const isFutureDay = info.type === 'future'

            let circleStyle = {}
            let circleBg = isDark ? 'rgba(255,255,255,0.08)' : 'transparent'
            let circleSize = 36

            if (isDone) {
              circleBg = theme.hex
            } else if (isPending) {
              circleBg = 'transparent'
              circleStyle = {
                border: `2px solid ${theme.hex}`,
                boxShadow: `0 0 0 1px ${theme.hex}40`,
              }
            } else if (isRestType) {
              circleSize = 10
              circleBg = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'
            } else {
              // future or empty
              circleBg = isDark ? 'rgba(255,255,255,0.06)' : 'transparent'
              if (!isDark) {
                circleStyle = { border: `1px solid ${theme.hex}4D` }
              }
            }

            const isRestDot = isRestType

            return (
              <div
                key={i}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}
              >
                {/* Circle wrapper to keep day letter alignment consistent */}
                <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isRestDot ? (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                    }} />
                  ) : (
                    <button
                      onPointerDown={(e) => { e.preventDefault(); navigate('/history') }}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: circleBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'transform 0.1s ease',
                        flexShrink: 0,
                        ...circleStyle,
                      }}
                    >
                      {isDone && <Checkmark color={theme.contrastText} />}
                    </button>
                  )}
                </div>
                {/* Day label */}
                <span style={{
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? theme.hex : 'var(--text-muted)',
                  letterSpacing: '0.05em',
                }}>
                  {MON_DAY_LABELS[i]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Summary line */}
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
          {weekCompletedCount}/7 days
          {activeSplit ? ` · ${activeSplit.emoji} ${activeSplit.name}` : ''}
        </p>

        {/* Monthly calendar expansion */}
        <div style={{
          maxHeight: showMonth ? '420px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <div style={{ paddingTop: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>
              {MONTH_NAMES[today.getMonth()]} {today.getFullYear()}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {DAY_LABELS.map((l, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>{l}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {getMonthDays().map((day, i) => {
                if (!day) return <div key={i} style={{ aspectRatio: '1' }} />

                const info        = getDayInfo(day)
                const isToday     = toDateStr(day) === todayStr
                const isTodayDone = info.type === 'today-done'
                const isDone      = info.type === 'done'
                const isTodayPend = info.type === 'today-pending'
                const isTodayRest = info.type === 'today-rest'
                const isCardio    = info.type === 'cardio'
                const isTodayCard = info.type === 'today-cardio'
                const isFuture    = info.type === 'future'
                const isFutureRest = info.type === 'future-rest'
                const isPastRest  = info.type === 'past-rest'
                const isCompleted = isDone || isTodayDone

                let cellBg = 'rgba(255,255,255,0.04)'
                let textColor = 'var(--text-muted)'
                if (isTodayDone)  { cellBg = theme.hex; textColor = theme.contrastText }
                else if (isDone)  { cellBg = theme.hex + '33'; textColor = theme.hex }
                else if (isCardio || isTodayCard) { cellBg = 'rgba(96,165,250,0.2)'; textColor = '#60a5fa' }

                return (
                  <button
                    key={i}
                    onPointerDown={() => (isCompleted || isCardio || isTodayCard) && navigate('/history')}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      backgroundColor: cellBg,
                      border: isTodayPend ? `2px solid ${theme.hex}` : 'none',
                      cursor: (isCompleted || isCardio || isTodayCard) ? 'pointer' : 'default',
                      background: cellBg,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: textColor, lineHeight: 1 }}>{day.getDate()}</span>
                    {(isCompleted) && (
                      <span style={{ fontSize: 8, lineHeight: 1, marginTop: 2, color: isTodayDone ? theme.contrastText : theme.hex }}>
                        {isTodayDone ? '✓' : info.emoji}
                      </span>
                    )}
                    {(isCardio || isTodayCard) && (
                      <span style={{ fontSize: 8, fontWeight: 700, lineHeight: 1, marginTop: 2 }}>C</span>
                    )}
                    {(isTodayRest || isFutureRest || isPastRest) && (
                      <span style={{ fontSize: 8, lineHeight: 1, marginTop: 2, opacity: isTodayRest ? 0.5 : 0.3, fontWeight: 600, color: 'var(--text-muted)' }}>R</span>
                    )}
                    {isTodayPend && (
                      <span style={{ fontSize: 8, lineHeight: 1, marginTop: 2, opacity: 0.5 }}>{info.emoji}</span>
                    )}
                    {isFuture && info.emoji && (
                      <span style={{ fontSize: 8, lineHeight: 1, marginTop: 2, opacity: 0.2 }}>{info.emoji}</span>
                    )}
                    {info.hasCardio && isCompleted && (
                      <span style={{ fontSize: 6, color: '#60a5fa', lineHeight: 1 }}>●</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Hero Workout Card ────────────────────────────────────── */}
      <div style={{ ...fadeIn(200), padding: '0 16px', marginBottom: 10, position: 'relative' }}>
        {/* Atmospheric glow */}
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
            <div style={accentCardStyle}>
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
                  <span className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: theme.contrastText, opacity: 0.75 }} />
                  <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: 10, height: 10, backgroundColor: theme.contrastText, opacity: 0.8 }} />
                </span>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>
                  {activeSession.isPaused ? 'Paused' : 'In Progress'}
                </p>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
                {getWorkoutEmoji(activeSession.type)} {getWorkoutName(activeSession.type)}
              </p>
              <p style={{ fontSize: 13, marginTop: 4, marginBottom: 20, opacity: 0.6 }}>
                {activeSession.exercises?.filter(ex => ex.sets?.some(s => s.reps || s.weight)).length || 0} exercise{activeSession.exercises?.filter(ex => ex.sets?.some(s => s.reps || s.weight)).length === 1 ? '' : 's'} logged so far
              </p>
              <button
                onClick={() => navigate(`/log/bb/${activeSession.type}`)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', fontWeight: 700, fontSize: 17, padding: '16px 0', borderRadius: 16, border: 'none', cursor: 'pointer', color: theme.contrastText }}
              >
                Resume Workout →
              </button>
            </div>
          ) : isRestDay ? (
            <div style={{
              backgroundColor: theme.hex,
              backgroundImage: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              borderRadius: 20,
              padding: '24px 20px',
              textAlign: 'center',
              boxShadow: `0 8px 32px ${theme.hex}40`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, color: accentIsLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.6)' }}>Today</p>
              <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, color: accentIsLight ? 'rgba(0,0,0,0.9)' : '#fff' }}>Rest Day</p>
              <p style={{ fontSize: 13, marginTop: 12, fontWeight: 600, color: accentIsLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>
                Next: {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
              </p>
            </div>
          ) : (
            <div style={accentCardStyle}>
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              }} />
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, opacity: 0.6 }}>
                {todayLogged ? 'Next in your split' : missedYesterdayWorkout ? 'Missed Yesterday' : 'Next Up'}
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
                {getWorkoutName(recommendedWorkout)}
              </p>
              <div
                onPointerDown={() => setShowPreview(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  marginBottom: 4,
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `1px solid ${accentIsLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.35)'}`,
                  backgroundColor: accentIsLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
                  color: accentIsLight ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: 0.3,
                }}
              >
                <span style={{ fontSize: 12 }}>👁</span> Preview
              </div>
              {todayLogged ? (
                <p style={{ fontSize: 13, marginTop: 12, opacity: 0.6 }}>Rest up — come back tomorrow.</p>
              ) : (
                <>
                  <p style={{ fontSize: 13, marginTop: 4, marginBottom: 20, opacity: 0.6 }}>
                    {streak > 0 ? `${streak}-day streak` : 'Start your streak today!'}
                  </p>
                  <button
                    onClick={() => navigate(`/log/bb/${recommendedWorkout}`)}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', fontWeight: 700, fontSize: 17, padding: '16px 0', borderRadius: 16, border: 'none', cursor: 'pointer', color: theme.contrastText }}
                  >
                    Start Session →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Soreness check-in prompt ─────────────────────────────────────────── */}
      {pendingSorenessSession && (
        <div style={{ ...fadeIn(280), padding: '0 16px', marginBottom: 10 }}>
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

      {/* ── SECTION 4: Stat Cards ────────────────────────────────────────────── */}
      <div style={{ ...fadeIn(300), padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>

          {/* Volume card */}
          <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
              Volume
            </p>
            {/* This week */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: theme.hex, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {formatVolume(anim(volumeThisWeek))}
              </span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              This week ({daysIntoWeek}d)
            </p>
            {/* Last week */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dim)', lineHeight: 1 }}>
                {formatVolume(anim(volumeLastWeek))}
              </span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>Last week</p>
            {/* Comparison bar */}
            <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${volBarPct}%`,
                background: `linear-gradient(90deg, ${theme.hex}, ${theme.hex}aa)`,
                borderRadius: 2,
                transition: 'width 0.7s ease',
              }} />
            </div>
            {/* Insight */}
            <p style={{ fontSize: 10, color: volumeInsight.color, lineHeight: 1.4 }}>
              {volumeInsight.text}
            </p>
          </div>

          {/* Time in Gym card */}
          <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: 14 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
              Time in Gym
            </p>
            {/* This week */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: theme.hex, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {formatTime(anim(timeThisWeek))}
              </span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
              This week ({daysIntoWeek}d)
            </p>
            {/* Last week */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-dim)', lineHeight: 1 }}>
                {formatTime(anim(timeLastWeek))}
              </span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>Last week</p>
            {/* Comparison bar */}
            <div style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${timeBarPct}%`,
                background: `linear-gradient(90deg, ${theme.hex}, ${theme.hex}aa)`,
                borderRadius: 2,
                transition: 'width 0.7s ease',
              }} />
            </div>
            {/* Insight */}
            <p style={{ fontSize: 10, color: timeInsight.color, lineHeight: 1.4 }}>
              {timeInsight.text}
            </p>
          </div>

        </div>
      </div>

      {/* ── SECTION 5: Log Cardio ghost button ──────────────────────────────── */}
      <div style={{ ...fadeIn(420), display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
        <button
          onClick={() => navigate('/cardio')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 20px',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Log Cardio
        </button>
      </div>

      {/* ── Soreness Modal ───────────────────────────────────────────────────── */}
      {showSorenessModal && pendingSorenessSession && (
        <SorenessModal
          workoutLabel={sorenessWorkoutLabel}
          onRate={handleSorenessRate}
          onSkip={handleSorenessSkip}
        />
      )}

      {/* ── Tutorial overlay ─────────────────────────────────────────────────── */}
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
