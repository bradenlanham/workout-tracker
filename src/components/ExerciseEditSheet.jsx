// Batch 16j — bottom-sheet editor for an existing library entry.
//
// Used from ExerciseLibraryManager. Mirrors CreateExerciseModal's form but
// starts pre-filled and calls updateExerciseInLibrary on save. Non-built-in
// entries also get a Delete button (calls deleteExerciseFromLibrary).
//
// Props:
//   open:     boolean
//   exercise: Library entry or null
//   onSave:   (id, patch) => void
//   onDelete: (id) => void           // no-op for isBuiltIn entries
//   onCancel: () => void
//   theme:    getTheme(...)

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exerciseLibrary'
import { HYROX_STATIONS } from '../data/hyroxStations'
import { getTypeColor, getTypeLabel } from '../utils/helpers'

function Pill({ selected, onClick, children, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
        selected ? `${theme.bg} text-white` : 'bg-item text-c-secondary hover:bg-hover'
      }`}
      style={selected ? { color: theme.contrastText } : undefined}
    >
      {children}
    </button>
  )
}

const LOAD_INCREMENT_CHOICES = [2.5, 5, 10]

export default function ExerciseEditSheet({ open, exercise, onSave, onDelete, onCancel, theme }) {
  const [name, setName]                               = useState('')
  const [primaryMuscles, setPrimaryMuscles]           = useState([])
  const [equipment, setEquipment]                     = useState('')
  const [defaultUnilateral, setDefaultUnilateral]     = useState(false)
  const [loadIncrement, setLoadIncrement]             = useState(5)
  // Batch 31.2 — rep range for the push/hold/back-off decision. [min, max]
  // are two number steppers below load increment. On save, we flip
  // repRangeUserSet → true so the recommender honors the override (vs
  // inferring from history). Pre-filled with the exercise's current range
  // (whether user-set or inferred-and-stamped by the v7 migration).
  const [rangeMin, setRangeMin]                       = useState(8)
  const [rangeMax, setRangeMax]                       = useState(12)
  const [confirmingDelete, setConfirmingDelete]       = useState(false)

  // Batch 39 — hyrox-round roundConfig editor. Mirrors CreateExerciseModal's
  // shape so existing round entries (Brooke's Tuesday + Friday + Saturday)
  // are editable end-to-end. Read from exercise.roundConfig on open.
  const [roundMode, setRoundMode]                     = useState('single')
  const [roundStationId, setRoundStationId]           = useState('sta_skierg')
  const [roundPool, setRoundPool]                     = useState([])
  const [runDistanceM, setRunDistanceM]               = useState(800)
  const [roundCount, setRoundCount]                   = useState(4)
  const [restSec, setRestSec]                         = useState(120)

  // Refresh form state whenever the sheet opens with a new entry.
  useEffect(() => {
    if (open && exercise) {
      setName(exercise.name || '')
      setPrimaryMuscles(exercise.primaryMuscles || [])
      setEquipment(exercise.equipment && exercise.equipment !== 'Other' ? exercise.equipment : '')
      setDefaultUnilateral(!!exercise.defaultUnilateral)
      setLoadIncrement(exercise.loadIncrement || 5)
      const rr = Array.isArray(exercise.defaultRepRange) && exercise.defaultRepRange.length === 2
        ? exercise.defaultRepRange
        : [8, 12]
      setRangeMin(rr[0])
      setRangeMax(rr[1])
      setConfirmingDelete(false)
      // Batch 39 — seed roundConfig fields when present.
      const rc = exercise.roundConfig
      if (rc) {
        const defaultDist = rc.runDimensions?.distance?.default
        if (typeof defaultDist === 'number') setRunDistanceM(defaultDist)
        else setRunDistanceM(800)
        if (typeof rc.defaultRoundCount === 'number') setRoundCount(rc.defaultRoundCount)
        else setRoundCount(4)
        if (typeof rc.defaultRestSeconds === 'number') setRestSec(rc.defaultRestSeconds)
        else setRestSec(120)
        if (Array.isArray(rc.rotationPool) && rc.rotationPool.length > 0) {
          setRoundMode('pool')
          setRoundPool([...rc.rotationPool])
          setRoundStationId('sta_skierg')
        } else if (rc.stationId) {
          setRoundMode('single')
          setRoundStationId(rc.stationId)
          setRoundPool([])
        }
      } else {
        setRoundMode('single')
        setRoundStationId('sta_skierg')
        setRoundPool([])
        setRunDistanceM(800)
        setRoundCount(4)
        setRestSec(120)
      }
    }
  }, [open, exercise])

  if (!open || !exercise) return null

  // Batch 39 — type-aware. Defaults to 'weight-training' for legacy entries
  // that don't have the field yet (v8 migration backfills, but in case of
  // session-cached data lacking type we still render usefully).
  const type = exercise.type || 'weight-training'
  const isWeightTraining = type === 'weight-training'
  const isRunning        = type === 'running'
  const isHyroxStation   = type === 'hyrox-station'
  const isHyroxRound     = type === 'hyrox-round'
  const typeColor = getTypeColor(type)
  const typeLabel = getTypeLabel(type)

  const canSave = (() => {
    if (!name.trim()) return false
    if (isWeightTraining) {
      return primaryMuscles.length > 0
        && equipment
        && equipment !== 'Other'
        && rangeMin >= 1 && rangeMax >= rangeMin && rangeMax <= 30
    }
    if (isRunning) {
      // Equipment value used for running is from the same enum but the user
      // can keep it as-is (Other is allowed for running entries — it's not
      // a tagging concern, it's a free-form descriptor).
      return true
    }
    if (isHyroxStation) {
      // Locked dimensions; only name is editable. Just need a name.
      return true
    }
    if (isHyroxRound) {
      const stationOk = roundMode === 'single'
        ? !!roundStationId
        : roundPool.length > 0
      return stationOk && runDistanceM > 0 && roundCount > 0 && restSec >= 0
    }
    return false
  })()

  const toggleMuscle = (m) => {
    setPrimaryMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const togglePoolStation = (id) => {
    setRoundPool(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const bumpMin = (delta) => setRangeMin(v => {
    const next = Math.max(1, Math.min(30, v + delta))
    if (next > rangeMax) setRangeMax(next)
    return next
  })
  const bumpMax = (delta) => setRangeMax(v => {
    const next = Math.max(1, Math.min(30, v + delta))
    if (next < rangeMin) setRangeMin(next)
    return next
  })

  const handleSave = () => {
    if (!canSave) return
    if (isWeightTraining) {
      onSave(exercise.id, {
        name:              name.trim(),
        primaryMuscles,
        equipment,
        defaultUnilateral,
        loadIncrement,
        defaultRepRange:   [rangeMin, Math.max(rangeMin, rangeMax)],
        repRangeUserSet:   true,
        needsTagging:      false,
      })
      return
    }
    if (isRunning) {
      onSave(exercise.id, {
        name:              name.trim(),
        equipment:         equipment || exercise.equipment || 'Other',
        needsTagging:      false,
      })
      return
    }
    if (isHyroxStation) {
      // Stations have locked dimensions — only name + equipment instance
      // are editable. (Equipment instance is per-session via Batch 19's
      // chip; not on the library record.)
      onSave(exercise.id, {
        name: name.trim(),
      })
      return
    }
    if (isHyroxRound) {
      const roundConfig = {
        runDimensions: { distance: { default: runDistanceM, unit: 'm' } },
        ...(roundMode === 'single'
          ? { stationId: roundStationId, rotationPool: null }
          : { stationId: null, rotationPool: [...roundPool] }),
        defaultRoundCount: roundCount,
        defaultRestSeconds: restSec,
      }
      onSave(exercise.id, {
        name: name.trim(),
        roundConfig,
      })
      return
    }
  }

  // Pre-formatted role label for the type-tag header (e.g. "WEIGHT · BUILT-IN")
  const sourceLabel = exercise.isBuiltIn ? 'Built-in' : 'Custom'

  return createPortal(
    <div
      className="fixed inset-0 flex items-end md:items-center justify-center"
      style={{ zIndex: 260 }}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-lg bg-card rounded-t-3xl md:rounded-3xl border-t border-x md:border border-white/10 shadow-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0 flex-1">
            {/* Batch 39 — type badge + source label as the eyebrow */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                style={{ background: `${typeColor}1f`, color: typeColor, border: `1px solid ${typeColor}40` }}
              >
                {typeLabel}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-c-faint">
                {sourceLabel}
              </span>
            </div>
            <h3 className="text-lg font-bold text-c-primary truncate">{exercise.name}</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-item text-c-secondary flex items-center justify-center text-lg shrink-0 ml-3"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>

        <p className="text-xs text-c-dim font-medium mb-1">Name</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Exercise name"
          disabled={isHyroxStation}
          className="w-full bg-item rounded-xl px-3 py-2.5 text-sm outline-none mb-4 placeholder:text-c-muted disabled:opacity-60"
        />

        {/* Batch 39 — hyrox-station: render dimensions read-only.
            Catalog entries can't change their locked dimensions; the user
            can still rename them and Batch 19 instance tags handle per-gym
            variation. */}
        {isHyroxStation && (
          <div
            className="rounded-xl p-3 mb-4 text-[11px]"
            style={{ background: `${typeColor}10`, border: `1px solid ${typeColor}30` }}
          >
            <p className="font-semibold mb-1.5" style={{ color: typeColor }}>
              Locked dimensions
            </p>
            <div className="space-y-1 text-c-secondary">
              {(exercise.dimensions || []).map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="capitalize">{d.axis}</span>
                  <span className="text-c-muted">
                    {d.required ? 'required' : 'optional'}
                    {d.unit ? ` · ${d.unit}` : ''}
                  </span>
                </div>
              ))}
              {(!exercise.dimensions || exercise.dimensions.length === 0) && (
                <span className="text-c-muted italic">No dimensions defined.</span>
              )}
            </div>
            {exercise.raceStandard && (
              <p className="mt-2 text-[10px] text-c-muted">
                Race standard: {Object.entries(exercise.raceStandard).map(([k, v]) => `${v} ${k.replace(/^distance(M|Meters)?$/, 'm').replace('reps', 'reps')}`).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Batch 39 — running: equipment is a free-form descriptor; muscle
            groups don't apply (running entries default to ['Full Body']). */}
        {isRunning && (
          <>
            <p className="text-xs text-c-dim font-medium mb-1.5">Equipment</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {['Treadmill', 'Outdoor', 'Bike', 'Other'].map(eq => (
                <Pill key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)} theme={theme}>
                  {eq}
                </Pill>
              ))}
            </div>
            <p className="text-[11px] text-c-muted italic mb-4">
              Distance and time are logged per session.
            </p>
          </>
        )}

        {/* Batch 39 — hyrox-round: roundConfig editor. Single-station vs
            rotation-pool toggle, run-leg distance stepper, round count
            chips, rest-between-rounds chips. Saving rebuilds the
            roundConfig object and persists via updateExerciseInLibrary. */}
        {isHyroxRound && (
          <>
            <p className="text-xs text-c-dim font-medium mb-1.5">Station</p>
            <div className="flex gap-1.5 mb-2">
              <Pill selected={roundMode === 'single'} onClick={() => setRoundMode('single')} theme={theme}>
                Single station
              </Pill>
              <Pill selected={roundMode === 'pool'} onClick={() => setRoundMode('pool')} theme={theme}>
                Rotates from pool
              </Pill>
            </div>
            {roundMode === 'single' && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {HYROX_STATIONS.map(s => (
                  <Pill key={s.id} selected={roundStationId === s.id} onClick={() => setRoundStationId(s.id)} theme={theme}>
                    {s.name}
                  </Pill>
                ))}
              </div>
            )}
            {roundMode === 'pool' && (
              <>
                <p className="text-[11px] text-c-muted mb-1.5">
                  Rotates through the selected stations across sessions.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {HYROX_STATIONS.map(s => (
                    <Pill key={s.id} selected={roundPool.includes(s.id)} onClick={() => togglePoolStation(s.id)} theme={theme}>
                      {s.name}
                    </Pill>
                  ))}
                </div>
              </>
            )}

            <p className="text-xs text-c-dim font-medium mb-1">Run leg distance</p>
            <div className="flex items-center gap-2 mb-4 bg-item rounded-xl px-3 py-2.5">
              <button
                type="button"
                onClick={() => setRunDistanceM(v => Math.max(100, v - 100))}
                className="w-8 h-8 rounded-lg bg-card text-c-primary text-lg leading-none font-bold active:bg-hover"
                aria-label="Decrease run distance"
              >−</button>
              <span className="flex-1 text-center tabular-nums text-base font-bold text-c-primary">
                {runDistanceM} m
              </span>
              <button
                type="button"
                onClick={() => setRunDistanceM(v => Math.min(5000, v + 100))}
                className="w-8 h-8 rounded-lg bg-card text-c-primary text-lg leading-none font-bold active:bg-hover"
                aria-label="Increase run distance"
              >+</button>
            </div>

            <p className="text-xs text-c-dim font-medium mb-1.5">Rounds</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[3, 4, 5, 6, 8].map(n => (
                <Pill key={n} selected={roundCount === n} onClick={() => setRoundCount(n)} theme={theme}>
                  {n} rounds
                </Pill>
              ))}
            </div>

            <p className="text-xs text-c-dim font-medium mb-1.5">Rest between rounds</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[60, 90, 120, 180].map(s => (
                <Pill key={s} selected={restSec === s} onClick={() => setRestSec(s)} theme={theme}>
                  {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
                </Pill>
              ))}
            </div>
          </>
        )}

        {/* Batch 39 — weight-training: existing fields. Gated so other types
            don't render the muscle / equipment / rep-range / load-increment
            controls (those don't apply). */}
        {isWeightTraining && (
        <>
        <p className="text-xs text-c-dim font-medium mb-1.5">
          Primary muscles <span className="text-c-muted">(at least 1)</span>
        </p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {MUSCLE_GROUPS.map(m => (
            <Pill key={m} selected={primaryMuscles.includes(m)} onClick={() => toggleMuscle(m)} theme={theme}>
              {m}
            </Pill>
          ))}
        </div>

        <p className="text-xs text-c-dim font-medium mb-1.5">Equipment</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {EQUIPMENT_TYPES.filter(eq => eq !== 'Other').map(eq => (
            <Pill key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)} theme={theme}>
              {eq}
            </Pill>
          ))}
        </div>

        <p className="text-xs text-c-dim font-medium mb-1.5">Load increment <span className="text-c-muted">(smallest weight step)</span></p>
        <div className="flex gap-1.5 mb-4">
          {LOAD_INCREMENT_CHOICES.map(li => (
            <Pill key={li} selected={loadIncrement === li} onClick={() => setLoadIncrement(li)} theme={theme}>
              {li} lb
            </Pill>
          ))}
        </div>

        {/* Batch 31.2 — top-set rep range. Steppers are tap-only so the user
            can adjust without keyboard. Min row + Max row. Values clamp to
            [1, 30] and min is nudged up with max when max drops below it
            (+ vice versa). Saving flips repRangeUserSet so the recommender
            honors the override instead of inferring from history. */}
        <p className="text-xs text-c-dim font-medium mb-0.5">Top-set rep range</p>
        <p className="text-[10px] text-c-muted mb-2">Coach pushes weight up at or above max; flags below min as a tough day.</p>
        <div className="flex items-center justify-between gap-3 mb-2 bg-item rounded-xl px-3 py-2.5">
          <span className="text-xs text-c-secondary">Progress when reps ≥</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bumpMax(-1)}
              className="w-8 h-8 rounded-lg bg-card text-c-primary text-lg leading-none font-bold active:bg-hover"
              aria-label="Decrease max reps"
            >
              −
            </button>
            <span className="text-base font-bold text-c-primary tabular-nums w-6 text-center">{rangeMax}</span>
            <button
              type="button"
              onClick={() => bumpMax(+1)}
              className="w-8 h-8 rounded-lg bg-card text-c-primary text-lg leading-none font-bold active:bg-hover"
              aria-label="Increase max reps"
            >
              +
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mb-4 bg-item rounded-xl px-3 py-2.5">
          <span className="text-xs text-c-secondary">Back off when reps &lt;</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bumpMin(-1)}
              className="w-8 h-8 rounded-lg bg-card text-c-primary text-lg leading-none font-bold active:bg-hover"
              aria-label="Decrease min reps"
            >
              −
            </button>
            <span className="text-base font-bold text-c-primary tabular-nums w-6 text-center">{rangeMin}</span>
            <button
              type="button"
              onClick={() => bumpMin(+1)}
              className="w-8 h-8 rounded-lg bg-card text-c-primary text-lg leading-none font-bold active:bg-hover"
              aria-label="Increase min reps"
            >
              +
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 mb-5 text-xs text-c-secondary">
          <input
            type="checkbox"
            checked={defaultUnilateral}
            onChange={e => setDefaultUnilateral(e.target.checked)}
          />
          Unilateral by default (doubles volume at save time)
        </label>
        </>
        )}

        <div className="flex gap-2">
          {!exercise.isBuiltIn && (
            confirmingDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 py-3 rounded-xl bg-item text-c-muted text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(exercise.id)}
                  className="flex-1 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 text-sm font-bold"
                >
                  Delete permanently
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="py-3 px-4 rounded-xl bg-item text-c-muted text-sm font-semibold"
                  style={{ flexBasis: '0', flexGrow: 1 }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className={`py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40 ${theme.bg}`}
                  style={{ color: theme.contrastText, flexBasis: '0', flexGrow: 2 }}
                >
                  Save
                </button>
              </>
            )
          )}
          {exercise.isBuiltIn && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={`w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40 ${theme.bg}`}
              style={{ color: theme.contrastText }}
            >
              Save
            </button>
          )}
        </div>

        {!canSave && (
          <p className="text-[11px] text-c-muted italic mt-2 text-center">
            {isWeightTraining && 'Pick at least one muscle group and an equipment type to save.'}
            {isHyroxRound    && 'Pick a station (or pool of stations) to save.'}
            {(isRunning || isHyroxStation) && 'Add a name to save.'}
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}
