import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme, getSaveTheme } from '../theme'
import { generateId, formatTimeAgo, normalizeExerciseName, normalizeExerciseEntry } from '../utils/helpers'
import WorkoutEditSheet from '../components/WorkoutEditSheet'
import EmojiPicker from '../components/EmojiPicker'
import RestDayChip from '../components/RestDayChip'
import RowOverflowMenu from '../components/RowOverflowMenu'
import { showToast } from '../components/Toast'

// Batch 17g — SplitCanvas (Step 7 of the Split Builder redesign).
// Single-canvas editor that replaces the legacy 4-step linear wizard for
// both /splits/new and /splits/edit/:id. The whole split (name, emoji,
// workouts, rotation) is always visible and always editable; Save is always
// one tap away via the sticky footer.
//
// Decisions baked in:
//   D5  — curated emoji grid + OS fallback (EmojiPicker)
//   D6  — rotation defaults to Cycle view; Week grid is opt-in
//   D3  — rest days render as dashed-circle "R" everywhere (RestDayChip)
//
// The workout editing surface is WorkoutEditSheet (Step 8, bottom-sheet).
// Draft auto-save reuses the Batch 17a slice: any change flips isDirty;
// a 500ms debounced effect writes to setSplitDraft. The resume banner
// pre-loads the draft into local state AND offers Keep / Discard, matching
// the spec for Canvas (the wizard flow showed Resume / Discard because the
// state wasn't pre-loaded there).

const DRAFT_STALE_MS = 7 * 24 * 60 * 60 * 1000

