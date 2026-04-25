// Batch 16j — Manage Exercise Library page.
// Batch 16l — added workout + usage filter chips so users don't have to
// wade through all 109 entries every time.
// Batch 39 — type-axis filter (All · Lift · Run · HYROX), row stripes per
// type, type-aware last-set summary, source-axis chips moved into a ⋯
// overflow on the topbar, "+ New exercise" entry point right next to Done.
//
// Route: /exercises. Linked from HamburgerMenu ("My Exercises"). Lists
// library entries filtered by type (All/Lift/Run/HYROX) AND by workout
// context (Any / [each workout in active split] / Logged / Never logged),
// with source-axis (All/Custom/Built-in/Untagged) tucked into the overflow
// so it stays available for the sweep-out moments without crowding the
// primary filter row.

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import {
  formatDate, normalizeExerciseName,
  getTypeColor, getTypeLabel, getTypeFilterBucket, formatLastSetSummary,
} from '../utils/helpers'
import ExerciseEditSheet from '../components/ExerciseEditSheet'
import CreateExerciseModal from '../components/CreateExerciseModal'

const TYPE_FILTERS = [
  { id: 'all',   label: 'All' },
  { id: 'lift',  label: 'Lift' },
  { id: 'run',   label: 'Run' },
  { id: 'hyrox', label: 'HYROX' },
]

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

// Source-filter overflow popover — anchored ⋯ button on the topbar.
// Opens a small portal panel with the four source-axis pills + a count
// badge per option. Outside-click + Escape dismiss. Mirrors the
// SplitManager OverflowMenu pattern from Batch 17c.
function SourceFilterOverflow({ open, anchorRef, onClose, sourceFilter, setSourceFilter, sourceCounts, theme }) {
  const [pos, setPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const onDocDown = (e) => {
      if (anchorRef.current && anchorRef.current.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDocDown)
      document.addEventListener('touchstart', onDocDown)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      className="fixed bg-card rounded-xl border border-white/10 shadow-2xl p-2"
      style={{ top: pos.top, right: pos.right, zIndex: 60, minWidth: 180 }}
    >
      <p className="text-[10px] uppercase tracking-wider text-c-faint px-2 pt-1 pb-1.5">Source</p>
      <div className="flex flex-col">
        {SOURCE_FILTERS.map(f => {
          const n = sourceCounts[f.id] || 0
          if (f.id === 'tagging' && n === 0) return null
          const selected = sourceFilter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => { setSourceFilter(f.id); onClose() }}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-xs text-c-primary hover:bg-hover"
            >
              <span className="font-semibold flex items-center gap-1.5">
                {selected && <span style={{ color: theme.hex }}>•</span>}
                <span className={selected ? '' : 'pl-3'}>{f.label}</span>
              </span>
              <span className="text-c-muted tabular-nums">{n}</span>
            </button>
          )
        })}
      </div>
    </div>,
    document.body
  )
}

