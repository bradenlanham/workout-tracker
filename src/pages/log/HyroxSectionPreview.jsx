// Batch 41 — HYROX section preview card.
//
// Renders the HYROX section of a workout as a single immersive yellow
// preview card instead of a list of exercise cards. Per design doc §12.4
// + §5.2 + mockup 1: yellow gradient wash, INTERVALS · N ROUNDS chip,
// run leg / station / rest tile row, last-session summary top-right,
// yellow Start HYROX button.
//
// Used by `BbLogger.jsx`'s render loop: when a group's label
// case-insensitively matches "HYROX" AND its exercises are hyrox-round
// type, this component replaces the standard `GroupLabel` + card list.
//
// B41 is preview only — Start HYROX wires to a stub for now; the actual
// round logger lands in B43. Done state (all prescribed rounds logged
// for the day) renders a muted "✓ done · {total} · {delta}" treatment.

import useStore from '../../store/useStore'
import { getLastHyroxRoundSession, formatDuration, formatRec } from '../../utils/helpers'
import { HYROX_STATIONS } from '../../data/hyroxStations'

const YELLOW = '#EAB308'
const YELLOW_DIM = 'rgba(234, 179, 8, 0.7)'
const YELLOW_FAINT = 'rgba(234, 179, 8, 0.12)'

// Batch 46 — Add-on card for non-hyrox-round entries inside a HYROX section
// (running drills, optional skill-work stations). Renders compact info-only
// card with name + rec text + "✓ Mark complete" button so users can check
// them off without going through the full round logger.
//
// Batch 47 — Exported so BbLogger's render-loop can route running and
// hyrox-station entries in NON-HYROX sections (e.g. Thursday's Primary +
// Optional) through the same add-on treatment.
export function HyroxAddOnCard({ exercise, onComplete }) {
  const isDone = !!exercise?.completedAt
  const recText = formatRec(exercise?.rec)
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: isDone ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.3)',
        border: `1px solid ${isDone ? 'rgba(255,255,255,0.08)' : YELLOW_FAINT}`,
        opacity: isDone ? 0.55 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{exercise.name}</div>
          {recText && (
            <div className="text-[12px] text-white/65 mt-1 leading-snug">{recText}</div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onComplete?.(exercise) }}
          className="shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-md transition-colors"
          style={{
            background: isDone ? 'rgba(16,185,129,0.18)' : 'transparent',
            border: `1px solid ${isDone ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.2)'}`,
            color: isDone ? 'rgb(110,231,183)' : 'rgba(255,255,255,0.85)',
          }}
        >
          {isDone ? '✓ Done' : 'Mark done'}
        </button>
      </div>
    </div>
  )
}

function stationName(stationId) {
  if (!stationId) return null
  const station = HYROX_STATIONS.find(s => s.id === stationId)
  return station?.name || null
}

