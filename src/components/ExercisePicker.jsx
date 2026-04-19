import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../store/useStore'
import { findSimilarExercises } from '../utils/helpers'
import { EXERCISE_LIBRARY, MUSCLE_GROUPS } from '../data/exerciseLibrary'
import CreateExerciseModal from './CreateExerciseModal'

// Batch 17i — shared ExercisePicker (Step 10 of the Split Builder redesign).
// Extracted from WorkoutEditSheet's 17g inline version so multiple surfaces
// (Canvas sheet, BbLogger's add-exercise panel in the future, etc.) can
// share one implementation. Two improvements over the 17g version:
//   1. "Recent in this split" tab — union of exercises from sibling workouts.
//      Only rendered when `recentInSplit` has entries.
//   2. "Search all muscles" checkbox — default ON. When OFF, search is
//      scoped to the active tab's muscle filter.
//
// Props:
//   addedExercises[]  — already in the current section (shown as "Added")
//   recentInSplit[]   — library entries used in sibling workouts (Step 10)
//   onAdd(name)       — fires when user picks a library entry or saves a new one
//   onClose()         — dismiss picker
//   theme             — getTheme(accentColor) output
//
// z-index 275 (above WorkoutEditSheet's 270).

export default function ExercisePicker({ addedExercises = [], recentInSplit = [], onAdd, onClose, theme }) {
  const storeLibrary = useStore(s => s.exerciseLibrary)
  const addExerciseToLibrary = useStore(s => s.addExerciseToLibrary)

  const [search, setSearch]           = useState('')
  const [tab, setTab]                 = useState(recentInSplit.length > 0 ? 'Recent' : 'All')
  const [searchAllMuscles, setSearchAllMuscles] = useState(true)
  const [customInput, setCustomInput] = useState('')
  const [createOpen, setCreateOpen]   = useState(false)
  const [pendingName, setPendingName] = useState('')

  const library = useMemo(() => {
    const source = storeLibrary && storeLibrary.length > 0 ? storeLibrary : EXERCISE_LIBRARY
    return source.map(e => ({
      ...e,
      muscleGroup: e.muscleGroup || (e.primaryMuscles && e.primaryMuscles[0]) || 'Other',
    }))
  }, [storeLibrary])

  const tabs = useMemo(() => {
    const base = recentInSplit.length > 0 ? ['Recent', 'All'] : ['All']
    return [...base, ...MUSCLE_GROUPS]
  }, [recentInSplit.length])

  // Build the working list per the active tab + search-scope toggle.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase()

    // Which entries can this tab pull from?
    let source
    if (tab === 'Recent') {
      source = recentInSplit
    } else if (tab === 'All') {
      source = library
    } else {
      source = library.filter(ex => ex.muscleGroup === tab)
    }

    // If search is on and user wants it scoped to "All muscles", search the
    // full library instead of the tab's filtered list.
    const searchPool = q && searchAllMuscles && tab !== 'Recent' ? library : source

    if (!q) return source
    return searchPool.filter(ex => ex.name.toLowerCase().includes(q))
  }, [library, recentInSplit, tab, search, searchAllMuscles])

  const addedNames = useMemo(
    () => new Set(addedExercises.map(ex => typeof ex === 'string' ? ex : ex.name)),
    [addedExercises]
  )

  const handleAddCustom = () => {
    const nm = customInput.trim()
    if (!nm) return
    // Fuzzy-match the typed name against the library; ≥0.85 → silent reuse.
    const topMatch = findSimilarExercises(nm, library, { suggestThreshold: 0.85, max: 1 })[0]
    if (topMatch) {
      onAdd(topMatch.exercise.name)
      setCustomInput('')
      return
    }
    setPendingName(nm)
    setCreateOpen(true)
  }

  const handleCreateSave = (payload) => {
    try {
      const newEntry = addExerciseToLibrary(payload)
      setCreateOpen(false)
      onAdd(newEntry.name)
      setCustomInput('')
    } catch (err) {
      console.warn('Exercise creation failed:', err.message)
    }
  }

  // Batch 17j — "Skip for now" path from CreateExerciseModal creates a
  // needsTagging:true entry with placeholder fields. The store action
  // allows this shape through its validation; the entry appears in the
  // Backfill UI later.
  const handleCreateSkip = ({ name }) => {
    try {
      const newEntry = addExerciseToLibrary({
        name,
        primaryMuscles: [],
        equipment: 'Other',
        defaultUnilateral: false,
        needsTagging: true,
      })
      setCreateOpen(false)
      onAdd(newEntry.name)
      setCustomInput('')
    } catch (err) {
      console.warn('Exercise skip-for-now failed:', err.message)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-base max-w-lg mx-auto"
      style={{ zIndex: 275 }}
    >
      <div className="px-4 pb-3 shrink-0" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <div className="flex items-center gap-3 mb-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-xl font-bold">Add Exercise</h2>
        </div>

        <input
          type="text"
          placeholder="Search exercises…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card rounded-xl px-4 py-3 text-sm outline-none placeholder:text-c-muted"
        />

        {/* Batch 17i — search scope toggle: default ON so typing finds
            everything. OFF limits search to the active tab's slice. */}
        <label className="inline-flex items-center gap-1.5 text-xs text-c-secondary mt-2">
          <input
            type="checkbox"
            checked={searchAllMuscles}
            onChange={e => setSearchAllMuscles(e.target.checked)}
            className="w-3.5 h-3.5 accent-current"
          />
          Search all muscles
        </label>
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === t ? `${theme.bg} text-white` : 'bg-item text-c-secondary'
            }`}
            style={tab === t ? { color: theme.contrastText } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1.5">
        {results.length === 0 && tab === 'Recent' && (
          <p className="text-center text-c-muted text-sm pt-8">
            No exercises from other workouts in this split yet.
          </p>
        )}
        {results.length === 0 && tab !== 'Recent' && (
          <p className="text-center text-c-muted text-sm pt-8">No exercises match.</p>
        )}
        {results.map(ex => {
          const added = addedNames.has(ex.name)
          return (
            <button
              key={ex.id || ex.name}
              type="button"
              onClick={() => !added && onAdd(ex.name)}
              disabled={added}
              className={`w-full text-left bg-card rounded-xl px-3 py-2.5 flex items-center gap-2 ${
                added ? 'opacity-50' : 'hover:bg-item'
              }`}
            >
              <span className="flex-1 text-sm">{ex.name}</span>
              {added && <span className="text-xs text-c-muted shrink-0">Added</span>}
            </button>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-subtle p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <label className="text-xs text-c-muted font-semibold uppercase tracking-wide block mb-2">
          Or add your own
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Exercise name"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
            className="flex-1 bg-card rounded-xl px-3 py-2.5 text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={!customInput.trim()}
            className={`px-4 py-2.5 rounded-xl font-semibold text-sm text-white disabled:opacity-40 ${theme.bg}`}
            style={{ color: theme.contrastText }}
          >
            Add
          </button>
        </div>
      </div>

      <CreateExerciseModal
        open={createOpen}
        initialName={pendingName}
        onSave={handleCreateSave}
        onSkip={handleCreateSkip}
        onCancel={() => setCreateOpen(false)}
        theme={theme}
      />
    </div>,
    document.body
  )
}
