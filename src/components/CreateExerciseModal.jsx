import { useEffect, useRef, useState } from 'react'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exerciseLibrary'
import { predictExerciseMeta } from '../utils/helpers'

// Shared modal for creating a new library entry from either picker.
// Requires primaryMuscles (≥1) and equipment per §3.2.1 when the user
// saves a "real" entry. Batch 17j adds two Step 11 affordances:
//
//   1. Auto-predict muscle + equipment from the name (300ms debounce).
//      `predictExerciseMeta` does keyword-based lookup. The auto-fill
//      stops overriding as soon as the user taps any muscle or equipment
//      chip — we respect the manual choice after that.
//
//   2. "Skip for now" button — calls `onSkip({name})` so the picker can
//      create a needsTagging:true entry and move on. The user can
//      finish tagging later in Backfill / My Exercises.
//
// Props:
//   open: boolean
//   initialName: string
//   onSave: ({ name, primaryMuscles, equipment, defaultUnilateral }) => void
//   onSkip: ({ name }) => void           — optional, shows the Skip button
//   onCancel: () => void
//   theme: getTheme(...)

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

export default function CreateExerciseModal({ open, initialName = '', onSave, onSkip, onCancel, theme }) {
  const [name, setName] = useState(initialName)
  const [primaryMuscles, setPrimaryMuscles] = useState([])
  const [equipment, setEquipment] = useState('')
  const [defaultUnilateral, setDefaultUnilateral] = useState(false)

  // Once the user taps a muscle or equipment chip we stop auto-filling.
  // Reset whenever the modal reopens with a fresh name.
  const musclesTouched   = useRef(false)
  const equipmentTouched = useRef(false)

  useEffect(() => {
    if (open) {
      setName(initialName)
      setPrimaryMuscles([])
      setEquipment('')
      setDefaultUnilateral(false)
      musclesTouched.current   = false
      equipmentTouched.current = false
    }
  }, [open, initialName])

  // 300ms debounced auto-predict on the name. Only fills fields the user
  // hasn't touched yet. No-op once both are touched or if no keyword matches.
  useEffect(() => {
    if (!open) return
    if (musclesTouched.current && equipmentTouched.current) return
    const t = setTimeout(() => {
      const pred = predictExerciseMeta(name)
      if (!pred) return
      if (!musclesTouched.current && primaryMuscles.length === 0) {
        setPrimaryMuscles(pred.primaryMuscles)
      }
      if (!equipmentTouched.current && !equipment) {
        setEquipment(pred.equipment)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [name, open, primaryMuscles.length, equipment])

  if (!open) return null

  const canSave =
    name.trim().length > 0
    && primaryMuscles.length > 0
    && equipment

  const canSkip = name.trim().length > 0

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

        <p className="text-xs text-c-dim font-medium mb-1">Name</p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Exercise name"
          className="w-full bg-item rounded-xl px-3 py-2.5 text-sm outline-none mb-4 placeholder:text-c-muted"
        />

        <p className="text-xs text-c-dim font-medium mb-1.5">Primary muscles <span className="text-c-muted">(at least 1)</span></p>
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

        <button
          type="button"
          onClick={() => canSave && onSave({
            name: name.trim(),
            primaryMuscles,
            equipment,
            defaultUnilateral,
          })}
          disabled={!canSave}
          className={`w-full py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40 ${theme.bg}`}
          style={{ color: theme.contrastText }}
        >
          Save
        </button>

        {typeof onSkip === 'function' && (
          <button
            type="button"
            onClick={() => canSkip && onSkip({ name: name.trim() })}
            disabled={!canSkip}
            className="w-full mt-2 py-2.5 rounded-xl text-xs text-c-muted disabled:opacity-40 active:text-c-secondary"
          >
            Skip for now — tag later
          </button>
        )}
      </div>
    </div>
  )
}