function PrescriptionTile({ label, value, sublabel }) {
  return (
    <div
      className="flex-1 min-w-0 px-2 py-2 rounded-lg text-center"
      style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${YELLOW_FAINT}` }}
    >
      <div className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: YELLOW_DIM }}>
        {label}
      </div>
      <div className="text-sm font-bold text-white truncate" title={value}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-white/60 truncate mt-0.5" title={sublabel}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

function HyroxRoundCard({ exercise, libraryEntry, sessions, onStart }) {
  const config = libraryEntry?.roundConfig || {}
  const runDistance = config.runDimensions?.distance?.default
  const runUnit = config.runDimensions?.distance?.unit || 'm'
  const roundCount = config.defaultRoundCount || 4
  const restSec = config.defaultRestSeconds || 0

  // Station label — single station OR rotation pool indicator.
  let stationLabel = null
  let stationSublabel = null
  if (config.stationId) {
    stationLabel = stationName(config.stationId) || 'Station'
  } else if (Array.isArray(config.rotationPool) && config.rotationPool.length > 0) {
    stationLabel = `Rotates (${config.rotationPool.length})`
    stationSublabel = config.rotationPool
      .map(stationName)
      .filter(Boolean)
      .slice(0, 2)
      .join(' · ')
    if (config.rotationPool.length > 2) stationSublabel += '…'
  }

  // Last-session lookup.
  const last = libraryEntry?.id
    ? getLastHyroxRoundSession(sessions, libraryEntry.id)
    : null
  const lastSummary = last
    ? `Last: ${formatDuration(last.totalTimeSec)} · ${last.roundCount} rounds`
    : null

  // Done state — all prescribed rounds logged for the day. Pre-B43 this
  // never triggers since no rounds get written yet.
  const todayRounds = Array.isArray(exercise.rounds) ? exercise.rounds.length : 0
  const isDone = todayRounds >= roundCount && roundCount > 0

  if (isDone) {
    const todayTotal = (exercise.rounds || []).reduce((sum, r) => {
      if (!r || !Array.isArray(r.legs)) return sum
      let s = 0
      for (const leg of r.legs) if (typeof leg?.timeSec === 'number') s += leg.timeSec
      return sum + s + (typeof r.restAfterSec === 'number' ? r.restAfterSec : 0)
    }, 0)
    const delta = last ? todayTotal - last.totalTimeSec : 0
    const deltaStr = last
      ? (delta >= 0 ? `+${formatDuration(delta)}` : `−${formatDuration(-delta)}`)
      : null
    return (
      <button
        type="button"
        onClick={() => onStart?.(exercise, libraryEntry)}
        className="w-full text-left rounded-2xl p-4"
        style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${YELLOW_FAINT}` }}
      >
        <div className="flex items-center gap-2">
          <div style={{ color: YELLOW }} className="text-base font-bold">✓ done</div>
          <div className="text-base text-white tabular-nums font-bold">{formatDuration(todayTotal)}</div>
          {deltaStr && (
            <div className="text-xs text-white/60 tabular-nums">{deltaStr} vs last</div>
          )}
        </div>
        <div className="text-xs text-white/50 mt-1">{exercise.name}</div>
      </button>
    )
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${YELLOW_FAINT} 0%, rgba(0,0,0,0.4) 65%)`,
        border: `1px solid ${YELLOW_FAINT}`,
        boxShadow: `0 0 0 1px rgba(234,179,8,0.18) inset`,
      }}
    >
      <div className="p-4">
        {/* Header row: title + last-session summary */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div
              className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1.5"
              style={{ background: YELLOW_FAINT, color: YELLOW, border: `1px solid ${YELLOW_FAINT}` }}
            >
              Intervals · {roundCount} {roundCount === 1 ? 'round' : 'rounds'}
            </div>
            <h3 className="text-base font-bold text-white truncate" title={exercise.name}>
              {exercise.name}
            </h3>
          </div>
          {lastSummary && (
            <div className="text-[11px] text-white/55 text-right shrink-0 max-w-[40%]">
              {lastSummary}
            </div>
          )}
        </div>

        {/* Tiles row: Run leg / Station / Rest */}
        <div className="flex gap-2 mb-4">
          {runDistance && (
            <PrescriptionTile
              label="Run leg"
              value={`${runDistance}${runUnit}`}
            />
          )}
          {stationLabel && (
            <PrescriptionTile
              label="Station"
              value={stationLabel}
              sublabel={stationSublabel}
            />
          )}
          {restSec > 0 && (
            <PrescriptionTile
              label="Rest"
              value={formatDuration(restSec)}
            />
          )}
        </div>

        {/* Start HYROX button */}
        <button
          type="button"
          onClick={() => onStart?.(exercise, libraryEntry)}
          className="w-full rounded-xl py-3 font-bold text-base transition-transform active:scale-[0.98]"
          style={{ background: YELLOW, color: '#0a0a0a' }}
        >
          Start HYROX →
        </button>
      </div>
    </div>
  )
}

export default function HyroxSectionPreview({ exercises, sessions, onStart, onCompleteAddOn }) {
  const exerciseLibrary = useStore(s => s.exerciseLibrary)

  // Section may contain a mix: hyrox-round entries get the immersive yellow
  // card treatment; everything else (running, optional stations) renders as
  // compact "Add-ons" cards beneath. Batch 46 fix — running entries used to
  // disappear entirely when a HYROX section had no rounds (Glutes & Light Run
  // bug).
  const splitByType = exercises.reduce((acc, ex) => {
    const lib = exerciseLibrary.find(e => e.id === ex.exerciseId || e.name === ex.name)
    if (lib?.type === 'hyrox-round') acc.rounds.push({ ex, lib })
    else acc.addOns.push({ ex, lib })
    return acc
  }, { rounds: [], addOns: [] })

  if (splitByType.rounds.length === 0 && splitByType.addOns.length === 0) return null

  return (
    <div>
      {/* Yellow uppercase section label per §12.4 */}
      <div
        className="px-1 mb-2 text-xs font-bold uppercase tracking-wider"
        style={{ color: YELLOW }}
      >
        HYROX
      </div>
      <div className="space-y-2">
        {splitByType.rounds.map(({ ex, lib }) => (
          <HyroxRoundCard
            key={ex.id}
            exercise={ex}
            libraryEntry={lib}
            sessions={sessions}
            onStart={onStart}
          />
        ))}
        {splitByType.addOns.length > 0 && (
          <>
            {splitByType.rounds.length > 0 && (
              <div
                className="pt-1 px-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: YELLOW_DIM }}
              >
                Add-ons
              </div>
            )}
            {splitByType.addOns.map(({ ex }) => (
              <HyroxAddOnCard
                key={ex.id}
                exercise={ex}
                onComplete={onCompleteAddOn}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
