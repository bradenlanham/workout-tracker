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
// Batch 53 — search + usage upgrades:
//   3. Hybrid substring + fuzzy search. Substring matches first; token-
//      subset then trigram (>= 0.5) fuzzy matches appended below. Catches
//      token-order variants ("DB Lateral" → "Lateral DB Raises") and
//      typos ("Pec deck" → "Pec Dec") that pure substring missed. Fuzzy-
//      only rows get a small "≈" glyph so the user understands the match.
//   4. Per-row distinct-session usage count ("Logged 8 times" / "Logged
//      once" / "Never logged"). Lookup keyed on exerciseId with name
//      fallback for pre-Batch-15 sessions. Drops are nested in parent
//      sets so they don't double-count at the exercise level.
//   5. Logged / Never logged filter chip — orthogonal axis to muscle
//      tabs. Mirrors the Batch 16l pattern from /exercises.
//   6. Sort default in the All tab when no query: usage-desc then alpha,
//      so high-history entries surface first while browsing. Recent +
//      muscle tabs preserve their natural source order. With a query,
//      tier order wins (substring → token-subset → trigram).
//
// Props:
//   addedExercises[]  — already in the current section (shown as "Added")
//   recentInSplit[]   — library entries used in sibling workouts (Step 10)
//   onAdd(name)       — fires when user picks a library entry or saves a new one
//   onClose()         — dismiss picker
//   theme             — getTheme(accentColor) output
//
// z-index 275 (above WorkoutEditSheet's 270).

const USAGE_FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'logged', label: 'Logged' },
  { id: 'never',  label: 'Never logged' },
]

