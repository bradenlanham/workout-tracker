import { useEffect, useMemo, useRef, useState } from 'react'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exerciseLibrary'
import { HYROX_STATIONS } from '../data/hyroxStations'
import { predictExerciseMeta, getTypeColor, getTypeLabel } from '../utils/helpers'

// Shared modal for creating a new library entry from either picker.
//
// Batch 39: Type selector at the top — 4 options (Weight / Run / HYROX
// station / HYROX round). The form fields swap based on the selected type:
//   - weight-training: name + primaryMuscles + equipment + defaultUnilateral
//   - running:         name + running-equipment + intensity-tracking flag
//   - hyrox-station:   read-only catalog list (cannot create — 8 are seeded)
//   - hyrox-round:     name + station/rotationPool + runDistance + roundCount
//
// Batch 17j carries:
//   1. 300ms debounced auto-predict on name (predictExerciseMeta now returns
//      type alongside muscles + equipment, so the type chip pre-selects too).
//   2. "Skip for now" button — only available for weight-training type since
//      running / hyrox-round have no needsTagging concept.
//
// Props:
//   open, initialName
//   onSave({name, primaryMuscles, equipment, defaultUnilateral, type, roundConfig?})
//   onSkip({name})         optional — shows the Skip button (weight-training only)
//   onCancel
//   theme

const TYPE_OPTIONS = [
  { id: 'weight-training', label: 'Weight' },
  { id: 'running',         label: 'Run' },
  { id: 'hyrox-round',     label: 'HYROX round' },
  { id: 'hyrox-station',   label: 'HYROX station' },
]

const RUNNING_EQUIPMENT = ['Treadmill', 'Outdoor', 'Bike', 'Other']
const ROUND_COUNTS = [3, 4, 5, 6, 8]
const REST_PRESETS = [60, 90, 120, 180]

