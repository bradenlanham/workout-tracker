// In-session card for type='running' exercises.
//
// Watch-driven manual entry: user finishes their run on Garmin/Apple/etc,
// taps the card to expand, types in distance + time from the watch, taps
// Save. Card collapses to "✓ Run · 5.2 mi · 43:20 · 8:20/mi" summary.
//
// Saves to exercise.sets[0] as a single dimensioned set:
//   { distanceMiles, distanceMeters, timeSec, intensity? }
//
// Data flows through the standard exercise.completedAt + sets[] pipeline so
// History / Progress / Dashboard pick it up alongside strength sets without
// schema changes (Batch 38 v9 already added these fields to LoggedSet).
//
// Re-uses the parent's setExercises updater pattern to write back; same
// shape as HyroxAddOnCard's onComplete callback.

import { useState, useEffect } from 'react'
import useStore from '../../store/useStore'
import { getTheme } from '../../theme'
import {
  parseDuration, formatDuration, formatPace, paceSecPerMile,
  milesToMeters, formatRec,
} from '../../utils/helpers'

const INTENSITIES = [
  { id: 'easy',     label: 'Easy' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'hard',     label: 'Hard' },
  { id: 'allout',   label: 'All Out' },
]

// Pull a numeric "5" from a rec string like "5 miles" or "5 mi". Used to
// pre-fill the distance input from the workout's prescribed distance.
//
// Strictness: word boundaries required so "mi" doesn't match inside "min"
// (the rec for Easy Run is "Choose 1 — 10–15 min, conversational pace" —
// without word boundaries this would prefill 15 mi). Also requires the
// unit token to be standalone — "200m" (a station leg distance) doesn't
// trigger because "m" alone isn't in the alternation.
function parsePrescribedDistance(rec) {
  if (!rec) return null
  const text = typeof rec === 'string' ? rec : (rec.reps || rec.note || '')
  if (typeof text !== 'string') return null
  const m = text.match(/(\d+(\.\d+)?)\s*(miles?|mi)\b/i)
  if (m) return parseFloat(m[1])
  // km fallback — convert to miles for storage consistency
  const km = text.match(/(\d+(\.\d+)?)\s*(kilometers?|km)\b/i)
  if (km) return parseFloat(km[1]) * 0.621371
  return null
}

