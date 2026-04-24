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
    }
  }, [open, exercise])

  if (!open || !exercise) return null

  const canSave =
    name.trim().length > 0
    && primaryMuscles.length > 0
    && equipment
    && equipment !== 'Other'
    && rangeMin >= 1 && rangeMax >= rangeMin && rangeMax <= 30

  const toggleMuscle = (m) => {
    setPrimaryMuscles(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
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
    onSave(exercise.id, {
      name:              name.trim(),
      primaryMuscles,
      equipment,
      defaultUnilateral,
      loadIncrement,
      // Batch 31.2 — clamp min ≤ max and persist; flip the user-set flag so
      // the recommender stops inferring from history for this exercise.
      defaultRepRange:   [rangeMin, Math.max(rangeMin, rangeMax)],
      repRangeUserSet:   true,
      needsTagging:      false,
    })
  }

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
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-c-faint">
              {exercise.isBuiltIn ? 'Built-in exercise' : 'Custom exercise'}
            </div>
            <h3 className="text-lg font-bold text-c-primary truncate">{exercise.name}</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-9 h-9 rounded-full bg-item text-c-secondary flex items-center justify-center text-lg shrink-0"
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
          className="w-full bg-item rounded-xl px-3 py-2.5 text-sm outline-none mb-4 placeholder:text-c-muted"
        />

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
            Pick at least one muscle group and an equipment type to save.
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}
