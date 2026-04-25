// Batch 42 — Start HYROX overlay (mockup 2).
//
// Full-page overlay route at /log/hyrox/:exerciseId/start. Pre-populates
// today's HYROX prescription based on the round template's defaults — round
// count, run leg distance, station (or rotation pool pick), rest. Each row
// is tappable to override for this session. Tap "Begin round 1" → routes to
// /log/hyrox/:exerciseId/round/1/run (B43 surface).
//
// Visual identity: HYROX yellow takeover per design doc §12 — yellow radial
// glow at the top of the screen, yellow accents on context labels and the
// Begin button, black background, white text. No app accent leaks here.
//
// Headline cycles per design doc §13: 30-line bank, no consecutive repeat,
// `lastShownIndex` persists in `settings.lastHyroxHeadlineIndex` so re-opens
// of the same overlay (e.g., after a back-arrow round trip) show the same
// line — only fresh Start HYROX events draw a new one.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useStore from '../../store/useStore'
import {
  pickHeadline,
  pickHyroxStationForToday,
  formatDuration,
  getLastHyroxRoundSession,
} from '../../utils/helpers'
import { HYROX_STATIONS } from '../../data/hyroxStations'

const YELLOW = '#EAB308'
const YELLOW_BRIGHT = '#FACC15'

const ROUND_COUNT_OPTIONS = [3, 4, 5, 6, 8]
const REST_OPTIONS = [60, 90, 120, 180]
const RUN_DISTANCE_MIN = 100
const RUN_DISTANCE_MAX = 5000
const RUN_DISTANCE_STEP = 100

function stationName(stationId) {
  const station = HYROX_STATIONS.find(s => s.id === stationId)
  return station?.name || stationId || 'Station'
}