function Pill({ selected, onClick, children, theme, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 disabled:opacity-40 ${
        selected ? `${theme.bg} text-white` : 'bg-item text-c-secondary hover:bg-hover'
      }`}
      style={selected ? { color: theme.contrastText } : undefined}
    >
      {children}
    </button>
  )
}

// Type chip uses the shared brand color (blue / green / yellow) when
// selected so users see the "this is the {type} card" cue immediately.
function TypeChip({ id, label, selected, onClick }) {
  const color = getTypeColor(id)
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 px-2 py-2 rounded-lg text-xs font-semibold transition-colors"
      style={selected
        ? { background: color, color: '#0a0a0a' }
        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: `1px solid ${color}26` }}
    >
      {label}
    </button>
  )
}

export default function CreateExerciseModal({ open, initialName = '', onSave, onSkip, onCancel, theme }) {
  // Common
  const [name, setName] = useState(initialName)
  const [type, setType] = useState('weight-training')

  // Weight-training fields
  const [primaryMuscles, setPrimaryMuscles] = useState([])
  const [equipment, setEquipment] = useState('')
  const [defaultUnilateral, setDefaultUnilateral] = useState(false)

  // Running fields
  const [runEquipment, setRunEquipment] = useState('Treadmill')
  const [trackIntensity, setTrackIntensity] = useState(true)

  // HYROX round fields
  const [roundMode, setRoundMode] = useState('single') // 'single' | 'pool'
  const [roundStationId, setRoundStationId] = useState('sta_skierg')
  const [roundPool, setRoundPool] = useState([])  // multi-select station ids
  const [runDistanceM, setRunDistanceM] = useState(800)
  const [roundCount, setRoundCount] = useState(4)
  const [restSec, setRestSec] = useState(120)

  // Touched refs for predictExerciseMeta auto-fill
  const musclesTouched   = useRef(false)
  const equipmentTouched = useRef(false)
  const typeTouched      = useRef(false)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    setType('weight-training')
    setPrimaryMuscles([])
    setEquipment('')
    setDefaultUnilateral(false)
    setRunEquipment('Treadmill')
    setTrackIntensity(true)
    setRoundMode('single')
    setRoundStationId('sta_skierg')
    setRoundPool([])
    setRunDistanceM(800)
    setRoundCount(4)
    setRestSec(120)
    musclesTouched.current   = false
    equipmentTouched.current = false
    typeTouched.current      = false
  }, [open, initialName])

  // Auto-predict on name (300ms debounce). Sets type + muscles + equipment
  // when the user hasn't touched those fields yet.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      const pred = predictExerciseMeta(name)
      if (!pred) return
      if (!typeTouched.current && type === 'weight-training' && pred.type !== 'weight-training') {
        setType(pred.type)
      }
      if (!musclesTouched.current && primaryMuscles.length === 0) {
        setPrimaryMuscles(pred.primaryMuscles)
      }
      if (!equipmentTouched.current && !equipment) {
        setEquipment(pred.equipment)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [name, open, type, primaryMuscles.length, equipment])

  // Save eligibility per type. MUST run before the `if (!open) return null`
  // early return below — every hook has to be called in the same order on
  // every render or React errors with "Rendered more hooks than during the
  // previous render."
  const canSave = useMemo(() => {
    if (!name.trim()) return false
    if (type === 'weight-training') {
      return primaryMuscles.length > 0 && !!equipment
    }
    if (type === 'running') {
      return !!runEquipment
    }
    if (type === 'hyrox-round') {
      const stationOk = roundMode === 'single'
        ? !!roundStationId
        : roundPool.length > 0
      return stationOk && runDistanceM > 0 && roundCount > 0 && restSec >= 0
    }
    if (type === 'hyrox-station') return false  // catalog only
    return false
  }, [name, type, primaryMuscles, equipment, runEquipment, roundMode, roundStationId, roundPool, runDistanceM, roundCount, restSec])

  if (!open) return null

  const pickType = (t) => {
    typeTouched.current = true
    setType(t)
  }

  const toggleMuscle = (m) => {
    musclesTouched.current = true
    setPrimaryMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
  }

  const pickEquipment = (eq) => {
    equipmentTouched.current = true
    setEquipment(eq)
  }

  const togglePoolStation = (id) => {
    setRoundPool(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const canSkip = type === 'weight-training' && name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    if (type === 'weight-training') {
      onSave({
        name:              name.trim(),
        type:              'weight-training',
        primaryMuscles,
        equipment,
        defaultUnilateral,
      })
      return
    }
    if (type === 'running') {
      onSave({
        name:           name.trim(),
        type:           'running',
        primaryMuscles: ['Full Body'],   // running entries don't tag muscle groups
        equipment:      runEquipment,
        trackIntensity,                  // stored for B43+ logger to honor
      })
      return
    }
    if (type === 'hyrox-round') {
      const roundConfig = {
        runDimensions: { distance: { default: runDistanceM, unit: 'm' } },
        ...(roundMode === 'single'
          ? { stationId: roundStationId, rotationPool: null }
          : { stationId: null, rotationPool: [...roundPool] }),
        defaultRoundCount: roundCount,
        defaultRestSeconds: restSec,
      }
      onSave({
        name:           name.trim(),
        type:           'hyrox-round',
        primaryMuscles: ['Full Body'],
        equipment:      'Other',
        roundConfig,
      })
      return
    }
  }

  const typeColor = getTypeColor(type)

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-end md:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg bg-card rounded-t-2xl md:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold">New exercise</h2>
          <button onClick={onCancel} className="text-xs text-c-muted active:text-c-secondary">
            Cancel
          </button>
        </div>

        {/* Type selector — 4 chips */}
        <p className="text-xs text-c-dim font-medium mb-1.5">Type</p>
        <div className="flex gap-1.5 mb-4">
          {TYPE_OPTIONS.map(opt => (
            <TypeChip
              key={opt.id}
              id={opt.id}
              label={opt.label}
              selected={type === opt.id}
              onClick={() => pickType(opt.id)}
            />
          ))}
        </div>

        {/* Name (all types except hyrox-station, which is catalog-only) */}
        {type !== 'hyrox-station' && (
          <>
            <p className="text-xs text-c-dim font-medium mb-1">Name</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={
                type === 'running' ? 'e.g. Easy Run, Treadmill HIIT'
                : type === 'hyrox-round' ? 'e.g. Run + SkiErg Round'
                : 'Exercise name'
              }
              className="w-full bg-item rounded-xl px-3 py-2.5 text-sm outline-none mb-4 placeholder:text-c-muted"
            />
          </>
        )}

        {/* Type-specific fields */}
        {type === 'weight-training' && (
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
              {EQUIPMENT_TYPES.map(eq => (
                <Pill key={eq} selected={equipment === eq} onClick={() => pickEquipment(eq)} theme={theme}>
                  {eq}
                </Pill>
              ))}
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

        {type === 'running' && (
          <>
            <p className="text-xs text-c-dim font-medium mb-1.5">Equipment</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {RUNNING_EQUIPMENT.map(eq => (
                <Pill key={eq} selected={runEquipment === eq} onClick={() => setRunEquipment(eq)} theme={theme}>
                  {eq}
                </Pill>
              ))}
            </div>

            <label className="flex items-center gap-2 mb-3 text-xs text-c-secondary">
              <input
                type="checkbox"
                checked={trackIntensity}
                onChange={e => setTrackIntensity(e.target.checked)}
              />
              Track intensity per session (Easy / Moderate / Hard / All-out)
            </label>

            <p className="text-[11px] text-c-muted italic mb-4">
              Distance and time are logged per session — no defaults to set here.
            </p>
          </>
        )}

        {type === 'hyrox-round' && (
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
                  Pick the stations this template rotates through.
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
              {ROUND_COUNTS.map(n => (
                <Pill key={n} selected={roundCount === n} onClick={() => setRoundCount(n)} theme={theme}>
                  {n} rounds
                </Pill>
              ))}
            </div>

            <p className="text-xs text-c-dim font-medium mb-1.5">Rest between rounds</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {REST_PRESETS.map(s => (
                <Pill key={s} selected={restSec === s} onClick={() => setRestSec(s)} theme={theme}>
                  {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
                </Pill>
              ))}
            </div>
          </>
        )}

        {type === 'hyrox-station' && (
          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: `${typeColor}15`, border: `1px solid ${typeColor}40` }}
          >
            <p className="text-xs font-semibold mb-1.5" style={{ color: typeColor }}>
              Catalog only
            </p>
            <p className="text-xs text-c-secondary leading-relaxed">
              The 8 HYROX stations are pre-seeded in your library. Find them under the
              HYROX filter and tap to edit equipment instance or rename.
            </p>
            <ul className="mt-2 text-[11px] text-c-muted space-y-0.5">
              {HYROX_STATIONS.map(s => (
                <li key={s.id}>• {s.name}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Save / Skip buttons */}
        {type === 'hyrox-station' ? (
          <button
            type="button"
            onClick={onCancel}
            className={`w-full py-3 rounded-xl font-semibold text-sm text-white ${theme.bg}`}
            style={{ color: theme.contrastText }}
          >
            Got it
          </button>
        ) : (
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

        {typeof onSkip === 'function' && canSkip && (
          <button
            type="button"
            onClick={() => onSkip({ name: name.trim() })}
            className="w-full mt-2 py-2.5 rounded-xl text-xs text-c-muted active:text-c-secondary"
          >
            Skip for now — tag later
          </button>
        )}
      </div>
    </div>
  )
}
