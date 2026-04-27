import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout, getRotationItemOnDate, getWorkoutStreak, getSplitSessionCount, formatTimeAgo } from '../utils/helpers'
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
@keyframes dashFadeInV2 {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
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

// ── Compact 3-metric tile used in the header (Total / Split / Streak) ───────
// Number + label stack, right-aligned. Streak variant supports an inline
// flame (baseline-aligned with the digits) and an animated gradient ring
// for Legendary / Mythic tiers.
function MetricStat({ number, label, numberColor, labelColor, suffix, animatedTier }) {
  const numStyle = {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1,
    color: numberColor || 'var(--text-primary)',
    fontVariantNumeric: 'tabular-nums',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }
  const labStyle = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: labelColor || 'var(--text-muted)',
    marginTop: 4,
    lineHeight: 1,
  }
  const inner = (
    <span style={numStyle}>
      <span>{number}</span>
      {suffix && (
        <span style={{ fontSize: 18, lineHeight: 1, display: 'inline-block', transform: 'translateY(-1px)' }}>
          {suffix}
        </span>
      )}
    </span>
  )
  const numberNode = animatedTier ? (
    <span style={{
      display: 'inline-block',
      padding: '2px 4px',
      borderRadius: 8,
      background: animatedTier.gradient,
      backgroundSize: '300% 300%',
      animation: `${animatedTier.animName} 3s linear infinite`,
      filter: animatedTier.glow || undefined,
    }}>
      <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: 6, backgroundColor: 'rgba(10,10,14,0.85)' }}>
        {inner}
      </span>
    </span>
  ) : inner
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
      {numberNode}
      <span style={labStyle}>{label}</span>
    </div>
  )
}