function formatRest(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Inline number stepper for the run-leg distance.
function DistanceStepper({ value, onChange, min = RUN_DISTANCE_MIN, max = RUN_DISTANCE_MAX, step = RUN_DISTANCE_STEP }) {
  return (
    <div className="flex items-center justify-center gap-3 mt-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="w-10 h-10 rounded-full text-lg font-bold transition-opacity disabled:opacity-30"
        style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
        aria-label="Decrease distance"
      >−</button>
      <div className="text-2xl font-bold text-white tabular-nums min-w-[6rem] text-center">
        {value}<span className="text-base text-white/60 font-medium ml-0.5">m</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
        className="w-10 h-10 rounded-full text-lg font-bold transition-opacity disabled:opacity-30"
        style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
        aria-label="Increase distance"
      >+</button>
    </div>
  )
}

// Tap-to-edit row for the prescription block.
function PrescriptionRow({ label, value, sublabel, expanded, onToggle, children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{
      background: expanded ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${expanded ? 'rgba(234,179,8,0.35)' : 'rgba(255,255,255,0.08)'}`,
    }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex flex-col items-start">
          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'rgba(234,179,8,0.85)' }}>
            {label}
          </span>
          <span className="text-base font-bold text-white">
            {value}
          </span>
          {sublabel && (
            <span className="text-[11px] text-white/50 mt-0.5">{sublabel}</span>
          )}
        </div>
        <span className="text-xs text-white/50 ml-2 shrink-0">
          {expanded ? 'done' : 'edit'}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  )
}

// Chip selector used by round count + rest chips.
function ChipRow({ options, value, onChange, formatOption = (o) => o }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {options.map(opt => {
        const selected = opt === value
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={selected
              ? { background: YELLOW, color: '#0a0a0a' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            {formatOption(opt)}
          </button>
        )
      })}
    </div>
  )
}

export default function StartHyroxOverlay() {
  const { exerciseId } = useParams()
  const navigate = useNavigate()

  const exerciseLibrary = useStore(s => s.exerciseLibrary)
  const sessions = useStore(s => s.sessions)
  const lastHyroxHeadlineIndex = useStore(s => s.settings.lastHyroxHeadlineIndex ?? -1)
  const setLastHyroxHeadlineIndex = useStore(s => s.setLastHyroxHeadlineIndex)

  // Resolve round-template library entry. Look up by id; fall back to name
  // for resilience against pre-v3 data.
  const libraryEntry = useMemo(() => {
    return exerciseLibrary.find(e => e.id === exerciseId)
        || exerciseLibrary.find(e => e.name === exerciseId)
        || null
  }, [exerciseLibrary, exerciseId])

  const roundConfig = libraryEntry?.roundConfig || null

  // Pre-populated prescription state.
  const [roundCount, setRoundCount] = useState(() => roundConfig?.defaultRoundCount || 4)
  const [runDistance, setRunDistance] = useState(() => {
    const d = roundConfig?.runDimensions?.distance?.default
    return typeof d === 'number' ? d : 1000
  })
  const [restSec, setRestSec] = useState(() => roundConfig?.defaultRestSeconds || 90)
  const [stationId, setStationId] = useState(() => {
    return pickHyroxStationForToday(roundConfig, sessions, exerciseId) || null
  })

  // Track which row is open in the editor.
  const [openRow, setOpenRow] = useState(null) // 'rounds' | 'run' | 'station' | 'rest' | null

  // Cycling headline — picked once on mount per design doc §13.2.
  // Persist via useEffect AFTER mount so the store update doesn't fire
  // during this component's render (which would warn `Cannot update a
  // component while rendering a different component` against any Zustand
  // subscriber that re-renders in response).
  const [headline] = useState(() => pickHeadline(lastHyroxHeadlineIndex))
  useEffect(() => {
    if (headline.index >= 0 && setLastHyroxHeadlineIndex) {
      setLastHyroxHeadlineIndex(headline.index)
    }
    // Mount-only persist; the picked headline is stable for this overlay's
    // lifetime, so re-opens (after navigating to /round/1/run and back)
    // remount this component and roll a new headline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Last-session bests for inline reference.
  const lastSession = useMemo(
    () => (libraryEntry?.id ? getLastHyroxRoundSession(sessions, libraryEntry.id) : null),
    [libraryEntry, sessions]
  )
  const lastSummary = lastSession
    ? `Last: ${formatDuration(lastSession.totalTimeSec)} · ${lastSession.roundCount} rounds`
    : null

  // If the exercise can't be resolved or it isn't a hyrox-round, bounce back.
  // Lift sections never reach this route via the normal flow, but guard for
  // direct-URL hits.
  useEffect(() => {
    if (!libraryEntry || libraryEntry.type !== 'hyrox-round' || !roundConfig) {
      // eslint-disable-next-line no-console
      console.warn('StartHyroxOverlay: unresolved exerciseId or non-round type', exerciseId)
    }
  }, [libraryEntry, roundConfig, exerciseId])

  if (!libraryEntry || libraryEntry.type !== 'hyrox-round' || !roundConfig) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-base mb-4">Round template not found.</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-5 py-2 rounded-full text-sm font-semibold"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
        >
          Go back
        </button>
      </div>
    )
  }

  const isPool = Array.isArray(roundConfig.rotationPool) && roundConfig.rotationPool.length > 0 && !roundConfig.stationId
  const stationLabel = stationName(stationId)
  const runUnit = roundConfig?.runDimensions?.distance?.unit || 'm'

  const handleBegin = () => {
    // For B43: route to round logger. The roundConfig overrides + station
    // pick will ride through router state so the round logger doesn't have
    // to recompute them. B43 reads them from `location.state.prescription`.
    navigate(`/log/hyrox/${exerciseId}/round/1/run`, {
      state: {
        prescription: {
          roundCount,
          runDistanceMeters: runDistance,
          restSec,
          stationId,
        },
      },
    })
  }

  const handleSkip = () => {
    // Bounce back to the workout page. Lift section is preserved.
    navigate(-1)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black text-white overflow-y-auto"
      style={{
        // Yellow radial glow at the top per §12.2.
        backgroundImage: `radial-gradient(ellipse 70% 40% at 50% 0%, rgba(234,179,8,0.18) 0%, rgba(234,179,8,0.08) 35%, rgba(0,0,0,0) 70%)`,
      }}
    >
      <div className="w-full max-w-md mx-auto px-6 pt-10 pb-8 flex flex-col flex-1">

        {/* Top context chip + workout title */}
        <div className="text-center mb-6">
          <div
            className="inline-block text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full mb-3"
            style={{
              background: 'rgba(234,179,8,0.12)',
              color: YELLOW_BRIGHT,
              border: `1px solid rgba(234,179,8,0.3)`,
            }}
          >
            HYROX · {libraryEntry.name}
          </div>

          {/* Cycling headline — design doc §13.3: 34px, weight 500, lh 1.05,
              letter-spacing -0.02em, soft fade-in 200ms ease-out. */}
          <h1
            className="text-white start-hyrox-headline"
            style={{
              fontSize: 34,
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              animation: 'startHyroxHeadlineFadeIn 200ms ease-out',
            }}
          >
            {headline.text}
          </h1>

          {lastSummary && (
            <div className="mt-3 text-xs text-white/50 tabular-nums">{lastSummary}</div>
          )}
        </div>

        {/* Prescription block */}
        <div className="space-y-2 mb-6">
          <PrescriptionRow
            label="Rounds"
            value={`${roundCount} ${roundCount === 1 ? 'round' : 'rounds'}`}
            expanded={openRow === 'rounds'}
            onToggle={() => setOpenRow(openRow === 'rounds' ? null : 'rounds')}
          >
            <ChipRow
              options={ROUND_COUNT_OPTIONS}
              value={roundCount}
              onChange={(v) => { setRoundCount(v); setOpenRow(null) }}
            />
          </PrescriptionRow>

          <PrescriptionRow
            label="Run leg"
            value={`${runDistance}${runUnit}`}
            expanded={openRow === 'run'}
            onToggle={() => setOpenRow(openRow === 'run' ? null : 'run')}
          >
            <DistanceStepper value={runDistance} onChange={setRunDistance} />
            <div className="text-[11px] text-white/40 text-center mt-2">100m increments · 100–5000m</div>
          </PrescriptionRow>

          <PrescriptionRow
            label="Station"
            value={stationLabel}
            sublabel={isPool ? `Rotates from pool (${roundConfig.rotationPool.length})` : null}
            expanded={openRow === 'station'}
            onToggle={() => setOpenRow(openRow === 'station' ? null : 'station')}
          >
            {isPool ? (
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {roundConfig.rotationPool.map(sid => {
                  const selected = sid === stationId
                  return (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => { setStationId(sid); setOpenRow(null) }}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                      style={selected
                        ? { background: YELLOW, color: '#0a0a0a' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.1)' }
                      }
                    >
                      {stationName(sid)}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-[11px] text-white/40 text-center mt-1">Single-station round — fixed by template</div>
            )}
          </PrescriptionRow>

          <PrescriptionRow
            label="Rest between rounds"
            value={formatRest(restSec)}
            expanded={openRow === 'rest'}
            onToggle={() => setOpenRow(openRow === 'rest' ? null : 'rest')}
          >
            <ChipRow
              options={REST_OPTIONS}
              value={restSec}
              onChange={(v) => { setRestSec(v); setOpenRow(null) }}
              formatOption={formatRest}
            />
          </PrescriptionRow>
        </div>

        {/* Actions */}
        <div className="mt-auto pb-2">
          <button
            type="button"
            onClick={handleBegin}
            className="w-full py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition-transform"
            style={{ background: YELLOW, color: '#0a0a0a', boxShadow: `0 8px 30px rgba(234,179,8,0.35)` }}
          >
            Begin round 1
          </button>
          <div className="flex items-center justify-center mt-4">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-white/45 underline underline-offset-2"
            >
              Skip HYROX today
            </button>
          </div>
        </div>
      </div>

      {/* Headline fade-in keyframes — inline so the component is self-contained. */}
      <style>{`
        @keyframes startHyroxHeadlineFadeIn {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  )
}
