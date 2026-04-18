// Batch 16j — Manage Exercise Library page.
//
// Route: /exercises. Linked from HamburgerMenu ("My Exercises"). Lists
// every library entry with filter chips, search, and a summary of each
// entry's muscles/equipment. Tapping an entry opens ExerciseEditSheet.
// Deleting a custom entry cascades through mergeExercises isn't exposed
// here (merging is specialized — that's a future enhancement surfaced
// only when duplicates are detected at save-time).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { perSideLoad, formatDate } from '../utils/helpers'
import ExerciseEditSheet from '../components/ExerciseEditSheet'

const FILTERS = [
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
    updateExerciseInLibrary,
    deleteExerciseFromLibrary,
  } = useStore()
  const theme = getTheme(settings.accentColor)

  const [filter, setFilter]       = useState('all')
  const [search, setSearch]       = useState('')
  const [editingId, setEditingId] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (exerciseLibrary || []).filter(e => {
      if (filter === 'custom'  && e.isBuiltIn) return false
      if (filter === 'builtin' && !e.isBuiltIn) return false
      if (filter === 'tagging' && !e.needsTagging) return false
      if (!q) return true
      const names = [e.name, ...(e.aliases || [])]
      return names.some(n => (n || '').toLowerCase().includes(q))
    }).sort((a, b) => {
      // Surface needsTagging entries first within any filter that includes them
      if (!!a.needsTagging !== !!b.needsTagging) return a.needsTagging ? -1 : 1
      return (a.name || '').localeCompare(b.name || '')
    })
  }, [exerciseLibrary, filter, search])

  const editing = editingId ? filtered.find(e => e.id === editingId) || exerciseLibrary.find(e => e.id === editingId) : null

  const handleSave = (id, patch) => {
    updateExerciseInLibrary(id, patch)
    setEditingId(null)
  }
  const handleDelete = (id) => {
    deleteExerciseFromLibrary(id)
    setEditingId(null)
  }

  const counts = useMemo(() => ({
    all:     (exerciseLibrary || []).length,
    custom:  (exerciseLibrary || []).filter(e => !e.isBuiltIn).length,
    builtin: (exerciseLibrary || []).filter(e =>  e.isBuiltIn).length,
    tagging: (exerciseLibrary || []).filter(e =>  e.needsTagging).length,
  }), [exerciseLibrary])

  return (
    <div className="min-h-screen bg-base text-c-primary pb-24" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))' }}>
      <div className="px-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">My Exercises</h1>
            <p className="text-xs text-c-muted mt-0.5">{filtered.length} of {counts.all} shown</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-c-muted active:text-c-secondary"
          >
            Done
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FILTERS.map(f => {
            const n = counts[f.id] || 0
            if (f.id === 'tagging' && n === 0) return null
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === f.id
                    ? `${theme.bg} text-white`
                    : 'bg-item text-c-secondary'
                }`}
                style={filter === f.id ? { color: theme.contrastText } : undefined}
              >
                {f.label} <span className="opacity-70 ml-0.5">{n}</span>
              </button>
            )
          })}
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