export default function ExerciseLibraryManager() {
  const navigate = useNavigate()
  const {
    exerciseLibrary,
    sessions,
    settings,
    splits,
    activeSplitId,
    addExerciseToLibrary,
    updateExerciseInLibrary,
    deleteExerciseFromLibrary,
  } = useStore()
  const theme = getTheme(settings.accentColor)
  const activeSplit = splits?.find(s => s.id === activeSplitId)

  const [typeFilter,    setTypeFilter]    = useState('all')   // 'all' | 'lift' | 'run' | 'hyrox'
  const [sourceFilter,  setSourceFilter]  = useState('all')
  const [workoutFilter, setWorkoutFilter] = useState('any')   // 'any' | workoutId | 'logged' | 'never'
  const [search,        setSearch]        = useState('')
  const [editingId,     setEditingId]     = useState(null)
  const [creating,      setCreating]      = useState(false)
  const [overflowOpen,  setOverflowOpen]  = useState(false)
  const overflowRef = useRef(null)

  // Build a lookup: exerciseIds referenced by each workout in the active split.
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
      // Type-axis filter (Batch 39 — primary axis)
      if (typeFilter !== 'all') {
        const bucket = getTypeFilterBucket(e.type || 'weight-training')
        if (bucket !== typeFilter) return false
      }

      // Source filter (overflow axis)
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
  }, [exerciseLibrary, typeFilter, sourceFilter, workoutFilter, search, exerciseIdsByWorkout, loggedIds])

  const editing = editingId ? filtered.find(e => e.id === editingId) || exerciseLibrary.find(e => e.id === editingId) : null

  const handleSave = (id, patch) => {
    updateExerciseInLibrary(id, patch)
    setEditingId(null)
  }
  const handleDelete = (id) => {
    deleteExerciseFromLibrary(id)
    setEditingId(null)
  }
  const handleCreate = (payload) => {
    try {
      addExerciseToLibrary(payload)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('addExerciseToLibrary failed:', err.message)
      alert(err.message)
      return
    }
    setCreating(false)
  }

  const sourceCounts = useMemo(() => ({
    all:     (exerciseLibrary || []).length,
    custom:  (exerciseLibrary || []).filter(e => !e.isBuiltIn).length,
    builtin: (exerciseLibrary || []).filter(e =>  e.isBuiltIn).length,
    tagging: (exerciseLibrary || []).filter(e =>  e.needsTagging).length,
  }), [exerciseLibrary])

  // Type-axis counts — drives the primary filter row's badge numbers.
  const typeCounts = useMemo(() => {
    const out = { all: 0, lift: 0, run: 0, hyrox: 0 }
    for (const e of exerciseLibrary || []) {
      const bucket = getTypeFilterBucket(e.type || 'weight-training')
      out.all += 1
      if (bucket === 'lift')  out.lift += 1
      if (bucket === 'run')   out.run += 1
      if (bucket === 'hyrox') out.hyrox += 1
    }
    return out
  }, [exerciseLibrary])

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
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">My Exercises</h1>
            <p className="text-xs text-c-muted mt-0.5">{filtered.length} of {sourceCounts.all} shown</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${theme.bg}`}
              style={{ color: theme.contrastText }}
            >
              + New
            </button>
            <button
              ref={overflowRef}
              type="button"
              onClick={() => setOverflowOpen(o => !o)}
              className="w-9 h-9 rounded-lg bg-item text-c-secondary flex items-center justify-center text-base font-bold"
              aria-label="More filters"
            >
              ⋯
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-c-muted active:text-c-secondary px-1"
            >
              Done
            </button>
          </div>
        </div>

        {/* Batch 39 — primary type-axis filter row */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {TYPE_FILTERS.map(f => {
            const n = typeCounts[f.id] || 0
            if (f.id !== 'all' && n === 0) return null
            const selected = typeFilter === f.id
            const accent = f.id === 'all'   ? theme.hex
                        : f.id === 'lift'  ? '#60A5FA'
                        : f.id === 'run'   ? '#34D399'
                        : '#EAB308'  // hyrox
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={selected
                  ? { background: accent, color: '#0a0a0a' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: `1px solid ${accent}26` }}
              >
                {f.label} <span className="opacity-70 ml-0.5 tabular-nums">{n}</span>
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
            const type = e.type || 'weight-training'
            const typeColor = getTypeColor(type)
            const typeLabel = getTypeLabel(type)
            const lastSummary = last ? formatLastSetSummary(last.set, type) : null
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditingId(e.id)}
                className="w-full bg-card rounded-xl text-left active:bg-hover relative overflow-hidden"
              >
                {/* Batch 39 — left-edge type stripe (3px). */}
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{ width: 3, background: typeColor }}
                />
                <div className="pl-4 pr-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm text-c-primary truncate">{e.name}</p>
                        <span
                          className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded"
                          style={{ color: typeColor, background: `${typeColor}14`, border: `1px solid ${typeColor}40` }}
                        >
                          {typeLabel}
                        </span>
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
                      {lastSummary && (
                        <p className="text-[11px] text-c-faint mt-0.5">
                          Last logged: {lastSummary} · {formatDate(last.date)}
                        </p>
                      )}
                    </div>
                    <span className="text-c-faint shrink-0">›</span>
                  </div>
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

      <CreateExerciseModal
        open={creating}
        initialName=""
        onSave={handleCreate}
        onCancel={() => setCreating(false)}
        theme={theme}
      />

      <SourceFilterOverflow
        open={overflowOpen}
        anchorRef={overflowRef}
        onClose={() => setOverflowOpen(false)}
        sourceFilter={sourceFilter}
        setSourceFilter={setSourceFilter}
        sourceCounts={sourceCounts}
        theme={theme}
      />
    </div>
  )
}