// ── Tutorial overlay ──────────────────────────────────────────────────────────
// Re-anchored for v2 layout: hero card at top, week card mid-page,
// streak row + recents below. Action buttons at the bottom of content.
const TUTORIAL_STEPS = [
  {
    text: 'This is your next workout. Tap Start Session to begin.',
    style: { top: 240, left: 16, right: 16 },
  },
  {
    text: 'Your week at a glance — the dot for each day fills as you train.',
    style: { top: 470, left: 16, right: 16 },
  },
  {
    text: 'Recent sessions live here. Tap one to see what you did.',
    style: { top: 620, left: 16, right: 16 },
  },
  {
    text: 'Settings, splits, and more live behind the menu.',
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

function isoToLocalDateStr(iso) {
  if (!iso) return null
  return toDateStr(new Date(iso))
}

function daysBetween(a, b) {
  const aMs = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const bMs = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((bMs - aMs) / 86400000)
}

// ── ISO week (for "Week N" label inside the week card) ──────────────────────
// Derived per ISO 8601 — week 1 contains the first Thursday of the year.
function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

function formatVolume(lbs) {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`
  return lbs === 0 ? '—' : `${lbs}`
}

function formatTime(mins) {
  if (!mins || mins === 0) return '—'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Relative date label for recents row (e.g. "Yesterday · 47 min · 32k volume")
function relativeDateLabel(iso) {
  const local = isoToLocalDateStr(iso)
  if (!local) return ''
  const today = toDateStr(new Date())
  const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toDateStr(d) })()
  if (local === today) return 'Today'
  if (local === yest) return 'Yesterday'
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000)
  if (diffDays > 0 && diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Grade badge color (matches History/share-card semantics)
function gradeBadgeStyle(grade, theme) {
  switch (grade) {
    case 'A+': return { bg: hexToRgba(theme.hex, 0.22), color: theme.hex, border: `1px solid ${hexToRgba(theme.hex, 0.4)}` }
    case 'A':  return { bg: 'rgba(52,211,153,0.18)', color: '#34D399', border: '1px solid rgba(52,211,153,0.35)' }
    case 'B':  return { bg: 'rgba(251,191,36,0.18)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.35)' }
    case 'C':  return { bg: 'rgba(248,113,113,0.18)', color: '#FCA5A5', border: '1px solid rgba(248,113,113,0.35)' }
    case 'D':  return { bg: 'rgba(220,38,38,0.18)', color: '#F87171', border: '1px solid rgba(220,38,38,0.35)' }
    default:   return { bg: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.12)' }
  }
}

// Compute the volume of a single session (top-level + nested drops).
function sessionVolume(s) {
  return (s.data?.exercises || []).reduce((exTotal, ex) => {
    return exTotal + (ex.sets || []).reduce((setTotal, set) => {
      const primary = (set.weight || 0) * (set.reps || 0)
      const drops = Array.isArray(set.drops)
        ? set.drops.reduce((d, dst) => d + (dst.weight || 0) * (dst.reps || 0), 0)
        : 0
      return setTotal + primary + drops
    }, 0)
  }, 0)
}

// Last N sessions of a given workout type, oldest → newest, with derived volume.
function workoutTypeHistory(sessions, workoutId, take = 8) {
  const matches = (sessions || [])
    .filter(s => s.type === workoutId && s.mode !== 'cardio')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-take)
  return matches.map(s => ({
    date: s.date,
    volume: sessionVolume(s),
    duration: s.duration || 0,
    grade: s.grade || null,
  }))
}

// Sparkline that scales to its container. Uses a fixed viewBox + 100% width
// so flex parents control its actual size. height stays fixed in pixels.
function VolumeSparkline({ history, accent, height = 28, fillWidth = true, width = 120 }) {
  if (!history || history.length < 2) return null
  const w = width // viewBox width — internal coord space, not rendered px
  const h = height
  const pad = 3
  const vols = history.map(p => p.volume)
  const min = Math.min(...vols)
  const max = Math.max(...vols)
  const range = Math.max(max - min, 1)
  const xStep = (w - pad * 2) / Math.max(history.length - 1, 1)
  const yFor = v => h - pad - ((v - min) / range) * (h - pad * 2)
  const xFor = i => pad + i * xStep
  const pathD = history.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.volume).toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${xFor(history.length - 1).toFixed(1)} ${h - pad} L ${xFor(0).toFixed(1)} ${h - pad} Z`
  const renderedWidth = fillWidth ? '100%' : width
  return (
    <svg
      width={renderedWidth}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={areaD} fill={accent} fillOpacity="0.14" />
      <path d={pathD} fill="none" stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {history.map((p, i) => {
        const isLast = i === history.length - 1
        return (
          <circle
            key={i}
            cx={xFor(i)}
            cy={yFor(p.volume)}
            r={isLast ? 2.6 : 1.4}
            fill={isLast ? accent : 'rgba(255,255,255,0.45)'}
          />
        )
      })}
    </svg>
  )
}

// Volume delta label — pairs with the sparkline.
function volumeDelta(history) {
  if (!history || history.length < 2) return null
  const last = history[history.length - 1].volume
  const prev = history[history.length - 2].volume
  if (prev <= 0) return null
  const pct = ((last - prev) / prev) * 100
  if (Math.abs(pct) < 1) return { text: 'flat', color: 'var(--text-muted)' }
  if (pct > 0) return { text: `+${Math.round(pct)}%`, color: '#34D399' }
  return { text: `${Math.round(pct)}%`, color: '#FCD34D' }
}

// Trend takeaway label for the sparkline. Linear regression slope across
// the window expressed as % of mean per session — robust against the
// noisy single-session % delta. Special-cases "Best in N" when the
// latest data point is also the window high.
function volumeTrend(history) {
  if (!history || history.length < 3) return null
  const vols = history.map(p => p.volume)
  const n = vols.length
  const xMean = (n - 1) / 2
  const yMean = vols.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (vols[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den > 0 ? num / den : 0
  const slopePct = yMean > 0 ? slope / yMean : 0
  const latest = vols[n - 1]
  const max = Math.max(...vols)
  const atPeak = latest >= max && n >= 3

  if (slopePct > 0.03) {
    return {
      label: atPeak ? `Best in ${n}` : 'Trending up',
      direction: 'up',
      color: '#34D399',
    }
  }
  if (slopePct < -0.03) {
    return { label: 'Trending down', direction: 'down', color: '#FCD34D' }
  }
  return { label: 'Holding steady', direction: 'steady', color: 'var(--text-muted)' }
}

// Tiny SVG corner-bracket — horizontal stub then a vertical drop with
// a small arrow head, used to visually join the trend label to the
// sparkline below it.
function JoinerArrow({ color = 'currentColor' }) {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" style={{ display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
      <path
        d="M 1 2 L 8 2 L 8 11"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <path
        d="M 6 9 L 8 12 L 10 9"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  )
}

// Static particle anchors — same pattern as v1 dashboard, drift upward.
const PARTICLES = [
  { w: 3, left: '5%',  dur: '14s', delay: '-3s',  drift: '-15px', op: 0.5 },
  { w: 2, left: '12%', dur: '19s', delay: '-8s',  drift: '20px',  op: 0.35 },
  { w: 5, left: '18%', dur: '11s', delay: '-1s',  drift: '-25px', op: 0.6 },
  { w: 2, left: '25%', dur: '22s', delay: '-14s', drift: '10px',  op: 0.3 },
  { w: 4, left: '33%', dur: '16s', delay: '-6s',  drift: '-20px', op: 0.55 },
  { w: 3, left: '40%', dur: '13s', delay: '-11s', drift: '30px',  op: 0.4 },
  { w: 6, left: '47%', dur: '18s', delay: '-4s',  drift: '-10px', op: 0.25 },
  { w: 2, left: '54%', dur: '21s', delay: '-16s', drift: '15px',  op: 0.5 },
  { w: 4, left: '60%', dur: '12s', delay: '-7s',  drift: '-30px', op: 0.45 },
  { w: 3, left: '67%', dur: '17s', delay: '-2s',  drift: '20px',  op: 0.6 },
  { w: 5, left: '73%', dur: '20s', delay: '-13s', drift: '-15px', op: 0.35 },
  { w: 2, left: '79%', dur: '15s', delay: '-9s',  drift: '25px',  op: 0.5 },
  { w: 4, left: '85%', dur: '23s', delay: '-5s',  drift: '-20px', op: 0.4 },
  { w: 3, left: '90%', dur: '10s', delay: '-17s', drift: '10px',  op: 0.55 },
  { w: 2, left: '95%', dur: '16s', delay: '-3s',  drift: '-25px', op: 0.3 },
  { w: 5, left: '8%',  dur: '19s', delay: '-12s', drift: '15px',  op: 0.45 },
  { w: 3, left: '44%', dur: '14s', delay: '-8s',  drift: '-10px', op: 0.5 },
  { w: 4, left: '70%', dur: '21s', delay: '-1s',  drift: '20px',  op: 0.35 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    sessions, settings, splits, activeSplitId, updateSession, customTemplates,
    cardioSessions, updateSettings, activeSession, restDaySessions,
    addRestDaySession, deleteRestDaySession, exerciseLibrary, importData,
  } = useStore()

  // ── Auto-seed demo data on first load (worktree-only convenience) ────────
  // When the device has zero sessions, pull /seed-data.json from the dev
  // server and merge it into the store via importData (which expects raw
  // JSON text). Sets a localStorage flag so we never re-seed once the user
  // has interacted with the app.
  useEffect(() => {
    if (sessions.length > 0) return
    if (localStorage.getItem('dashboard-v2-seeded') === '1') return
    localStorage.setItem('dashboard-v2-seeded', '1')
    fetch('/seed-data.json')
      .then(r => r.ok ? r.text() : null)
      .then(text => {
        if (!text) return
        try { importData(text) } catch (e) { console.warn('seed import failed', e) }
      })
      .catch(() => {})
  }, [sessions.length, importData])
  const theme = getTheme(settings.accentColor, settings.customAccentHex)
  const isDark = settings.backgroundTheme !== 'daylight'

  // Light vs dark accent → text-on-bg color
  const accentIsLight = (() => {
    const hex = (theme.hex || '#000000').replace('#', '')
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160
  })()

  const [showPreview, setShowPreview] = useState(false)
  const [previewWorkoutId, setPreviewWorkoutId] = useState(null)
  const [showSorenessModal, setShowSorenessModal] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(() => settings.hasSeenTutorial ? null : 0)
  const [pressedDay, setPressedDay] = useState(null)
  const [pressedStreak, setPressedStreak] = useState(false)
  const [showTierModal, setShowTierModal] = useState(false)
  const [selectedDaySession, setSelectedDaySession] = useState(null)
  const [selectedFutureDay, setSelectedFutureDay] = useState(null)
  const [weekDrawerOpen, setWeekDrawerOpen] = useState(false)

  const totalSessions = sessions.length

  // ── Volume / time computation ─────────────────────────────────────────────
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
      .reduce((total, s) => total + sessionVolume(s), 0)
  }

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

  const volumeThisWeek = getWeekVolume(0)
  const volumeLastWeek = getWeekVolume(-1)
  const timeThisWeek   = getWeekTime(0)
  const timeLastWeek   = getWeekTime(-1)

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // ── Active split helpers ──────────────────────────────────────────────────
  const activeSplit  = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const rotation     = activeSplit?.rotation || BB_WORKOUT_SEQUENCE
  const workoutSeq   = rotation.filter(t => t !== 'rest')

  const streak = getWorkoutStreak(sessions, cardioSessions, restDaySessions)
  const splitSessionCount = activeSplit ? getSplitSessionCount(sessions, activeSplit) : 0

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

  // First N exercises across ALL sections of a workout (for hero pill row).
  // Pulls the first 3 exercise names from any section, in section order.
  const getFirstExercisesAcrossSections = (workoutId, count = 3) => {
    const workout = activeSplit?.workouts?.find(w => w.id === workoutId)
    const sections = workout?.sections || BB_EXERCISE_GROUPS[workoutId] || []
    const out = []
    for (const section of sections) {
      for (const ex of (section.exercises || [])) {
        const name = typeof ex === 'string' ? ex : ex?.name
        if (name) out.push(name)
        if (out.length >= count) return out
      }
    }
    return out
  }

  // Total exercise count across all sections of a workout.
  const getExerciseCount = (workoutId) => {
    const workout = activeSplit?.workouts?.find(w => w.id === workoutId)
    const sections = workout?.sections || BB_EXERCISE_GROUPS[workoutId] || []
    return sections.reduce((total, s) => total + (s.exercises?.length || 0), 0)
  }
  const getSectionCount = (workoutId) => {
    const workout = activeSplit?.workouts?.find(w => w.id === workoutId)
    const sections = workout?.sections || BB_EXERCISE_GROUPS[workoutId] || []
    return sections.length
  }

  // Day-of-cycle eyebrow ("Day 3 of 5"). Counts non-rest items only and
  // returns the 1-based position of `recommendedWorkout` in workoutSeq.
  // Falls back gracefully when the workout isn't in the sequence.
  const getDayOfCycle = (workoutId) => {
    if (!workoutSeq.length) return null
    const idx = workoutSeq.indexOf(workoutId)
    if (idx === -1) return null
    return { day: idx + 1, total: workoutSeq.length }
  }

  // Days since last logged session of this workout type.
  const getDaysSinceLastOfType = (workoutId) => {
    const matches = sessions
      .filter(s => s.type === workoutId)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    if (!matches.length) return null
    const last = new Date(matches[0].date)
    const diff = Math.round((new Date() - last) / 86400000)
    if (diff <= 0) return 'today'
    if (diff === 1) return 'yesterday'
    return `${diff} days ago`
  }

  // ── Soreness check-in (yesterday's session) ───────────────────────────────
  const today    = new Date()
  const todayStr = toDateStr(today)
  const todayLogged = sessions.some(s => isoToLocalDateStr(s.date) === todayStr)

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = toDateStr(yesterday)

  const yesterdayLogged =
    sessions.some(s => isoToLocalDateStr(s.date) === yesterdayStr) ||
    cardioSessions.some(c => isoToLocalDateStr(c.date) === yesterdayStr) ||
    (restDaySessions || []).some(r => isoToLocalDateStr(r.date) === yesterdayStr)
  // Always recommend the next workout in the rotation — no "picking up
  // yesterday's missed workout" branch. Today is today.
  const recommendedWorkout = nextBb

  const activePreviewId = previewWorkoutId || recommendedWorkout
  const previewWorkout  = activeSplit?.workouts?.find(w => w.id === activePreviewId)
  const previewSections = previewWorkout?.sections || BB_EXERCISE_GROUPS[activePreviewId] || []

  const pendingSorenessSession = sessions.find(s => {
    const d = isoToLocalDateStr(s.date)
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
    updateSession(pendingSorenessSession.id, { soreness: { rating, date: yesterdayStr } })
    setShowSorenessModal(false)
  }
  const handleSorenessSkip = () => {
    if (!pendingSorenessSession) return
    updateSession(pendingSorenessSession.id, { soreness: { skipped: true, date: yesterdayStr } })
    setShowSorenessModal(false)
  }

  const restDayDateSet = new Set((restDaySessions || []).map(r => isoToLocalDateStr(r.date)).filter(Boolean))
  const restDayLoggedToday = restDayDateSet.has(todayStr)

  const isRestDay =
    (nextRotationItem === 'rest' && !todayLogged && !missedYesterdayWorkout) ||
    (restDayLoggedToday && !todayLogged)

  // ── Session map ───────────────────────────────────────────────────────────
  const sessionByDate = {}
  sessions.forEach(s => {
    const d = isoToLocalDateStr(s.date)
    if (!d) return
    if (!sessionByDate[d] || new Date(s.date) > new Date(sessionByDate[d].date)) {
      sessionByDate[d] = s
    }
  })

  const cardioDateSet = new Set((cardioSessions || []).filter(c => !c.attachedToSessionId).map(c => c.date))
  const cardioAndWorkoutDateSet = new Set((cardioSessions || []).map(c => c.date))

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
  const sundayOffset = today.getDay()
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - sundayOffset + i)
    return d
  })

  const weekCompletedCount = weekDays.filter(d => {
    const info = getDayInfo(d)
    return info.type === 'done' || info.type === 'today-done' || info.type === 'cardio' || info.type === 'today-cardio'
  }).length

  const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - sundayOffset - 7 + i)
    return d
  })
  const lastWeekCompletedCount = lastWeekDays.filter(d => {
    const info = getDayInfo(d)
    return info.type === 'done' || info.type === 'today-done' || info.type === 'cardio' || info.type === 'today-cardio'
  }).length

  // ── Week narrative sentence ───────────────────────────────────────────────
  // Simple v1: "{N} sessions this week" + a comparison frame to last week
  // + a single volume delta line. Per-muscle-group MoM is deferred.
  function getWeekNarrative() {
    if (weekCompletedCount === 0) {
      return {
        text: 'No sessions yet this week — open day. Tap Start Session above.',
        deltaText: null,
        deltaColor: null,
      }
    }

    const sessionWord = weekCompletedCount === 1 ? 'session' : 'sessions'
    let frame = ''
    if (lastWeekCompletedCount === 0) {
      frame = `${weekCompletedCount} ${sessionWord} this week — strong start.`
    } else if (weekCompletedCount > lastWeekCompletedCount) {
      const diff = weekCompletedCount - lastWeekCompletedCount
      frame = `${weekCompletedCount} ${sessionWord} this week, ${diff} ahead of last.`
    } else if (weekCompletedCount < lastWeekCompletedCount) {
      const diff = lastWeekCompletedCount - weekCompletedCount
      frame = `${weekCompletedCount} ${sessionWord} this week, ${diff} behind last.`
    } else {
      frame = `${weekCompletedCount} ${sessionWord} this week, on pace with last.`
    }

    let deltaText = null
    let deltaColor = null
    if (volumeLastWeek > 0) {
      const pct = ((volumeThisWeek - volumeLastWeek) / volumeLastWeek) * 100
      if (pct > 5) {
        deltaText = `Volume +${Math.round(pct)}% vs last.`
        deltaColor = '#34D399'
      } else if (pct < -5) {
        deltaText = `Volume ${Math.round(pct)}% vs last.`
        deltaColor = '#FCD34D'
      }
    }

    return { text: frame, deltaText, deltaColor }
  }
  const weekNarrative = getWeekNarrative()

  // ── Recents (last 3 sessions) ─────────────────────────────────────────────
  const recentSessions = sessions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)

  // ── Eyebrow + meta lines for the hero card ───────────────────────────────
  const heroDayOfCycle = getDayOfCycle(recommendedWorkout)
  const heroExerciseCount = (!isRestDay && !activeSession?.sessionStarted && !todayLogged)
    ? getExerciseCount(recommendedWorkout)
    : 0
  const heroSectionCount = (!isRestDay && !activeSession?.sessionStarted && !todayLogged)
    ? getSectionCount(recommendedWorkout)
    : 0
  const heroLastSeen = getDaysSinceLastOfType(recommendedWorkout)

  // Volume sparkline source — last 8 sessions of this workout type, in
  // chronological order. Shown when ≥2 sessions exist.
  const heroVolumeHistory = (!isRestDay && !activeSession?.sessionStarted && !todayLogged)
    ? workoutTypeHistory(sessions, recommendedWorkout, 8)
    : []
  // Fallback to exercise pills when history is too thin to plot.
  const heroExercisePills = (!isRestDay && !activeSession?.sessionStarted && !todayLogged && heroVolumeHistory.length < 2)
    ? getFirstExercisesAcrossSections(recommendedWorkout, 3)
    : []
  // Average duration across the last few sessions (when we have any).
  const heroAvgDuration = (() => {
    const withDur = heroVolumeHistory.filter(p => p.duration > 0)
    if (withDur.length === 0) return null
    const sum = withDur.reduce((t, p) => t + p.duration, 0)
    return Math.round(sum / withDur.length)
  })()

  // ── Hero card style (workout state — accent gradient wash) ────────────────
  const heroAccentCardStyle = {
    margin: '0 16px',
    borderRadius: 24,
    padding: '20px 18px 18px',
    background: `linear-gradient(135deg, ${hexToRgba(theme.hex, 0.18)} 0%, ${hexToRgba(theme.hex, 0.02)} 70%), var(--bg-card)`,
    border: `1px solid ${hexToRgba(theme.hex, 0.22)}`,
    boxShadow: `0 4px 30px ${hexToRgba(theme.hex, 0.10)}, inset 0 1px 0 rgba(255,255,255,0.04)`,
    position: 'relative',
    overflow: 'hidden',
  }

  // Resume-state hero (in-progress session) — same geometry, accent fill.
  const heroResumeCardStyle = {
    margin: '0 16px',
    borderRadius: 24,
    padding: '24px 18px 18px',
    backgroundColor: hexToRgba(theme.hex, 0.85),
    backgroundImage: 'radial-gradient(ellipse at 30% 0%, rgba(255,255,255,0.18) 0%, transparent 60%)',
    border: `1px solid ${hexToRgba(theme.hex, 0.45)}`,
    boxShadow: `0 8px 32px ${hexToRgba(theme.hex, 0.30)}, 0 2px 8px rgba(0,0,0,0.30)`,
    position: 'relative',
    overflow: 'hidden',
    color: theme.contrastText,
    textAlign: 'center',
  }

  // Rest-state hero — fixed blue tint regardless of accent so users see
  // they're in a different mode visually. Per design doc + critique mockup.
  const heroRestCardStyle = {
    margin: '0 16px',
    borderRadius: 24,
    padding: '20px 18px 18px',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.02) 70%), var(--bg-card)',
    border: '1px solid rgba(59,130,246,0.22)',
    boxShadow: '0 4px 30px rgba(59,130,246,0.10), inset 0 1px 0 rgba(255,255,255,0.04)',
    position: 'relative',
    overflow: 'hidden',
  }

  const fadeIn = (delay) => ({
    animation: 'dashFadeInV2 0.4s ease forwards',
    animationDelay: `${delay}ms`,
    opacity: 0,
  })

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 100 }}>
      <style>{`
        ${STREAK_BADGE_CSS}
        @keyframes particleDrift {
          0%   { transform: translateY(100vh) translateX(0px); opacity: 0; }
          10%  { opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(-60px) translateX(var(--drift)); opacity: 0; }
        }
      `}</style>

      {/* ── Floating particles (drift upward, accent color) ───────────────── */}
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

      {/* ── Subtle top radial glow ────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: -120, left: '50%',
        transform: 'translateX(-50%)',
        width: 500, height: 380,
        background: `radial-gradient(ellipse at center, ${theme.hex}${isDark ? '14' : '0A'} 0%, ${theme.hex}${isDark ? '06' : '02'} 40%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ── 1. Header — greeting (thin), then name + 3 metrics on one row ─ */}
        <div style={{
          ...fadeIn(0),
          padding: 'max(64px, calc(env(safe-area-inset-top) + 28px)) 16px 14px 20px',
        }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.01em', marginBottom: 4 }}>
            {timeGreeting}{settings.userName ? ',' : ''}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h1 style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)',
              margin: 0,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 1,
            }}>
              {settings.userName || 'Welcome'}
            </h1>
            <div
              onPointerDown={() => setPressedStreak(true)}
              onPointerUp={() => { setPressedStreak(false); setShowTierModal(true) }}
              onPointerLeave={() => setPressedStreak(false)}
              onPointerCancel={() => setPressedStreak(false)}
              style={{
                transform: pressedStreak ? 'scale(0.94)' : 'scale(1)',
                transition: 'transform 80ms ease',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 0,
              }}
            >
              <div style={{ padding: '0 12px' }}>
                <MetricStat number={totalSessions} label="Total" />
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.18)' }} />
              <div style={{ padding: '0 12px' }}>
                <MetricStat number={splitSessionCount} label="Split" />
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.18)' }} />
              <div style={{ padding: '0 12px 0 14px' }}>
                <MetricStat
                  number={streak}
                  label="Streak"
                  numberColor={currentTier.color}
                  labelColor={currentTier.color}
                  suffix={streak > 0 ? '🔥' : null}
                  animatedTier={currentTier.isAnimated ? currentTier : null}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Hero card — owns the fold ──────────────────────────────── */}
        <div style={{ ...fadeIn(60), marginBottom: 12 }}>
          {activeSession?.sessionStarted ? (
            // (a) Resume in-progress session
            <div style={heroResumeCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
                  <span className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: theme.contrastText, opacity: 0.75 }} />
                  <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: 10, height: 10, backgroundColor: theme.contrastText, opacity: 0.85 }} />
                </span>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, margin: 0 }}>
                  {activeSession.isPaused ? 'Paused' : 'In Progress'}
                </p>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2, margin: 0 }}>
                {getWorkoutEmoji(activeSession.type)} {getWorkoutName(activeSession.type)}
              </p>
              <p style={{ fontSize: 13, marginTop: 4, marginBottom: 18, opacity: 0.65 }}>
                {activeSession.exercises?.filter(ex => ex.sets?.some(s => s.reps || s.weight)).length || 0} exercise{activeSession.exercises?.filter(ex => ex.sets?.some(s => s.reps || s.weight)).length === 1 ? '' : 's'} logged so far
              </p>
              <button
                onClick={() => navigate(`/log/bb/${activeSession.type}`)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.20)', fontWeight: 700, fontSize: 16, padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer', color: theme.contrastText }}
              >
                Resume Workout →
              </button>
            </div>
          ) : isRestDay ? (
            // (c) Today is a rest day — calm blue card
            <div style={heroRestCardStyle}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#93C5FD', textTransform: 'uppercase', marginBottom: 8 }}>
                Rest day
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text-primary)', margin: 0 }}>
                Recovery
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6, marginBottom: 14 }}>
                {weekCompletedCount === 0
                  ? 'Take it easy today.'
                  : `${weekCompletedCount} active ${weekCompletedCount === 1 ? 'day' : 'days'} this week. You're on track.`}
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate('/cardio')}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(59,130,246,0.18)', color: '#93C5FD',
                    border: '1px solid rgba(59,130,246,0.35)',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Log light cardio
                </button>
                <button
                  onClick={() => {
                    if (restDayLoggedToday) {
                      const todayEntry = (restDaySessions || []).find(r => isoToLocalDateStr(r.date) === todayStr)
                      if (todayEntry) deleteRestDaySession(todayEntry.id)
                    } else {
                      addRestDaySession(new Date().toISOString())
                    }
                  }}
                  style={{
                    flex: 1, padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {restDayLoggedToday ? '✓ Rest logged' : 'Log rest day'}
                </button>
              </div>
            </div>
          ) : (
            // (b) Today is a workout day — accent gradient hero
            <div style={heroAccentCardStyle}>
              <p style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.hex,
                marginBottom: 10,
              }}>
                Today
                {heroDayOfCycle ? ` · Day ${heroDayOfCycle.day} of ${heroDayOfCycle.total}` : ''}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                {/* Emoji + workout name as a tight inline group, so the
                    flex gap doesn't push them apart. */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, maxWidth: '50%' }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>
                    {getWorkoutEmoji(recommendedWorkout)}
                  </span>
                  <p style={{
                    fontSize: 22,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.15,
                    color: 'var(--text-primary)',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {getWorkoutName(recommendedWorkout)}
                  </p>
                </div>
                {/* Sparkline grows to fill the remaining space between
                    the workout title and the right-side stat stack. The
                    trend label sits above with a small joining arrow
                    that drops down toward the chart. */}
                <div style={{ flex: 1, minWidth: 30, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 1 }}>
                  {(() => {
                    const trend = volumeTrend(heroVolumeHistory)
                    if (!trend) return null
                    return (
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: trend.color,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        marginLeft: 6,
                      }}>
                        {trend.label}
                        <JoinerArrow color={trend.color} />
                      </span>
                    )
                  })()}
                  {heroVolumeHistory.length >= 2 && (
                    <div style={{ width: '100%' }}>
                      <VolumeSparkline history={heroVolumeHistory} accent={theme.hex} width={120} height={26} />
                    </div>
                  )}
                </div>
                {/* Concrete facts on the right — average duration + recency. */}
                {(heroAvgDuration || heroLastSeen) && (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    gap: 4, flexShrink: 0, minWidth: 0,
                  }}>
                    {heroAvgDuration && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                          ~{heroAvgDuration}m
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Average
                        </span>
                      </div>
                    )}
                    {heroLastSeen && (
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                          {heroLastSeen}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Last
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/log/bb/${recommendedWorkout}`)}
                style={{
                  width: '100%',
                  background: theme.hex,
                  color: theme.contrastText,
                  padding: '14px 18px',
                  borderRadius: 14,
                  fontWeight: 700,
                  fontSize: 15,
                  boxShadow: `0 4px 20px ${hexToRgba(theme.hex, 0.35)}`,
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 6,
                }}
              >
                Start Session →
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowPreview(true)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    color: 'var(--text-secondary)',
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 13,
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  Preview
                </button>
                <button
                  onClick={() => {
                    if (!restDayLoggedToday) {
                      addRestDaySession(new Date().toISOString())
                    }
                  }}
                  disabled={restDayLoggedToday}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    color: restDayLoggedToday ? 'var(--text-muted)' : 'var(--text-secondary)',
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontWeight: 600,
                    fontSize: 13,
                    border: '1px solid var(--border-subtle)',
                    cursor: restDayLoggedToday ? 'default' : 'pointer',
                    opacity: restDayLoggedToday ? 0.6 : 1,
                  }}
                >
                  {restDayLoggedToday ? '✓ Rest logged' : 'Log Rest Day'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Soreness check-in (when applicable) ─────────────────────── */}
        {pendingSorenessSession && (
          <div style={{ ...fadeIn(140), padding: '0 16px', marginBottom: 12 }}>
            <button
              onClick={() => setShowSorenessModal(true)}
              className="w-full rounded-2xl p-4 flex items-center gap-3 text-left"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
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

        {/* ── 4. Library-tagging banner (when applicable) ────────────────── */}
        {(() => {
          const pendingCount = (exerciseLibrary || []).filter(e => e.needsTagging).length
          if (pendingCount === 0) return null
          return (
            <div style={{ ...fadeIn(160), padding: '0 16px', marginBottom: 12 }}>
              <button
                onPointerDown={() => navigate('/backfill')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                  color: 'rgb(147,197,253)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <span>Tag {pendingCount} custom {pendingCount === 1 ? 'exercise' : 'exercises'} to unlock smarter recommendations</span>
                <span style={{ opacity: 0.7 }}>→</span>
              </button>
            </div>
          )
        })()}

        {/* ── 5. Week card — strip + computed sentence (always-visible) ─── */}
        <div style={{ ...fadeIn(180), padding: '0 16px', marginBottom: 12 }}>
          <div
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-base)',
              borderRadius: 18,
              padding: '14px 16px 16px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                This week
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                Week {getIsoWeek(today)}
              </span>
            </div>

            {/* 7 Sun-Sat dots */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
              {weekDays.map((day, i) => {
                const info        = getDayInfo(day)
                const isToday     = toDateStr(day) === todayStr
                const isDone      = info.type === 'done' || info.type === 'today-done' || info.type === 'cardio' || info.type === 'today-cardio'
                const isPending   = info.type === 'today-pending' || info.type === 'today-rest'
                const isRestType  = info.type === 'past-rest' || info.type === 'future-rest'
                const isLoggedRest= info.type === 'logged-rest' || info.type === 'today-logged-rest'

                let bg = 'transparent'
                let border = 'none'
                let textColor = 'var(--text-faint)'
                let fontWeight = 500

                if (isDone) {
                  bg = theme.hex
                  textColor = theme.contrastText
                  fontWeight = 700
                } else if (isPending) {
                  border = `2px solid ${theme.hex}`
                  textColor = theme.hex
                  fontWeight = 700
                } else if (isLoggedRest) {
                  bg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)'
                  textColor = 'var(--text-secondary)'
                  fontWeight = 600
                  if (info.type === 'today-logged-rest') border = `2px solid ${theme.hex}`
                } else if (isRestType) {
                  border = `1px dashed ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}`
                  textColor = 'var(--text-muted)'
                }

                return (
                  <div
                    key={i}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      const dayKey = toDateStr(day)
                      setPressedDay(dayKey)
                      if (isDone) {
                        const s = sessionByDate[dayKey]
                        if (s) setSelectedDaySession(s)
                      } else if (info.type === 'future') {
                        setSelectedFutureDay({ dateStr: dayKey, workoutId: info.planned, isRest: false })
                      } else if (info.type === 'future-rest') {
                        setSelectedFutureDay({ dateStr: dayKey, workoutId: null, isRest: true })
                      }
                    }}
                    onPointerUp={() => setPressedDay(null)}
                    onPointerLeave={() => setPressedDay(null)}
                    onPointerCancel={() => setPressedDay(null)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '50%',
                      backgroundColor: bg,
                      border,
                      color: textColor,
                      fontSize: 11,
                      fontWeight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transform: pressedDay === toDateStr(day) ? 'scale(0.85)' : 'scale(1)',
                      transition: 'transform 80ms ease',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {DAY_LABELS[i]}
                  </div>
                )
              })}
            </div>

            {/* Computed narrative line */}
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
              {weekNarrative.text}
              {weekNarrative.deltaText && (
                <>
                  {' '}
                  <span style={{ color: weekNarrative.deltaColor || 'var(--text-secondary)', fontWeight: 600 }}>
                    {weekNarrative.deltaText}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Always-visible 2-card volume/time stat block */}
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <div style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: 14,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Volume
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary)' }}>
                {formatVolume(volumeThisWeek)} <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>lbs</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Last week: {formatVolume(volumeLastWeek)}
              </p>
            </div>
            <div style={{
              flex: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 14,
              padding: 14,
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                Time in gym
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--text-primary)' }}>
                {formatTime(timeThisWeek)}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Last week: {formatTime(timeLastWeek)}
              </p>
            </div>
          </div>
        </div>

        {/* ── 6. Log Cardio (rest day already lives in the hero) ─────────── */}
        <div style={{ ...fadeIn(220), display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
          <button
            onClick={() => navigate('/cardio')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '10px 18px',
              color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
              fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Log Cardio
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
              <circle cx="120" cy="120" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
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
              {[51.4, 144, 195.4, 298].map((angle, i) => {
                const pos = polarToCart(120, 120, 90, angle)
                return <circle key={i} cx={pos.x} cy={pos.y} r={4} fill="white" opacity={0.6} />
              })}
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
            <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', margin: '0 auto 16px' }} />
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
