// Batch 16j — Manage Exercise Library page.
// Batch 16l — added workout + usage filter chips so users don't have to
// wade through all 109 entries every time.
//
// Route: /exercises. Linked from HamburgerMenu ("My Exercises"). Lists
// library entries filtered by source (All / Custom / Built-in / Untagged)
// AND by workout context (Any / [each workout in active split] / Never
// logged). Tapping an entry opens ExerciseEditSheet.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { perSideLoad, formatDate, normalizeExerciseName } from '../utils/helpers'
import ExerciseEditSheet from '../components/ExerciseEditSheet'

const SOURCE_FILTERS = [
  { id: 'all',      label: 'All'       },
  { id: 'custom',   label: 'Custom'    },
  { id: 'builtin',  label: 'Built-in'  },
  { id: 'tagging',  label: 'Untagged'  },
]

function summaryText(e) {
  const muscles = (e.primaryMuscles || []).join(' / ')
  const parts = []
  if (e.needsTagging) parts.push('Needs tagging')
  else {
    if (muscles)     parts.push(muscles)
    if (e.equipment && e.equipment !== 'Other') parts.push(e.equipment)
  }
  return parts.join('  ·  ')
}

function lastLoggedFor(sessions, exerciseId) {
  if (!exerciseId) return null
  let best = null
  for (const s of sessions || []) {
    if (s?.mode !== 'bb' || !s?.data?.exercises) continue
    const ex = s.data.exercises.find(x => x.exerciseId === exerciseId)
    if (!ex) continue
    const top = (ex.sets || []).find(x => x.reps || x.weight)
    if (!top) continue
    const ts = new Date(s.date).getTime()
    if (!best || ts > best.ts) best = { ts, set: top, date: s.date }
  }
  return best
}

