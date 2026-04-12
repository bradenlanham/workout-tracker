import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, getRotationItemOnDate, getWorkoutStreak } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE, BB_EXERCISE_GROUPS } from '../data/exercises'

// ── Streak tier ───────────────────────────────────────────────────────────────
const STREAK_BADGE_CSS = `
@keyframes dashLegendaryShimmer {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes dashMythicShimmer {
  0%   { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
`

function getStreakTier(streak, themeHex) {
  if (streak >= 30) return {
    name: 'Mythic', color: '#A855F7', isAnimated: true,
    gradient: 'linear-gradient(90deg, #A855F7, #06B6D4, #EC4899, #A855F7)',
    glow: 'drop-shadow(0 0 8px rgba(168,85,247,0.55))',
    animName: 'dashMythicShimmer',
  }
  if (streak >= 20) return {
    name: 'Legendary', color: '#F97316', isAnimated: true,
    gradient: 'linear-gradient(90deg, #F97316, #FBBF24, #EF4444, #F97316)',
    glow: null,
    animName: 'dashLegendaryShimmer',
  }
  if (streak >= 15) return { name: 'Epic',      color: '#F5C842', isAnimated: false }
  if (streak >= 6)  return { name: 'Rare',      color: '#A8A8B3', isAnimated: false }
  return                   { name: 'Common',    color: themeHex,  isAnimated: false }
}

