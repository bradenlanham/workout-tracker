import { useState, useEffect } from 'react'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exerciseLibrary'

// Shared modal for creating a new library entry from either picker.
// Requires primaryMuscles (≥1) and equipment per §3.2.1 so the recommender
// and muscle-group-aware features have what they need from day one — no
// more deferred tagging via the backfill UI for newly-created exercises.
//
// Props:
//   open: boolean — show/hide
//   initialName: string — pre-filled from what the user typed in the picker
//   onSave: ({ name, primaryMuscles, equipment, defaultUnilateral }) => void
//   onCancel: () => void
//   theme: getTheme(...) — for accent colors

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

export default function CreateExerciseModal({ open, initialName = '', onSave, onCancel, theme }) {
  const [name, setName] = useState(initialName)
  const [primaryMuscles, setPrimaryMuscles] = useState([])
  const [equipment, setEquipment] = useState('')
  const [defaultUnilateral, setDefaultUnilateral] = useState(false)

  // Reset state every time the modal reopens with a fresh name
  useEffect(() => {
    if (open) {
      setName(initialName)
      setPrimaryMuscles([])
      setEquipment('')
      setDefaultUnilateral(false)
    }
  }, [open, initialName])

  if (!open) return null

  const canSave =
    name.trim().length > 0
    && primaryMuscles.length > 0
    && equipment

  const toggleMuscle = (m) => {
    setPrimaryMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
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
            <Pill key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)} theme={theme}>
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
      </div>
    </div>
  )
}