export default function RunningExerciseCard({ exercise, onUpdate }) {
  const { settings } = useStore()
  const theme = getTheme(settings.accentColor, settings.customAccentHex)

  const isDone = !!exercise?.completedAt
  const savedSet = exercise?.sets?.[0] || {}

  const [expanded, setExpanded] = useState(!isDone)
  const [distanceStr, setDistanceStr] = useState(() => {
    if (typeof savedSet.distanceMiles === 'number') return String(savedSet.distanceMiles)
    const prescribed = parsePrescribedDistance(exercise?.rec)
    return prescribed ? String(prescribed) : ''
  })
  const [timeStr, setTimeStr] = useState(() => {
    if (typeof savedSet.timeSec === 'number') return formatDuration(savedSet.timeSec)
    return ''
  })
  const [intensity, setIntensity] = useState(savedSet.intensity || null)

  // Reload local state when the exercise prop updates externally (e.g. after
  // save round-trips through setExercises).
  useEffect(() => {
    if (typeof savedSet.distanceMiles === 'number') {
      setDistanceStr(String(savedSet.distanceMiles))
    }
    if (typeof savedSet.timeSec === 'number') {
      setTimeStr(formatDuration(savedSet.timeSec))
    }
    if (savedSet.intensity) setIntensity(savedSet.intensity)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.completedAt])

  const distanceMi = (() => {
    const n = parseFloat(distanceStr)
    return Number.isFinite(n) && n > 0 ? n : null
  })()
  const timeSec = parseDuration(timeStr)
  const paceSec = paceSecPerMile(distanceMi, timeSec)
  const canSave = distanceMi !== null && timeSec !== null && timeSec > 0

  const handleSave = () => {
    if (!canSave) return
    const set = {
      type: 'working',
      distanceMiles:  distanceMi,
      distanceMeters: milesToMeters(distanceMi),
      timeSec,
      ...(intensity ? { intensity } : {}),
    }
    onUpdate({
      ...exercise,
      sets: [set],
      completedAt: Date.now(),
    })
    setExpanded(false)
  }

  const handleEdit = () => {
    onUpdate({ ...exercise, completedAt: 0 })
    setExpanded(true)
  }

  // Collapsed-done state — read-only summary line.
  if (isDone && !expanded) {
    const summaryBits = []
    if (typeof savedSet.distanceMiles === 'number') {
      summaryBits.push(`${savedSet.distanceMiles} mi`)
    }
    if (typeof savedSet.timeSec === 'number') {
      summaryBits.push(formatDuration(savedSet.timeSec))
    }
    const pace = paceSecPerMile(savedSet.distanceMiles, savedSet.timeSec)
    if (pace) summaryBits.push(`${formatPace(pace)}/mi`)
    return (
      <div
        className="rounded-xl p-3 transition-opacity"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          opacity: 0.85,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">
              <span aria-hidden className="mr-1.5" style={{ color: '#22C55E' }}>✓</span>
              {exercise.name}
            </div>
            {summaryBits.length > 0 && (
              <div className="text-[12px] text-white/65 mt-0.5">
                {summaryBits.join(' · ')}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleEdit}
            className="shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md"
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'rgba(255,255,255,0.65)',
            }}
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  // Expanded input state.
  const recText = formatRec(exercise?.rec)
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'rgba(0,0,0,0.30)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      {/* Header: emoji + name + collapse chevron */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{exercise.name}</div>
          {recText && (
            <div className="text-[11px] text-white/55 mt-0.5 leading-snug">{recText}</div>
          )}
        </div>
        {isDone && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="shrink-0 w-7 h-7 flex items-center justify-center text-white/55"
            aria-label="Collapse"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 15L12 8L19 15" />
            </svg>
          </button>
        )}
      </div>

      {/* Inputs row: distance + time */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-1">
            Distance
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              inputMode="decimal"
              value={distanceStr}
              onChange={e => setDistanceStr(e.target.value)}
              placeholder="5.2"
              className="flex-1 min-w-0 bg-transparent text-base font-bold text-white tabular-nums focus:outline-none"
              aria-label="Distance in miles"
            />
            <span className="text-[11px] uppercase tracking-wider font-bold text-white/45">mi</span>
          </div>
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/55 mb-1">
            Time
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              inputMode="numeric"
              value={timeStr}
              onChange={e => setTimeStr(e.target.value)}
              placeholder="43:20"
              className="flex-1 min-w-0 bg-transparent text-base font-bold text-white tabular-nums focus:outline-none"
              aria-label="Time as mm:ss or h:mm:ss"
            />
          </div>
        </label>
      </div>

      {/* Pace line — derived live, read-only */}
      <div className="text-[11px] font-medium text-white/55 mb-3 tabular-nums" aria-live="polite">
        {paceSec
          ? <>Pace: <span className="text-white/85 font-bold">{formatPace(paceSec)}</span> <span className="text-white/45">/ mi</span></>
          : <span className="text-white/35">Pace will calculate when both fields are filled</span>}
      </div>

      {/* Intensity chips — optional */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {INTENSITIES.map(opt => {
          const selected = intensity === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setIntensity(prev => prev === opt.id ? null : opt.id)}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-colors"
              style={{
                background:  selected ? `${theme.hex}20` : 'transparent',
                borderColor: selected ? `${theme.hex}66` : 'rgba(255,255,255,0.14)',
                color:       selected ? theme.hex : 'rgba(255,255,255,0.65)',
              }}
              aria-pressed={selected}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full py-2 rounded-lg text-sm font-bold border transition-colors"
        style={canSave ? {
          background:  `${theme.hex}20`,
          borderColor: `${theme.hex}66`,
          color:       theme.hex,
        } : {
          background:  'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.10)',
          color:       'rgba(255,255,255,0.35)',
          cursor:      'default',
        }}
        aria-label={isDone ? 'Save run changes' : 'Save run'}
      >
        {isDone ? 'Save changes' : '✓ Save run'}
      </button>
    </div>
  )
}