export default function ExercisePicker({ addedExercises = [], recentInSplit = [], onAdd, onClose, theme }) {
  const storeLibrary = useStore(s => s.exerciseLibrary)
  const sessions = useStore(s => s.sessions)
  const addExerciseToLibrary = useStore(s => s.addExerciseToLibrary)

  const [search, setSearch]           = useState('')
  const [tab, setTab]                 = useState(recentInSplit.length > 0 ? 'Recent' : 'All')
  const [searchAllMuscles, setSearchAllMuscles] = useState(true)
  const [usageFilter, setUsageFilter] = useState('all')
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

  // Distinct-session count per library entry. One scan; per-exercise
  // increment per occurrence in a session (drops are nested in parent
  // set, not double-counted at this level). Lookup keys on exerciseId
  // first, name fallback for pre-Batch-15 / alias matches.
  const useCountByKey = useMemo(() => {
    const map = {}
    for (const session of sessions) {
      if (session.mode !== 'bb') continue
      for (const ex of (session.data?.exercises || [])) {
        const key = ex.exerciseId || ex.name
        if (!key) continue
        map[key] = (map[key] || 0) + 1
      }
    }
    return map
  }, [sessions])

  const countFor = (ex) =>
    useCountByKey[ex.id] ?? useCountByKey[ex.name] ?? 0

  // Build the working list. Three layers:
  //   1. Source pool: Recent / All / muscle-filtered library.
  //   2. Tiered match when query is present:
  //        Tier 1: substring matches (familiar behavior).
  //        Tier 2: token-subset (catches "db lateral" → "Lateral DB
  //                Raises" — query's tokens all present in candidate
  //                in any order). Skipped for single-word queries.
  //        Tier 3: trigram jaccard >= 0.5 via findSimilarExercises
  //                (catches typos like "Pec deck" → "Pec Dec").
  //   3. Usage filter + sort default.
  // Returns { list, fuzzyOnlySet } so the renderer can mark fuzzy-only
  // rows with a ≈ glyph.
  const searchView = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fuzzyOnly = new Set()

    let source
    if (tab === 'Recent') {
      source = recentInSplit
    } else if (tab === 'All') {
      source = library
    } else {
      source = library.filter(ex => ex.muscleGroup === tab)
    }

    const searchPool = q && searchAllMuscles && tab !== 'Recent' ? library : source

    let working
    if (!q) {
      working = source.slice()
    } else {
      const seen = new Set()
      const matches = []

      // Tier 1: substring matches first (familiar, strong-intent).
      for (const ex of searchPool) {
        if (ex.name.toLowerCase().includes(q)) {
          matches.push(ex)
          seen.add(ex.id || ex.name)
        }
      }

      // Tier 2: token-subset (multi-word queries only). Catches
      // "db lateral" → "Lateral DB Raises" where the query's tokens
      // are all present in the candidate in any order. Light stem
      // (drop trailing 's') so singular/plural variants compare
      // equal — "curl" matches "curls", "raise" matches "raises".
      const stem = t => t.replace(/s$/, '')
      const qTokens = q.split(/\s+/).filter(Boolean)
      if (qTokens.length >= 2) {
        const qStems = qTokens.map(stem)
        for (const ex of searchPool) {
          const key = ex.id || ex.name
          if (seen.has(key)) continue
          const exStems = ex.name.toLowerCase().split(/\s+/).filter(Boolean).map(stem)
          if (qStems.every(t => exStems.includes(t))) {
            matches.push(ex)
            seen.add(key)
            fuzzyOnly.add(key)
          }
        }
      }

      // Tier 3: trigram jaccard fuzzy (catches typos / partial overlaps).
      const trigramHits = findSimilarExercises(q, searchPool, { suggestThreshold: 0.5, max: 10 })
      for (const m of trigramHits) {
        const key = m.exercise.id || m.exercise.name
        if (seen.has(key)) continue
        matches.push(m.exercise)
        seen.add(key)
        fuzzyOnly.add(key)
      }

      working = matches
    }

    if (usageFilter === 'logged') {
      working = working.filter(ex => (useCountByKey[ex.id] ?? useCountByKey[ex.name] ?? 0) > 0)
    } else if (usageFilter === 'never') {
      working = working.filter(ex => (useCountByKey[ex.id] ?? useCountByKey[ex.name] ?? 0) === 0)
    }

    // Browse mode (no query) on the All tab: surface high-history first.
    // Recent + muscle tabs keep their natural source order.
    // With a query: keep tier order (substring → token-subset → trigram).
    if (!q && tab === 'All') {
      working.sort((a, b) => {
        const ca = useCountByKey[a.id] ?? useCountByKey[a.name] ?? 0
        const cb = useCountByKey[b.id] ?? useCountByKey[b.name] ?? 0
        if (cb !== ca) return cb - ca
        return a.name.localeCompare(b.name)
      })
    }

    return { list: working, fuzzyOnlySet: fuzzyOnly }
  }, [library, recentInSplit, tab, search, searchAllMuscles, usageFilter, useCountByKey])

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

  const emptyMessage = searchView.list.length === 0
    ? tab === 'Recent'
      ? 'No exercises from other workouts in this split yet.'
      : usageFilter === 'logged'
        ? 'No logged exercises here yet.'
        : usageFilter === 'never'
          ? 'Every exercise here has been logged.'
          : 'No exercises match.'
    : null

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

      {/* Batch 53 — usage-filter chip row (orthogonal to muscle tabs) */}
      <div className="flex gap-1.5 px-4 pb-2 shrink-0">
        {USAGE_FILTERS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setUsageFilter(opt.id)}
            className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${
              usageFilter === opt.id ? theme.bg : 'bg-item text-c-secondary'
            }`}
            style={usageFilter === opt.id ? { color: theme.contrastText } : undefined}
          >
            {opt.label}
          </button>
        ))}
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
        {emptyMessage && (
          <p className="text-center text-c-muted text-sm pt-8">{emptyMessage}</p>
        )}
        {searchView.list.map(ex => {
          const added = addedNames.has(ex.name)
          const key = ex.id || ex.name
          const count = countFor(ex)
          const fuzzyOnly = searchView.fuzzyOnlySet.has(key)
          const usageText = count >= 2
            ? `Logged ${count} times`
            : count === 1
              ? 'Logged once'
              : 'Never logged'
          return (
            <button
              key={key}
              type="button"
              onClick={() => !added && onAdd(ex.name)}
              disabled={added}
              className={`w-full text-left bg-card rounded-xl px-3 py-2 flex items-center gap-2 ${
                added ? 'opacity-50' : 'hover:bg-item'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm flex items-center gap-1.5">
                  {fuzzyOnly && (
                    <span
                      className="text-c-muted shrink-0"
                      aria-label="Similar match"
                      title="Similar match"
                    >
                      ≈
                    </span>
                  )}
                  <span className="truncate">{ex.name}</span>
                </div>
                <div className={`text-[11px] tabular-nums leading-tight ${count > 0 ? 'text-c-muted' : 'text-c-faint'}`}>
                  {usageText}
                </div>
              </div>
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