export default function ExerciseLibraryManager() {
  const navigate = useNavigate()
  const {
    exerciseLibrary,
    sessions,
    settings,
    splits,
    activeSplitId,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary,
  } = useStore()
  const theme = getTheme(settings.accentColor)
  const activeSplit = splits?.find(s => s.id === activeSplitId)

  const [sourceFilter,  setSourceFilter]  = useState('all')
  const [workoutFilter, setWorkoutFilter] = useState('any')  // 'any' | workoutId | 'logged' | 'never'
  const [search,        setSearch]        = useState('')
  const [editingId,     setEditingId]     = useState(null)

  // Build a lookup: exerciseIds referenced by each workout in the active split.
  // section.exercises items can be strings or {name, rec} objects (Batch 13),
  // so we unwrap the name and resolve against the library by id, canonical
  // name, or alias — same approach the v2→v3 migration uses.
  const exerciseIdsByWorkout = useMemo(() => {
    const byNormalized = new Map()
    for (const ex of exerciseLibrary || []) {
      byNormalized.set(normalizeExerciseName(ex.name), ex.id)
      for (const alias of ex.aliases || []) {
        if (!byNormalized.has(normalizeExerciseName(alias))) {
          byNormalized.set(normalizeExerciseName(alias), ex.id)
        }
      }
    }
    const map = new Map()
    for (const w of activeSplit?.workouts || []) {
      const ids = new Set()
      for (const section of w.sections || []) {
        for (const raw of section.exercises || []) {
          const name = typeof raw === 'string' ? raw : raw?.name
          if (!name) continue
          const id = byNormalized.get(normalizeExerciseName(name))
          if (id) ids.add(id)
        }
      }
      map.set(w.id, ids)
    }
    return map
  }, [activeSplit, exerciseLibrary])

  // Set of every exerciseId that has at least one logged session set
  const loggedIds = useMemo(() => {
    const s = new Set()
    for (const sess of sessions || []) {
      if (sess?.mode !== 'bb' || !sess?.data?.exercises) continue
      for (const ex of sess.data.exercises) {
        if (ex.exerciseId) s.add(ex.exerciseId)
      }
    }
    return s
  }, [sessions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (exerciseLibrary || []).filter(e => {
      // Source filter
      if (sourceFilter === 'custom'  && e.isBuiltIn)    return false
      if (sourceFilter === 'builtin' && !e.isBuiltIn)   return false
      if (sourceFilter === 'tagging' && !e.needsTagging) return false

      // Workout / usage filter
      if (workoutFilter === 'logged' && !loggedIds.has(e.id)) return false
      if (workoutFilter === 'never'  &&  loggedIds.has(e.id)) return false
      if (workoutFilter !== 'any' && workoutFilter !== 'logged' && workoutFilter !== 'never') {
        const ids = exerciseIdsByWorkout.get(workoutFilter)
        if (!ids || !ids.has(e.id)) return false
      }

      // Search
      if (!q) return true
      const names = [e.name, ...(e.aliases || [])]
      return names.some(n => (n || '').toLowerCase().includes(q))
    }).sort((a, b) => {
      // Surface needsTagging entries first within any filter that includes them
      if (!!a.needsTagging !== !!b.needsTagging) return a.needsTagging ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [exerciseLibrary, sourceFilter, workoutFilter, search, exerciseIdsByWorkout, loggedIds])

  const editing = editingId ? filtered.find(e => e.id === editingId) || exerciseLibrary.find(e => e.id === editingId) : null

  const handleSave = (id, patch) => {
    updateExerciseInLibrary(id, patch)
    setEditingId(null)
  }
  const handleDelete = (id) => {
    deleteExerciseFromLibrary(id)
    setEditingId(null)
  }

  const sourceCounts = useMemo(() => ({
    all:     (exerciseLibrary || []).length,
    custom:  (exerciseLibrary || []).filter(e => !e.isBuiltIn).length,
    builtin: (exerciseLibrary || []).filter(e =>  e.isBuiltIn).length,
    tagging: (exerciseLibrary || []).filter(e =>  e.needsTagging).length,
  }), [exerciseLibrary])

  const workoutCounts = useMemo(() => {
    const counts = {
      any:    (exerciseLibrary || []).length,
      logged: loggedIds.size,
      never:  (exerciseLibrary || []).filter(e => !loggedIds.has(e.id)).length,
    }
    for (const [wid, ids] of exerciseIdsByWorkout) counts[wid] = ids.size
    return counts
  }, [exerciseLibrary, loggedIds, exerciseIdsByWorkout])

  return (
    <div className="min-h-screen bg-base text-c-primary pb-24" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))' }}>
      <div className="px-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">My Exercises</h1>
            <p className="text-xs text-c-muted mt-0.5">{filtered.length} of {sourceCounts.all} shown</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-c-muted active:text-c-secondary"
          >
            Done
          </button>
        </div>

        {/* Source filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {SOURCE_FILTERS.map(f => {
            const n = sourceCounts[f.id] || 0
            if (f.id === 'tagging' && n === 0) return null
            const selected = sourceFilter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSourceFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selected ? `${theme.bg} text-white` : 'bg-item text-c-secondary'
                }`}
                style={selected ? { color: theme.contrastText } : undefined}
              >
                {f.label} <span className="opacity-70 ml-0.5">{n}</span>
              </button>
            )
          })}
        </div>

        {/* Workout / usage filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button
            type="button"
            onClick={() => setWorkoutFilter('any')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              workoutFilter === 'any' ? `${theme.bg} text-white` : 'bg-item text-c-secondary'
            }`}
            style={workoutFilter === 'any' ? { color: theme.contrastText } : undefined}
          >
            Any workout
          </button>
          {(activeSplit?.workouts || []).map(w => {
            const n = workoutCounts[w.id] || 0
            if (n === 0) return null
            const selected = workoutFilter === w.id
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkoutFilter(w.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selected ? `${theme.bg} text-white` : 'bg-item text-c-secondary'
                }`}
                style={selected ? { color: theme.contrastText } : undefined}
              >
                {w.name?.split(' — ')[0] || w.id} <span className="opacity-70 ml-0.5">{n}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setWorkoutFilter('logged')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              workoutFilter === 'logged' ? `${theme.bg} text-white` : 'bg-item text-c-secondary'
            }`}
            style={workoutFilter === 'logged' ? { color: theme.contrastText } : undefined}
          >
            Logged <span className="opacity-70 ml-0.5">{workoutCounts.logged}</span>
          </button>
          <button
            type="button"
            onClick={() => setWorkoutFilter('never')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              workoutFilter === 'never' ? `${theme.bg} text-white` : 'bg-item text-c-secondary'
            }`}
            style={workoutFilter === 'never' ? { color: theme.contrastText } : undefined}
          >
            Never logged <span className="opacity-70 ml-0.5">{workoutCounts.never}</span>
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className="w-full bg-item rounded-xl px-3 py-2.5 text-sm outline-none mb-4 placeholder:text-c-muted"
        />

        <div className="space-y-1.5">
          {filtered.map(e => {
            const last = lastLoggedFor(sessions, e.id)
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditingId(e.id)}
                className="w-full bg-card rounded-xl p-3 text-left active:bg-hover"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-c-primary truncate">{e.name}</p>
                      {e.needsTagging && (
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/40 rounded px-1.5 py-0.5">
                          Tag
                        </span>
                      )}
                      {!e.isBuiltIn && !e.needsTagging && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-c-faint">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-c-muted mt-0.5 truncate">
                      {summaryText(e) || <span className="italic">Needs setup</span>}
                    </p>
                    {last && (
                      <p className="text-[11px] text-c-faint mt-0.5">
                        Last logged: {perSideLoad(last.set) || '—'}{last.set.reps ? ` × ${last.set.reps}` : ''} · {formatDate(last.date)}
                      </p>
                    )}
                  </div>
                  <span className="text-c-faint shrink-0">›</span>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="bg-card rounded-xl p-6 text-center">
              <p className="text-sm text-c-muted">No exercises match.</p>
            </div>
          )}
        </div>
      </div>

      <ExerciseEditSheet
        open={!!editing}
        exercise={editing}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={() => setEditingId(null)}
        theme={theme}
      />
    </div>
  )
}