export default function SplitCanvas() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const splits          = useStore(s => s.splits)
  const activeSplitId   = useStore(s => s.activeSplitId)
  const addSplit        = useStore(s => s.addSplit)
  const addSplitWithLibrary = useStore(s => s.addSplitWithLibrary)
  const updateSplit     = useStore(s => s.updateSplit)
  const deleteSplit     = useStore(s => s.deleteSplit)
  const setActiveSplit  = useStore(s => s.setActiveSplit)
  const splitDraft      = useStore(s => s.splitDraft)
  const setSplitDraft   = useStore(s => s.setSplitDraft)
  const clearSplitDraft = useStore(s => s.clearSplitDraft)
  const exerciseLibrary = useStore(s => s.exerciseLibrary)
  const settings        = useStore(s => s.settings)
  const theme           = getTheme(settings.accentColor)
  // Batch 18e — shared getSaveTheme() handles the red→emerald fallback.
  const saveTheme       = getSaveTheme(settings.accentColor)

  const existingSplit = isEditing ? splits.find(s => s.id === id) : null

  // Normalize sections the way the legacy wizard did so we don't regress
  // Batch 13's rec-preservation when loading an existing split.
  // Batch 18a — delegates to the lossless `normalizeExerciseEntry` helper.
  // Previously, any entry whose shape didn't match `string | {name}` was
  // silently filtered by `.filter(Boolean)` — root cause of the missing
  // "Flat Bench Press" bug in BamBam's Blueprint → Push → Primary.
  const normalizeWorkouts = (ws) => (ws || []).map(w => ({
    ...w,
    name: w.name || 'Workout',
    emoji: w.emoji || '🏋️',
    sections: (w.sections || []).map(s => ({
      ...s,
      exercises: (s.exercises || []).map(normalizeExerciseEntry).filter(Boolean),
    })),
  }))

  // Canvas-local state
  const [name, setName]       = useState(existingSplit?.name || '')
  const [emoji, setEmoji]     = useState(existingSplit?.emoji || '🏋️')
  const [workouts, setWorkouts] = useState(() => normalizeWorkouts(existingSplit?.workouts))
  const [rotation, setRotation] = useState(() => [...(existingSplit?.rotation || [])])
  const [activateOnSave, setActivateOnSave] = useState(
    !isEditing ? true : (activeSplitId !== existingSplit?.id)
  )

  // UI-local state
  const [rotationView, setRotationView]   = useState('cycle')
  const [workoutsExpanded, setWorkoutsExpanded] = useState(true)
  const [rotationExpanded, setRotationExpanded] = useState(true)
  const [editingWorkoutId, setEditingWorkoutId] = useState(null)
  const [isNewSheet, setIsNewSheet]       = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [rotationMenuIdx, setRotationMenuIdx] = useState(null)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [showDiscardModal, setShowDiscardModal] = useState(false)
  const [showOverflow, setShowOverflow]   = useState(false)
  const overflowAnchorRef = useRef(null)
  const [isDirty, setIsDirty]             = useState(false)

  // Mount effect — draft detection + pre-load + banner. Auto-clear stale or
  // orphaned drafts, same logic as the legacy wizard (Batch 17a).
  useEffect(() => {
    if (!splitDraft) return
    const ageMs = Date.now() - (splitDraft.updatedAt || 0)
    const isStale = ageMs > DRAFT_STALE_MS
    const orphaned = splitDraft.originalId && !splits.find(s => s.id === splitDraft.originalId)
    if (isStale || orphaned) {
      clearSplitDraft()
      return
    }
    const isForCreate   = !isEditing && splitDraft.originalId === null
    const isForThisEdit = isEditing  && splitDraft.originalId === id
    if (!(isForCreate || isForThisEdit)) return

    // Pre-load immediately so the user sees their work without a second tap.
    const d = splitDraft.draft || {}
    if (d.name     !== undefined) setName(d.name || '')
    if (d.emoji    !== undefined) setEmoji(d.emoji || '🏋️')
    if (d.workouts !== undefined) setWorkouts(normalizeWorkouts(d.workouts))
    if (d.rotation !== undefined) setRotation(Array.isArray(d.rotation) ? [...d.rotation] : [])
    // Batch 45 followup #2 — suppress banner for template-seeded drafts.
    // loadTemplate sets silent:true so the user doesn't see "Unsaved draft
    // restored" on first tap of a template (there's nothing to recover —
    // it's the template content from 2 seconds ago).
    if (!splitDraft.silent) setShowDraftBanner(true)
    // Banner is informational only at this point — Keep dismisses, Discard
    // reverts to the underlying split (or blank) and nulls the store draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced auto-save — only after the user has changed something.
  useEffect(() => {
    if (!isDirty) return
    const t = setTimeout(() => {
      setSplitDraft({
        originalId: isEditing ? id : null,
        draft: { name, emoji, workouts, rotation },
      })
    }, 500)
    return () => clearTimeout(t)
  }, [name, emoji, workouts, rotation, isDirty, isEditing, id, setSplitDraft])

  const markDirty = () => setIsDirty(true)

  // ── Workout ops ──────────────────────────────────────────────────────────
  const handleAddWorkout = () => {
    const w = {
      id: generateId(),
      name: 'New Workout',
      emoji: '🏋️',
      sections: [{ label: 'Exercises', exercises: [] }],
    }
    setWorkouts(prev => [...prev, w])
    markDirty()
    setIsNewSheet(true)
    setEditingWorkoutId(w.id)
  }

  const handleSaveWorkoutFromSheet = (updated) => {
    setWorkouts(prev => prev.map(w => w.id === updated.id ? updated : w))
    markDirty()
    setEditingWorkoutId(null)
    setIsNewSheet(false)
  }

  const handleCancelWorkoutSheet = () => {
    // If the sheet was opened as a new-workout flow AND nothing was saved,
    // pull the stub back out of workouts. Otherwise just close.
    if (isNewSheet && editingWorkoutId) {
      const stub = workouts.find(w => w.id === editingWorkoutId)
      const isEmpty = stub && stub.name === 'New Workout' &&
        (stub.sections || []).every(s => (s.exercises || []).length === 0)
      if (isEmpty) {
        setWorkouts(prev => prev.filter(w => w.id !== editingWorkoutId))
      }
    }
    setEditingWorkoutId(null)
    setIsNewSheet(false)
  }

  const handleMoveWorkout = (idx, dir) => {
    setWorkouts(prev => {
      const next = [...prev]
      const to = idx + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
    markDirty()
  }

  const handleDeleteWorkout = (workoutId) => {
    const target = workouts.find(w => w.id === workoutId)
    if (!target) return
    const priorWorkouts = workouts
    const priorRotation = rotation
    const rotRefsToStrip = rotation.filter(r => r === workoutId).length
    setWorkouts(prev => prev.filter(w => w.id !== workoutId))
    // Auto-prune rotation references to the deleted workout.
    setRotation(prev => prev.filter(r => r !== workoutId))
    markDirty()
    showToast({
      message: rotRefsToStrip > 0
        ? `Deleted "${target.name}" and ${rotRefsToStrip} rotation entr${rotRefsToStrip === 1 ? 'y' : 'ies'}`
        : `Deleted "${target.name}"`,
      undo: () => {
        setWorkouts(priorWorkouts)
        setRotation(priorRotation)
      },
    })
  }

  const handleDuplicateWorkout = (workoutId) => {
    const src = workouts.find(w => w.id === workoutId)
    if (!src) return
    const dup = {
      ...src,
      id: generateId(),
      name: `${src.name} (Copy)`,
      sections: (src.sections || []).map(sec => ({
        ...sec,
        exercises: (sec.exercises || []).map(ex => {
          if (typeof ex === 'string') return ex
          const copiedRec = ex.rec && typeof ex.rec === 'object' ? { ...ex.rec } : ex.rec
          return { ...ex, ...(copiedRec !== undefined ? { rec: copiedRec } : {}) }
        }),
      })),
    }
    const priorWorkouts = workouts
    setWorkouts(prev => [...prev, dup])
    markDirty()
    showToast({
      message: `Duplicated "${src.name}"`,
      undo: () => setWorkouts(priorWorkouts),
    })
  }

  // ── Rotation ops ─────────────────────────────────────────────────────────
  const handleAddRotation = (slot) => {
    setRotation(prev => [...prev, slot])
    markDirty()
  }

  const handleAssignRotation = (idx, slot) => {
    setRotation(prev => prev.map((r, i) => i === idx ? slot : r))
    markDirty()
    setRotationMenuIdx(null)
  }

  const handleRemoveRotation = (idx) => {
    setRotation(prev => prev.filter((_, i) => i !== idx))
    markDirty()
    setRotationMenuIdx(null)
  }

  const handleMoveRotation = (idx, dir) => {
    setRotation(prev => {
      const next = [...prev]
      const to = idx + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
    markDirty()
  }

  // ── Save + Back ──────────────────────────────────────────────────────────
  const canSave = name.trim().length > 0 && workouts.length > 0 && rotation.length > 0
  const saveHint = useMemo(() => {
    const missing = []
    if (name.trim().length === 0) missing.push('Add a name')
    if (workouts.length === 0) missing.push('Add at least one workout')
    if (rotation.length === 0) missing.push('Add to rotation')
    return missing.join(' · ')
  }, [name, workouts.length, rotation.length])

  const handleSave = () => {
    if (!canSave) return
    const splitData = {
      name: name.trim(),
      emoji,
      workouts,
      rotation,
      isBuiltIn: isEditing ? (existingSplit?.isBuiltIn ?? false) : false,
    }
    if (isEditing && existingSplit) {
      updateSplit(existingSplit.id, splitData)
      if (activateOnSave && activeSplitId !== existingSplit.id) setActiveSplit(existingSplit.id)
    } else {
      // Use addSplitWithLibrary so any HYROX-round / running / new
      // weight-training entries spawn library rows on save. Templates like
      // HYROX Hybrid rely on this to make the round logger + section
      // preview resolve once the split is active.
      const created = addSplitWithLibrary(splitData)
      if (activateOnSave && created?.id) setActiveSplit(created.id)
    }
    clearSplitDraft()
    navigate('/splits')
  }

  const handleBack = () => {
    if (isDirty) setShowDiscardModal(true)
    else navigate('/splits')
  }

  const handleDiscardAndLeave = () => {
    clearSplitDraft()
    navigate('/splits')
  }

  const handleDiscardDraftBanner = () => {
    if (isEditing && existingSplit) {
      setName(existingSplit.name)
      setEmoji(existingSplit.emoji)
      setWorkouts(normalizeWorkouts(existingSplit.workouts))
      setRotation([...(existingSplit.rotation || [])])
    } else {
      setName('')
      setEmoji('🏋️')
      setWorkouts([])
      setRotation([])
    }
    clearSplitDraft()
    setShowDraftBanner(false)
    setIsDirty(false)
  }

  const exportCurrent = () => {
    const payload = {
      type: 'bambam-split-export',
      version: 1,
      split: {
        name: name.trim() || 'Untitled',
        emoji,
        workouts,
        rotation,
        isBuiltIn: false,
      },
    }
    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `split-${(name.trim() || 'split').replace(/\s+/g, '-').toLowerCase()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setShowOverflow(false)
  }

  const handleDelete = () => {
    if (!existingSplit) return
    if (!window.confirm(`Delete "${existingSplit.name}"? Your workout history is not affected.`)) return
    deleteSplit(existingSplit.id)
    clearSplitDraft()
    navigate('/splits')
  }

  // ── Recent in this split (Step 10) ───────────────────────────────────────
  // Library entries that already appear in a SIBLING workout of the currently-
  // editing one. Resolution is name-based against canonical name + aliases so
  // renamed user-created entries still match. Passed to WorkoutEditSheet →
  // ExercisePicker so users can re-add common picks with one tap.
  const recentInSplit = useMemo(() => {
    if (!editingWorkoutId) return []
    const nameToEntry = new Map()
    for (const entry of exerciseLibrary || []) {
      const canonical = normalizeExerciseName(entry.name)
      if (canonical) nameToEntry.set(canonical, entry)
      for (const alias of entry.aliases || []) {
        const a = normalizeExerciseName(alias)
        if (a && !nameToEntry.has(a)) nameToEntry.set(a, entry)
      }
    }
    const seen = new Set()
    const out = []
    for (const w of workouts) {
      if (w.id === editingWorkoutId) continue
      for (const section of w.sections || []) {
        for (const ex of section.exercises || []) {
          const rawName = typeof ex === 'string' ? ex : ex?.name
          const key = normalizeExerciseName(rawName)
          if (!key) continue
          const entry = nameToEntry.get(key)
          if (!entry || seen.has(entry.id)) continue
          seen.add(entry.id)
          out.push(entry)
        }
      }
    }
    return out
  }, [editingWorkoutId, workouts, exerciseLibrary])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-40">
      <header
        className="sticky top-0 bg-base z-30 px-4 pb-3 border-b border-subtle"
        style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))' }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="flex-1 text-lg font-bold">
            {isEditing ? 'Edit Split' : 'New Split'}
          </h1>
          {isEditing && (
            <div className="relative">
              <button
                ref={overflowAnchorRef}
                type="button"
                onClick={() => setShowOverflow(v => !v)}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={showOverflow}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <circle cx="12" cy="5" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
              {showOverflow && (
                <OverflowMenu
                  isBuiltIn={existingSplit?.isBuiltIn}
                  onExport={exportCurrent}
                  onDelete={handleDelete}
                  onClose={() => setShowOverflow(false)}
                />
              )}
            </div>
          )}
        </div>
      </header>

      {showDraftBanner && splitDraft && (
        <div className="mx-4 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
          <span className="text-xl" aria-hidden="true">💾</span>
          <div className="flex-1 text-sm min-w-0">
            <div className="font-semibold text-amber-300">Unsaved draft restored</div>
            <div className="text-c-secondary text-xs truncate">
              Last saved {formatTimeAgo(splitDraft.updatedAt)}.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDraftBanner(false)}
            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={handleDiscardDraftBanner}
            className="px-3 py-1.5 text-xs font-semibold rounded-full bg-item text-c-muted border border-subtle shrink-0"
          >
            Discard
          </button>
        </div>
      )}

      {/* Batch 18c — compact identity hero. 64×64 tile inline with the name
          input. Pencil glyph overlays the tile's bottom-right as a subtle
          tap-to-edit cue. Saves ~80px above the fold vs the prior
          centered 80×80 stack. */}
      <section className="px-4 pt-5 pb-3 flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowEmojiPicker(true)}
          aria-label="Change emoji"
          className="relative w-16 h-16 rounded-2xl bg-card border border-subtle flex items-center justify-center text-4xl active:scale-95 transition-transform shrink-0"
        >
          {emoji}
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-item border border-base flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-c-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" />
            </svg>
          </span>
        </button>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); markDirty() }}
          placeholder="Untitled split"
          aria-label="Split name"
          className="flex-1 min-w-0 text-xl font-extrabold bg-transparent outline-none text-c-primary placeholder:text-c-faint"
        />
      </section>

      {/* Workouts section */}
      <SectionHeader
        label={`Workouts (${workouts.length})`}
        expanded={workoutsExpanded}
        onToggle={() => setWorkoutsExpanded(v => !v)}
      />
      {workoutsExpanded && (
        <div className="px-4 flex flex-col gap-2">
          {workouts.length === 0 && (
            <p className="text-sm text-c-muted italic px-1">No workouts yet. Add one to get started.</p>
          )}
          {workouts.map((w, idx) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              isFirst={idx === 0}
              isLast={idx === workouts.length - 1}
              onEdit={() => { setIsNewSheet(false); setEditingWorkoutId(w.id) }}
              onDuplicate={() => handleDuplicateWorkout(w.id)}
              onDelete={() => handleDeleteWorkout(w.id)}
              onMoveUp={() => handleMoveWorkout(idx, -1)}
              onMoveDown={() => handleMoveWorkout(idx, 1)}
            />
          ))}
          <button
            type="button"
            onClick={handleAddWorkout}
            className="w-full py-3 rounded-xl border-2 border-dashed border-subtle text-c-secondary hover:text-c-primary transition-colors text-sm font-semibold"
          >
            + Add workout
          </button>
        </div>
      )}

      {/* Rotation section. Batch 18c — CYCLE/WEEK toggle moves out of the
          header into its own right-aligned row below, so the header has
          room to breathe. Add-to-rotation pills are wrapped in a labeled
          uppercase block so their purpose is clear. */}
      <SectionHeader
        label="Your Week"
        expanded={rotationExpanded}
        onToggle={() => setRotationExpanded(v => !v)}
      />
      {rotationExpanded && (
        <div className="px-4 pb-6">
          <div className="flex items-center justify-end mb-3">
            <RotationViewToggle value={rotationView} onChange={setRotationView} />
          </div>
          {rotation.length === 0 && (
            <p className="text-sm text-c-muted italic mb-3">
              No rotation yet. Add workouts or rest days in the order you want to train them.
            </p>
          )}
          {rotationView === 'cycle' ? (
            <RotationCycleStrip
              rotation={rotation}
              workouts={workouts}
              onChipTap={(idx) => setRotationMenuIdx(idx)}
              onMove={handleMoveRotation}
            />
          ) : (
            <RotationWeekGrid
              rotation={rotation}
              workouts={workouts}
              onChipTap={(idx) => setRotationMenuIdx(idx)}
            />
          )}

          {/* Add-to-rotation controls, now labeled. */}
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-c-muted mb-2">Add to rotation</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddRotation('rest')}
                className="flex items-center gap-1.5 bg-slate-500/20 text-c-secondary text-sm px-3 py-2 rounded-xl font-medium hover:bg-slate-500/30 border border-slate-500/30 transition-colors"
              >
                <RestDayChip size={18} />
                <span>Rest day</span>
              </button>
              {workouts.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleAddRotation(w.id)}
                  className="flex items-center gap-1.5 bg-item text-c-secondary text-sm px-3 py-2 rounded-xl font-medium hover:bg-card transition-colors"
                >
                  <span>{w.emoji}</span>
                  <span className="max-w-[120px] truncate">{w.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sticky save footer. Batch 18c — activate-on-save toggle elevated into
          its own pill-chrome card above the Save button so it reads as part
          of the save action. Save button uses saveTheme (red accent falls
          back to emerald). */}
      <footer
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 pt-3 bg-base/95 backdrop-blur-sm border-t border-subtle"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <div className="bg-card border border-subtle rounded-2xl p-3 flex flex-col gap-3">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setActivateOnSave(v => !v)}
              aria-pressed={activateOnSave}
              className="flex items-center gap-3 text-left"
            >
              <div className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${activateOnSave ? saveTheme.bg : 'bg-item'}`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${activateOnSave ? 'right-0.5' : 'left-0.5'}`} />
              </div>
              <span className="flex-1 text-sm font-semibold text-c-primary">Activate on save</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-4 rounded-xl font-bold text-base transition-all disabled:opacity-40 ${saveTheme.bg}`}
            style={{ color: saveTheme.contrastText }}
          >
            {isEditing ? 'Save' : (activateOnSave ? 'Save & Activate' : 'Save')}
          </button>
        </div>
        {!canSave && saveHint && (
          <div className="text-center text-xs text-c-muted mt-2">{saveHint}</div>
        )}
      </footer>

      {editingWorkoutId && (
        <WorkoutEditSheet
          workout={workouts.find(w => w.id === editingWorkoutId)}
          isNew={isNewSheet}
          onSave={handleSaveWorkoutFromSheet}
          onClose={handleCancelWorkoutSheet}
          recentInSplit={recentInSplit}
        />
      )}

      {showEmojiPicker && (
        <EmojiPicker
          current={emoji}
          onSelect={(em) => { setEmoji(em); markDirty(); setShowEmojiPicker(false) }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {rotationMenuIdx !== null && (
        <RotationChipMenu
          idx={rotationMenuIdx}
          current={rotation[rotationMenuIdx]}
          workouts={workouts}
          onAssign={(slot) => handleAssignRotation(rotationMenuIdx, slot)}
          onRemove={() => handleRemoveRotation(rotationMenuIdx)}
          onClose={() => setRotationMenuIdx(null)}
          theme={theme}
        />
      )}

      {showDiscardModal && (
        <DiscardUnsavedModal
          onDiscard={handleDiscardAndLeave}
          onKeep={() => setShowDiscardModal(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ label, expanded, onToggle, extraRight = null }) {
  return (
    <div className="px-4 py-3 flex items-center gap-2 border-t border-subtle">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-center gap-2 flex-1 text-left"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''} text-c-muted`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <h2 className="text-xs font-bold uppercase tracking-wide text-c-secondary">{label}</h2>
      </button>
      {extraRight}
    </div>
  )
}

// Batch 18c — compact WorkoutCard. The up/down chevron column is gone; reorder
// folds into the ⋯ menu (Move Up / Move Down, disabled for first/last).
// Batch 18f — the decorative DragHandle glyph on the left was removed because
// real drag-and-drop isn't wired yet; it suggested an interaction that didn't
// exist. Reordering goes through the ⋯ menu.
function WorkoutCard({ workout, isFirst, isLast, onEdit, onDuplicate, onDelete, onMoveUp, onMoveDown }) {
  const previewText = useMemo(() => {
    const all = (workout.sections || []).flatMap(s =>
      (s.exercises || []).map(ex => typeof ex === 'string' ? ex : ex.name).filter(Boolean)
    )
    if (all.length === 0) return 'No exercises yet'
    return `${all.length} exercise${all.length === 1 ? '' : 's'}`
  }, [workout.sections])

  // Batch 18e — the ⋯ trigger + popover now come from the shared
  // <RowOverflowMenu />. Move up/down items filter out at list boundaries
  // via null onSelect.
  return (
    <div className="bg-card rounded-2xl border border-subtle p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 min-w-0 text-left flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-item flex items-center justify-center text-2xl shrink-0">
          {workout.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-c-primary leading-tight truncate">{workout.name}</p>
          <p className="text-xs text-c-muted mt-0.5 truncate">{previewText}</p>
        </div>
      </button>
      <RowOverflowMenu
        ariaLabel={`More actions for ${workout.name}`}
        items={[
          { label: 'Edit',      onSelect: onEdit },
          { label: 'Duplicate', onSelect: onDuplicate },
          { label: 'Move up',   onSelect: isFirst ? null : onMoveUp },
          { label: 'Move down', onSelect: isLast  ? null : onMoveDown },
          { label: 'Delete',    onSelect: onDelete, destructive: true },
        ]}
      />
    </div>
  )
}

function RotationViewToggle({ value, onChange }) {
  return (
    <div className="flex bg-item rounded-full p-0.5 text-[10px]">
      {['cycle', 'week'].map(v => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`px-2.5 py-1 rounded-full font-semibold uppercase tracking-wide transition-all ${
            value === v ? 'bg-card text-c-primary' : 'text-c-muted'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

function RotationCycleStrip({ rotation, workouts, onChipTap, onMove }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
      <div className="flex items-center gap-2 py-1">
        {rotation.map((slot, idx) => {
          const isRest = slot === 'rest'
          const w = !isRest ? workouts.find(wk => wk.id === slot) : null
          return (
            <div key={idx} className="shrink-0 flex flex-col items-center gap-1">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onMove(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move day ${idx + 1} earlier`}
                  className="p-0.5 text-c-muted disabled:opacity-20"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => onMove(idx, 1)}
                  disabled={idx === rotation.length - 1}
                  aria-label={`Move day ${idx + 1} later`}
                  className="p-0.5 text-c-muted disabled:opacity-20"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChipTap(idx)}
                aria-label={isRest ? `Day ${idx + 1}, Rest day` : `Day ${idx + 1}, ${w?.name || 'Unassigned'}`}
                className="w-16 h-20 rounded-xl bg-card border border-subtle flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
              >
                <span className="text-[10px] text-c-muted font-semibold">D{idx + 1}</span>
                {isRest
                  ? <RestDayChip size={28} />
                  : w
                    ? <span className="text-2xl" aria-hidden="true">{w.emoji}</span>
                    : <span className="text-2xl text-c-faint" aria-hidden="true">?</span>}
              </button>
            </div>
          )
        })}
        {rotation.length > 0 && (
          <div className="shrink-0 text-c-muted text-xs pl-1 self-center" aria-hidden="true">↻ loops</div>
        )}
      </div>
    </div>
  )
}

function RotationWeekGrid({ rotation, workouts, onChipTap }) {
  if (rotation.length > 0 && rotation.length !== 7) {
    return (
      <div className="bg-item rounded-xl p-3 text-sm text-c-secondary">
        Your rotation cycles every {rotation.length} day{rotation.length === 1 ? '' : 's'}. Switch to Cycle view to see the full pattern.
      </div>
    )
  }
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {dayLabels.map((d, i) => (
        <div key={`l-${i}`} className="text-[10px] text-c-muted text-center font-semibold">{d}</div>
      ))}
      {dayLabels.map((_, idx) => {
        const slot = rotation[idx]
        if (!slot) {
          return (
            <div
              key={`d-${idx}`}
              className="aspect-square rounded-xl border border-dashed border-subtle flex flex-col items-center justify-center gap-0.5"
            >
              <span className="text-c-faint text-lg" aria-hidden="true">+</span>
              <span className="text-[9px] text-c-faint">Assign</span>
            </div>
          )
        }
        const isRest = slot === 'rest'
        const w = !isRest ? workouts.find(wk => wk.id === slot) : null
        return (
          <button
            key={`d-${idx}`}
            type="button"
            onClick={() => onChipTap(idx)}
            aria-label={isRest ? `${dayLabels[idx]}, Rest day` : `${dayLabels[idx]}, ${w?.name || 'Unassigned'}`}
            className="aspect-square rounded-xl bg-card border border-subtle flex items-center justify-center active:scale-95 transition-transform"
          >
            {isRest
              ? <RestDayChip size={26} />
              : w
                ? <span className="text-xl" aria-hidden="true">{w.emoji}</span>
                : <span className="text-c-faint text-lg" aria-hidden="true">?</span>}
          </button>
        )
      })}
    </div>
  )
}

function RotationChipMenu({ idx, current, workouts, onAssign, onRemove, onClose, theme }) {
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 250 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Day ${idx + 1} options`}
        className="relative bg-card rounded-t-2xl w-full max-w-lg max-h-[70vh] overflow-auto p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center mb-3">
          <p className="text-sm font-bold text-c-primary flex-1">Day {idx + 1}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-c-dim"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-c-muted uppercase tracking-wide mb-2">Assign a workout</p>
        <div className="flex flex-col gap-1 mb-3">
          {workouts.map(w => {
            const isCurrent = current === w.id
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => onAssign(w.id)}
                className={`w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-left ${
                  isCurrent ? `${theme.bgSubtle}` : 'hover:bg-item'
                }`}
              >
                <span className="text-xl">{w.emoji}</span>
                <span className="flex-1 text-sm font-medium truncate">{w.name}</span>
                {isCurrent && <span className="text-xs text-c-muted shrink-0">Current</span>}
              </button>
            )
          })}
        </div>
        <div className="border-t border-subtle pt-3 mb-3">
          <button
            type="button"
            onClick={() => onAssign('rest')}
            className={`w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-left ${
              current === 'rest' ? 'bg-item' : 'hover:bg-item'
            }`}
          >
            <RestDayChip size={24} />
            <span className="flex-1 text-sm font-medium text-c-secondary">Rest day</span>
            {current === 'rest' && <span className="text-xs text-c-muted shrink-0">Current</span>}
          </button>
        </div>
        <div className="border-t border-subtle pt-3">
          <button
            type="button"
            onClick={onRemove}
            className="w-full px-3 py-2.5 rounded-lg flex items-center gap-2 text-left text-red-400 hover:bg-red-500/10"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="flex-1 text-sm font-medium">Remove from rotation</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function DiscardUnsavedModal({ onDiscard, onKeep }) {
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center px-5"
      style={{ zIndex: 280 }}
      onClick={onKeep}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Discard unsaved changes?"
        className="relative bg-card rounded-2xl p-5 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-bold text-lg mb-1">Discard changes?</p>
        <p className="text-sm text-c-secondary mb-4">
          Your draft is saved automatically, so you can come back later. Discard clears it for good.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onKeep}
            className="flex-1 py-2.5 rounded-lg bg-item text-c-primary font-semibold text-sm"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 font-semibold text-sm"
          >
            Discard
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function OverflowMenu({ isBuiltIn, onExport, onDelete, onClose }) {
  useEffect(() => {
    const onDocDown = (e) => { if (!e.target.closest('[data-split-overflow]')) onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDocDown)
      document.addEventListener('touchstart', onDocDown)
    }, 0)
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      data-split-overflow
      role="menu"
      className="absolute right-0 top-11 bg-card border border-subtle rounded-xl p-1 shadow-xl z-20 min-w-[160px]"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => { onExport(); onClose() }}
        className="w-full px-3 py-2.5 text-sm text-left text-c-primary rounded-lg hover:bg-item"
      >
        Export
      </button>
      {!isBuiltIn && (
        <button
          type="button"
          role="menuitem"
          onClick={() => { onDelete(); onClose() }}
          className="w-full px-3 py-2.5 text-sm text-left text-red-400 rounded-lg hover:bg-red-500/10"
        >
          Delete split
        </button>
      )}
    </div>
  )
}