function StreakBadge({ streak, themeHex }) {
  if (!streak || streak === 0) return null
  const tier = getStreakTier(streak, themeHex)

  if (tier.isAnimated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, marginTop: 8, marginRight: 6 }}>
        {/* Animated gradient border wrapper */}
        <div style={{
          borderRadius: 20,
          padding: 1.5,
          background: tier.gradient,
          backgroundSize: '300% 300%',
          animation: `${tier.animName} 3s linear infinite`,
          filter: tier.glow || undefined,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 13px',
            borderRadius: 18,
            backgroundColor: 'rgba(10,10,14,0.85)',
          }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: tier.color, lineHeight: 1 }}>{streak}</span>
            <span style={{ fontSize: 22, lineHeight: 1 }}>🔥</span>
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
          color: tier.color, textTransform: 'uppercase', lineHeight: 1, opacity: 0.9,
        }}>
          {tier.name}
        </span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0, marginTop: 8, marginRight: 6 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '6px 14px',
        borderRadius: 20,
        border: `1.5px solid ${tier.color}`,
        backgroundColor: 'rgba(0,0,0,0.25)',
      }}>
        <span style={{ fontSize: 24, fontWeight: 800, color: tier.color, lineHeight: 1 }}>{streak}</span>
        <span style={{ fontSize: 22, lineHeight: 1 }}>🔥</span>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
        color: tier.color, textTransform: 'uppercase', lineHeight: 1, opacity: 0.9,
      }}>
        {tier.name}
      </span>
    </div>
  )
}

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

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function polarToCart(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const s = polarToCart(cx, cy, r, startAngle)
  const e = polarToCart(cx, cy, r, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
}

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

// ── Ambient particles (static — no re-render jitter) ─────────────────────────
const PARTICLES = [
  { w:3, left:'5%',  dur:'14s', delay:'-3s',  drift:'-15px', op:0.5 },
  { w:2, left:'12%', dur:'19s', delay:'-8s',  drift:'20px',  op:0.35 },
  { w:5, left:'18%', dur:'11s', delay:'-1s',  drift:'-25px', op:0.6 },
  { w:2, left:'25%', dur:'22s', delay:'-14s', drift:'10px',  op:0.3 },
  { w:4, left:'33%', dur:'16s', delay:'-6s',  drift:'-20px', op:0.55 },
  { w:3, left:'40%', dur:'13s', delay:'-11s', drift:'30px',  op:0.4 },
  { w:6, left:'47%', dur:'18s', delay:'-4s',  drift:'-10px', op:0.25 },
  { w:2, left:'54%', dur:'21s', delay:'-16s', drift:'15px',  op:0.5 },
  { w:4, left:'60%', dur:'12s', delay:'-7s',  drift:'-30px', op:0.45 },
  { w:3, left:'67%', dur:'17s', delay:'-2s',  drift:'20px',  op:0.6 },
  { w:5, left:'73%', dur:'20s', delay:'-13s', drift:'-15px', op:0.35 },
  { w:2, left:'79%', dur:'15s', delay:'-9s',  drift:'25px',  op:0.5 },
  { w:4, left:'85%', dur:'23s', delay:'-5s',  drift:'-20px', op:0.4 },
  { w:3, left:'90%', dur:'10s', delay:'-17s', drift:'10px',  op:0.55 },
  { w:2, left:'95%', dur:'16s', delay:'-3s',  drift:'-25px', op:0.3 },
  { w:5, left:'8%',  dur:'19s', delay:'-12s', drift:'15px',  op:0.45 },
  { w:3, left:'44%', dur:'14s', delay:'-8s',  drift:'-10px', op:0.5 },
  { w:4, left:'70%', dur:'21s', delay:'-1s',  drift:'20px',  op:0.35 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { sessions, settings, splits, activeSplitId, updateSession, customTemplates, cardioSessions, updateSettings, activeSession, restDaySessions, addRestDaySession, deleteRestDaySession } = useStore()
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
  const [pressedDay, setPressedDay] = useState(null)
  const [pressedStreak, setPressedStreak] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [selectedDaySession, setSelectedDaySession] = useState(null)
  const [selectedFutureDay, setSelectedFutureDay] = useState(null) // { dateStr, workoutId, isRest }

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

  const streak = getWorkoutStreak(sessions, rotation, cardioSessions, restDaySessions)

  const RING_TIERS = [
    { name: 'Common',    startAngle: 0,     endAngle: 51.4,  color: theme.hex,  minStreak: 0  },
    { name: 'Rare',      startAngle: 51.4,  endAngle: 144,   color: '#A8A8B3',  minStreak: 6  },
    { name: 'Epic',      startAngle: 144,   endAngle: 195.4, color: '#F5C842',  minStreak: 15 },
    { name: 'Legendary', startAngle: 195.4, endAngle: 298,   color: '#F97316',  minStreak: 20 },
    { name: 'Mythic',    startAngle: 298,   endAngle: 360,   color: '#A855F7',  minStreak: 30 },
  ]
  const TIER_MAX_DISPLAY = 35
  const currentTier = getStreakTier(streak, theme.hex)
  const nextTierText = (() => {
    if (streak >= 30) return "You've reached Mythic"
    const steps = [{ at: 6, name: 'Rare' }, { at: 15, name: 'Epic' }, { at: 20, name: 'Legendary' }, { at: 30, name: 'Mythic' }]
    const n = steps.find(t => streak < t.at)
    if (!n) return "You've reached Mythic"
    const days = n.at - streak
    return `${days} day${days === 1 ? '' : 's'} to ${n.name}`
  })()

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
  const yesterdayLogged = sessions.some(s => s.date?.split('T')[0] === yesterdayStr) || cardioSessions.some(c => c.date?.split('T')[0] === yesterdayStr) || (restDaySessions || []).some(r => r.date?.split('T')[0] === yesterdayStr)
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

  const restDayDateSet = new Set(
    (restDaySessions || []).map(r => r.date?.split('T')[0]).filter(Boolean)
  )
  const restDayLoggedToday = restDayDateSet.has(todayStr)
  // Count rest day allotment per rotation cycle
  const restDayAllotment = (rotation || []).filter(t => t === 'rest').length

  const isRestDay = (nextRotationItem === 'rest' && !todayLogged && !missedYesterdayWorkout) || (restDayLoggedToday && !todayLogged)

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
    const hasLoggedRest = restDayDateSet.has(dStr)

    if (cardioOnly) {
      return { type: isToday ? 'today-cardio' : 'cardio', hasCardio: true }
    }
    if (session) {
      return { type: isToday ? 'today-done' : 'done', session, emoji: getWorkoutEmoji(session.type), hasCardio }
    }
    if (hasLoggedRest) {
      return { type: isToday ? 'today-logged-rest' : 'logged-rest' }
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

  // ── Sun-Sat week days for circle calendar ────────────────────────────────
  const sundayOffset = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - sundayOffset + i)
    return d
  })

  // Count completed workout days this Sun-Sat week
  const weekCompletedCount = weekDays.filter(d => {
    const info = getDayInfo(d)
    return info.type === 'done' || info.type === 'today-done' || info.type === 'cardio' || info.type === 'today-cardio' || info.type === 'logged-rest' || info.type === 'today-logged-rest'
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
      const postPhrases = ['Done. ✓', 'Work done. ✓', 'Locked in. ✓', 'Session logged. ✓']
      return {
        headline: postPhrases[totalSessions % 4],
        sub: `${totalSessions} sessions and counting.`,
      }
    }
    if (daysSinceLastWorkout > 7 && streak <= 2) {
      return {
        headline: `Welcome back${settings.userName ? `, ${settings.userName}` : ''}.`,
        sub: `You were gone ${daysSinceLastWorkout} days. You showed up — that's what matters.`,
      }
    }
    if (streak >= 30) {
      const phrases = ["You're a myth.", 'Mythic.']
      return { headline: phrases[totalSessions % 2], sub: `${streak} days. Unreal.` }
    }
    if (streak >= 20) {
      const phrases = ['Unstoppable.', `${streak} days strong.`]
      return { headline: phrases[totalSessions % 2], sub: `${streak} days and counting.` }
    }
    if (streak >= 15) {
      const phrases = ['On a tear.', `${streak} days straight.`]
      return { headline: phrases[totalSessions % 2], sub: `Keep the streak alive.` }
    }
    if (streak >= 6) {
      const phrases = [`${streak} days in.`, 'Keep stacking.']
      return { headline: phrases[totalSessions % 2], sub: `${totalSessions} sessions logged.` }
    }
    const defaultPhrases = ["Let's work.", 'Time to build.', 'Get after it.']
    return {
      headline: defaultPhrases[totalSessions % 3],
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
    backgroundColor: hexToRgba(theme.hex, 0.82),
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 20,
    padding: '32px 20px 20px',
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
        @keyframes particleDrift {
          0%   { transform: translateY(100vh) translateX(0px); opacity: 0; }
          10%  { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-60px) translateX(var(--drift)); opacity: 0; }
        }
        ${STREAK_BADGE_CSS}
      `}</style>

      {/* ── Floating particles overlay ───────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden', opacity: isDark ? 1 : 0.4 }}>
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: p.left,
              width: p.w,
              height: p.w,
              borderRadius: p.w <= 3 ? 1 : '50%',
              backgroundColor: theme.hex,
              opacity: p.op,
              animationName: 'particleDrift',
              animationDuration: p.dur,
              animationDelay: p.delay,
              animationTimingFunction: 'linear',
              animationIterationCount: 'infinite',
              '--drift': p.drift,
            }}
          />
        ))}
      </div>

      {/* ── Top radial glow ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: -120, left: '50%',
        transform: 'translateX(-50%)',
        width: 500, height: 400,
        background: `radial-gradient(ellipse at center, ${theme.hex}${isDark ? '20' : '0D'} 0%, ${theme.hex}${isDark ? '08' : '04'} 40%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ── Bottom radial glow (dark only) ───────────────────────────────────── */}
      {isDark && (
        <div style={{
          position: 'fixed', bottom: -80, left: '50%',
          transform: 'translateX(-50%)',
          width: 600, height: 350,
          background: 'radial-gradient(ellipse at center, rgba(30,20,60,0.5) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}

      {/* ── Page content (above ambient layer) ───────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 2 }}>

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
          <div
            onPointerDown={() => setPressedStreak(true)}
            onPointerUp={() => { setPressedStreak(false); setShowTierModal(true) }}
            onPointerLeave={() => setPressedStreak(false)}
            onPointerCancel={() => setPressedStreak(false)}
            style={{ transform: pressedStreak ? 'scale(0.88)' : 'scale(1)', transition: 'transform 80ms ease', cursor: 'pointer' }}
          >
            <StreakBadge streak={streak} themeHex={theme.hex} />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Circle Calendar ──────────────────────────────────────── */}
      <div style={{ ...fadeIn(100), padding: '0 16px', marginBottom: 10, marginTop: -28 }}>
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
          {weekDays.map((day, i) => {
            const info        = getDayInfo(day)
            const isToday     = toDateStr(day) === todayStr
            const isDone      = info.type === 'done' || info.type === 'today-done' || info.type === 'cardio' || info.type === 'today-cardio'
            const isPending   = info.type === 'today-pending'
            const isRestType  = info.type === 'today-rest' || info.type === 'past-rest' || info.type === 'future-rest'
            const isLoggedRest = info.type === 'logged-rest' || info.type === 'today-logged-rest'
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
            } else if (isLoggedRest) {
              circleSize = 10
              circleBg = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'
            } else {
              // future or empty
              circleBg = isDark ? 'rgba(255,255,255,0.06)' : 'transparent'
              if (!isDark) {
                circleStyle = { border: `1px solid ${theme.hex}4D` }
              }
            }

            const isRestDot = isRestType || isLoggedRest

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
                      backgroundColor: isLoggedRest
                        ? (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.3)')
                        : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                    }} />
                  ) : (
                    <button
                      onPointerDown={(e) => {
                        e.preventDefault()
                        const dayKey = toDateStr(day)
                        setPressedDay(dayKey)
                        if (isDone) {
                          const s = sessionByDate[dayKey]
                          if (s) setSelectedDaySession(s)
                        } else if (isFutureDay) {
                          setSelectedFutureDay({ dateStr: dayKey, workoutId: info.planned, isRest: false })
                        } else if (info.type === 'future-rest') {
                          setSelectedFutureDay({ dateStr: dayKey, workoutId: null, isRest: true })
                        } else if (info.type !== 'today-pending' && info.type !== 'today-rest') {
                          navigate('/history')
                        }
                      }}
                      onPointerUp={() => setPressedDay(null)}
                      onPointerLeave={() => setPressedDay(null)}
                      onPointerCancel={() => setPressedDay(null)}
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
                        transform: pressedDay === toDateStr(day) ? 'scale(0.82)' : 'scale(1)',
                        transition: 'transform 80ms ease',
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
                  {DAY_LABELS[i]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Summary line */}
        {activeSplit && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
            {activeSplit.emoji} {activeSplit.name}
          </p>
        )}

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
                const isLoggedRestDay = info.type === 'logged-rest' || info.type === 'today-logged-rest'
                const isCompleted = isDone || isTodayDone

                let cellBg = 'rgba(255,255,255,0.04)'
                let textColor = 'var(--text-muted)'
                if (isTodayDone)  { cellBg = theme.hex; textColor = theme.contrastText }
                else if (isDone)  { cellBg = theme.hex + '33'; textColor = theme.hex }
                else if (isCardio || isTodayCard) { cellBg = 'rgba(96,165,250,0.2)'; textColor = '#60a5fa' }
                else if (isLoggedRestDay) { cellBg = 'rgba(255,255,255,0.1)'; textColor = 'var(--text-secondary)' }

                return (
                  <button
                    key={i}
                    onPointerDown={() => {
                      if (isCompleted) {
                        const s = sessionByDate[toDateStr(day)]
                        if (s) setSelectedDaySession(s)
                      } else if (isCardio || isTodayCard) {
                        navigate('/history')
                      }
                    }}
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
                    {isLoggedRestDay && (
                      <span style={{ fontSize: 8, lineHeight: 1, marginTop: 2, fontWeight: 700, color: 'var(--text-secondary)' }}>R</span>
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
              backgroundColor: hexToRgba(theme.hex, 0.82),
              backgroundImage: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 20,
              padding: '32px 20px',
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
                  marginBottom: 16,
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
                Preview
              </div>
              {todayLogged ? (
                <p style={{ fontSize: 13, marginTop: 12, opacity: 0.6 }}>Rest up — come back tomorrow.</p>
              ) : (
                <>
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
            className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
            }}
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
          <div style={{
            flex: 1,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
            borderRadius: 16,
            padding: 14,
          }}>
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
          <div style={{
            flex: 1,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.06)',
            borderRadius: 16,
            padding: 14,
          }}>
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

      {/* ── SECTION 5: Log Cardio + Log Rest Day ghost buttons ─────────────── */}
      <div style={{ ...fadeIn(420), display: 'flex', justifyContent: 'center', gap: 4, paddingBottom: 8 }}>
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
            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
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
        <button
          onClick={() => {
            if (restDayLoggedToday) {
              // Un-log: find and remove today's rest day entry
              const todayEntry = (restDaySessions || []).find(r => r.date?.split('T')[0] === todayStr)
              if (todayEntry) deleteRestDaySession(todayEntry.id)
            } else {
              addRestDaySession(new Date().toISOString())
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 20px',
            color: restDayLoggedToday
              ? (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)')
              : (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)'),
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {restDayLoggedToday ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Rest Logged
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              Log Rest Day
            </>
          )}
        </button>
      </div>

      </div>{/* end content wrapper */}

      {/* ── Tier Progress Ring Modal ─────────────────────────────────────────── */}
      {showTierModal && (
        <div
          onClick={() => setShowTierModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: 'rgba(20,18,28,0.95)', borderRadius: 28, padding: '32px 28px', width: 300, textAlign: 'center', position: 'relative' }}
          >
            <button
              onClick={() => setShowTierModal(false)}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'rgba(255,255,255,0.4)', lineHeight: 1, padding: '4px 8px' }}
            >×</button>

            <svg width="240" height="240" viewBox="0 0 240 240" style={{ overflow: 'visible' }}>
              {/* Background track */}
              <circle cx="120" cy="120" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />

              {/* Tier arc segments */}
              {RING_TIERS.map((tier, i) => {
                const next = RING_TIERS[i + 1]
                const isCurrent = streak >= tier.minStreak && (!next || streak < next.minStreak)
                const isPast    = next ? streak >= next.minStreak : false
                const opacity   = isCurrent ? 1 : isPast ? 0.2 : 0.12
                const sw        = isCurrent ? 18 : 14
                return (
                  <path
                    key={tier.name}
                    d={describeArc(120, 120, 90, tier.startAngle, tier.endAngle)}
                    fill="none"
                    stroke={tier.color}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    opacity={opacity}
                    style={isCurrent ? { filter: `drop-shadow(0 0 6px ${tier.color}88)` } : undefined}
                  />
                )
              })}

              {/* Tick marks at tier boundaries */}
              {[51.4, 144, 195.4, 298].map((angle, i) => {
                const pos = polarToCart(120, 120, 90, angle)
                return <circle key={i} cx={pos.x} cy={pos.y} r={4} fill="white" opacity={0.6} />
              })}

              {/* Progress dot */}
              {(() => {
                const progressAngle = Math.min(streak, TIER_MAX_DISPLAY) / TIER_MAX_DISPLAY * 360
                const pos = polarToCart(120, 120, 90, progressAngle)
                return (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={8}
                    fill="white"
                    style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))' }}
                  />
                )
              })()}

              {/* Center text */}
              <text x="120" y="108" textAnchor="middle" fill="white" fontSize="42" fontWeight="800">{streak}</text>
              <text x="120" y="132" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="13">days</text>
            </svg>

            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, color: currentTier.color, marginTop: 8 }}>
              {currentTier.name}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
              {nextTierText}
            </div>
          </div>
        </div>
      )}

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

      {/* ── Session Detail Bottom Sheet ──────────────────────────────────────── */}
      {selectedDaySession && (
        <>
          <div
            onClick={() => setSelectedDaySession(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '75vh', overflowY: 'auto',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 16px 40px',
            zIndex: 201,
          }}>
            {/* Drag handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {getWorkoutEmoji(selectedDaySession.type)} {getWorkoutName(selectedDaySession.type)}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                  {new Date(selectedDaySession.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  {selectedDaySession.duration ? ` · ${selectedDaySession.duration}m` : ''}
                  {selectedDaySession.grade ? ` · Grade ${selectedDaySession.grade}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedDaySession(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'var(--text-secondary)', flexShrink: 0,
                }}
              >×</button>
            </div>
            {/* Exercise list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(selectedDaySession.data?.exercises || []).map((ex, i) => {
                const setsToShow = (ex.sets || []).filter(s => s.weight || s.reps)
                if (!setsToShow.length) return null
                return (
                  <div key={i}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
                      {ex.name}
                      {ex.isNewPR && <span style={{ fontSize: 10, color: theme.hex, marginLeft: 6 }}>🏆 PR</span>}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {setsToShow.map((set, j) => (
                        <p key={j} style={{ fontSize: 12, color: set.type === 'warmup' ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                          {set.type === 'warmup' ? 'Warm-up' : `Set ${setsToShow.filter((s, k) => k <= j && s.type !== 'warmup').length}`}:{' '}
                          {set.weight ? `${set.weight} lbs` : '—'} × {set.reps || '—'}
                          {set.isNewPR && <span style={{ fontSize: 10, color: theme.hex, marginLeft: 4 }}>🏆</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Future Day Bottom Sheet ─────────────────────────────────────────── */}
      {selectedFutureDay && (
        <>
          <div
            onClick={() => setSelectedFutureDay(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '75vh', overflowY: 'auto',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px 20px 0 0',
            padding: '20px 16px 40px',
            zIndex: 201,
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {selectedFutureDay.isRest
                    ? 'Rest Day'
                    : `${getWorkoutEmoji(selectedFutureDay.workoutId)} ${getWorkoutName(selectedFutureDay.workoutId)}`}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>
                  {new Date(selectedFutureDay.dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  {' · '}
                  <span style={{ color: theme.hex }}>Scheduled</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedFutureDay(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: 'var(--text-secondary)', flexShrink: 0,
                }}
              >×</button>
            </div>
            {selectedFutureDay.isRest ? (
              <div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Recovery day — no lifting scheduled.
                </p>
                {nextBb && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    Next workout: {getWorkoutEmoji(nextBb)} {getWorkoutName(nextBb)}
                  </p>
                )}
              </div>
            ) : (() => {
              const fw = activeSplit?.workouts?.find(w => w.id === selectedFutureDay.workoutId)
              const sections = fw?.sections || BB_EXERCISE_GROUPS[selectedFutureDay.workoutId] || []
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {sections.map((section, si) => (
                    <div key={si}>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                        {section.label}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {(section.exercises || []).map((ex, ei) => {
                          const name = typeof ex === 'string' ? ex : ex.name
                          return (
                            <p key={ei} style={{ fontSize: 13, color: 'var(--text-secondary)', paddingBottom: 4, borderBottom: '1px solid var(--border-subtle)' }}>
                              {name}
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </>
      )}

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
