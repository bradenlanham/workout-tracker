import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../store/useStore'
import { getTheme, getSaveTheme } from '../theme'
import { normalizeExerciseEntry } from '../utils/helpers'
import EmojiPicker from './EmojiPicker'
import RecPill from './RecPill'
import RecEditor from './RecEditor'
import ExercisePicker from './ExercisePicker'
import DragHandle from './DragHandle'
import RowOverflowMenu from './RowOverflowMenu'

// Batch 17g — WorkoutEditSheet (Step 8 of the Split Builder redesign).
// Bottom-sheet editor for a single workout — swaps out the legacy wizard's
// WorkoutBuilder view-swap. Section labels are editable (fixes F8); sections
// can be added, reordered (via move-up/down buttons — full drag lands later),
// and deleted with confirm.
//
// z-index 270 per the global stack. EmojiPicker + ExercisePicker nest above
// (270 too, stacked via DOM order since they mount later). CreateExerciseModal
// still uses its own portal at z-260; we lift ours above it here so the
// picker can nest cleanly.
//
// REC editor is a simple string input for now — structured REC lands in
// Step 9. The pill displays whatever shape is passed through.

export default function WorkoutEditSheet({ workout, onClose, onSave, isNew = false, recentInSplit = [] }) {
  const settings = useStore(s => s.settings)
  const theme = getTheme(settings.accentColor)
  // Batch 18e — Save button uses the shared getSaveTheme() helper so the
  // red→emerald fallback lives in one place. See theme.js.
  const saveTheme = getSaveTheme(settings.accentColor)

  // Normalize incoming sections so string/object exercises both work. We
  // preserve the original shape on save — strings stay strings unless the
  // user sets a rec on them (which promotes to {name, rec}).
  // Batch 18a — normalization delegates to the lossless `normalizeExerciseEntry`
  // helper so we stop silently dropping entries whose shape drifted from the
  // Batch 17g string-or-`{name}` contract.
  const [name, setName] = useState(workout?.name || 'New Workout')
  const [emoji, setEmoji] = useState(workout?.emoji || '🏋️')
  const [sections, setSections] = useState(() =>
    (workout?.sections?.length
      ? workout.sections
      : [{ label: 'Exercises', exercises: [] }]
    ).map(s => ({
      label: s.label || 'Exercises',
      exercises: (s.exercises || []).map(normalizeExerciseEntry).filter(Boolean),
    }))
  )
  const [isDirty, setIsDirty] = useState(false)

  const [showEmoji, setShowEmoji] = useState(false)
  const [pickerSectionIdx, setPickerSectionIdx] = useState(null)
  const [editingRec, setEditingRec] = useState(null)   // { sectionIdx, exIdx }
  const [showDiscard, setShowDiscard] = useState(false)

  const markDirty = () => setIsDirty(true)

  // Section CRUD
  const updateSectionLabel = (idx, label) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, label } : s))
    markDirty()
  }
  const addSection = () => {
    setSections(prev => [...prev, { label: 'New section', exercises: [] }])
    markDirty()
  }
  const removeSection = (idx) => {
    const sec = sections[idx]
    if (sec.exercises.length > 0) {
      if (!window.confirm(`Delete "${sec.label}" and its ${sec.exercises.length} exercise${sec.exercises.length === 1 ? '' : 's'}?`)) return
    }
    setSections(prev => prev.filter((_, i) => i !== idx))
    markDirty()
  }
  const moveSection = (idx, dir) => {
    setSections(prev => {
      const next = [...prev]
      const to = idx + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
    markDirty()
  }

  // Exercise CRUD within a section
  const addExercise = (sectionIdx, exerciseName) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, exercises: [...s.exercises, exerciseName] }
        : s
    ))
    markDirty()
  }
  const removeExercise = (sectionIdx, exIdx) => {
    setSections(prev => prev.map((s, i) =>
      i === sectionIdx
        ? { ...s, exercises: s.exercises.filter((_, ei) => ei !== exIdx) }
        : s
    ))
    markDirty()
  }
  const moveExercise = (sectionIdx, exIdx, dir) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s
      const next = [...s.exercises]
      const to = exIdx + dir
      if (to < 0 || to >= next.length) return s
      ;[next[exIdx], next[to]] = [next[to], next[exIdx]]
      return { ...s, exercises: next }
    }))
    markDirty()
  }
  // Batch 17h — accepts any shape `formatRec` understands: null, string, or
  // structured object. Null clears the rec and promotes the exercise back
  // to a bare string so the exercises array stays small for unset recs.
  const updateExerciseRec = (sectionIdx, exIdx, recValue) => {
    setSections(prev => prev.map((s, i) => {
      if (i !== sectionIdx) return s
      return {
        ...s,
        exercises: s.exercises.map((ex, ei) => {
          if (ei !== exIdx) return ex
          const nm = typeof ex === 'string' ? ex : ex.name
          if (recValue === null || recValue === undefined || recValue === '') return nm
          // String values preserve legacy behavior; object values pass through
          // as long as they produce a non-empty formatted output (the editor
          // already collapses all-empty to null before calling this).
          return { name: nm, rec: recValue }
        }),
      }
    }))
    markDirty()
  }

  const canSave = name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      ...(workout || {}),
      name: name.trim(),
      emoji,
      sections,
    })
  }

  const handleClose = () => {
    if (isDirty) setShowDiscard(true)
    else onClose()
  }

  // Sheet content uses a portal so it layers above the Canvas reliably.
  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 270 }}
    >
      <div className="absolute inset-0 bg-black/50 touch-none" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit workout"
        className="relative bg-card rounded-t-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Drag handle + header — decorative only per Batch 18a. Gets
            pointer-events:none so a stray swipe doesn't hijack the gesture. */}
        <div className="pt-2 pb-1 flex justify-center shrink-0 pointer-events-none">
          <div className="w-10 h-1 rounded-full bg-white/20" aria-hidden="true" />
        </div>
        <div className="px-4 pb-3 flex items-center gap-2 border-b border-subtle shrink-0">
          <span className="text-sm font-bold text-c-primary flex-1">
            {isNew ? 'Add workout' : 'Edit workout'}
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-1.5 text-sm font-semibold text-c-secondary"
          >
            {isDirty ? 'Cancel' : 'Close'}
          </button>
        </div>

        {/* Identity row */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-subtle shrink-0">
          <button
            type="button"
            onClick={() => setShowEmoji(true)}
            aria-label="Change emoji"
            className="w-14 h-14 rounded-xl bg-item flex items-center justify-center text-3xl active:scale-95 shrink-0"
          >
            {emoji}
          </button>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); markDirty() }}
            placeholder="Workout name"
            className="flex-1 bg-transparent outline-none text-lg font-bold text-c-primary placeholder:text-c-faint min-w-0"
            aria-label="Workout name"
          />
        </div>

        {/* Scrollable sections. Batch 18d — bg-base tint contrasts against
            each SectionBlock's bg-card so cards read without outer borders. */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-base"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {sections.map((sec, sIdx) => (
            <SectionBlock
              key={sIdx}
              section={sec}
              idx={sIdx}
              isFirst={sIdx === 0}
              isLast={sIdx === sections.length - 1}
              onLabelChange={(label) => updateSectionLabel(sIdx, label)}
              onDelete={() => removeSection(sIdx)}
              onMoveUp={() => moveSection(sIdx, -1)}
              onMoveDown={() => moveSection(sIdx, 1)}
              onAddExercise={() => setPickerSectionIdx(sIdx)}
              onRemoveExercise={(exIdx) => removeExercise(sIdx, exIdx)}
              onMoveExercise={(exIdx, dir) => moveExercise(sIdx, exIdx, dir)}
              onEditRec={(exIdx) => setEditingRec({ sectionIdx: sIdx, exIdx })}
            />
          ))}
          <button
            type="button"
            onClick={addSection}
            className="w-full py-3 rounded-xl border-2 border-dashed border-subtle text-c-secondary hover:text-c-primary transition-colors text-sm font-semibold"
          >
            + Add section
          </button>
        </div>

        {/* Save footer */}
        <div className="p-4 border-t border-subtle shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-3 rounded-xl font-bold text-base transition-all disabled:opacity-40 ${saveTheme.bg}`}
            style={{ color: saveTheme.contrastText }}
          >
            Save workout
          </button>
        </div>
      </div>

      {showEmoji && (
        <EmojiPicker
          current={emoji}
          onSelect={(em) => { setEmoji(em); markDirty(); setShowEmoji(false) }}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {pickerSectionIdx !== null && (
        <ExercisePicker
          addedExercises={sections[pickerSectionIdx]?.exercises || []}
          recentInSplit={recentInSplit}
          onAdd={(exName) => addExercise(pickerSectionIdx, exName)}
          onClose={() => setPickerSectionIdx(null)}
          theme={theme}
        />
      )}

      {editingRec && (
        <RecEditor
          current={(() => {
            const ex = sections[editingRec.sectionIdx]?.exercises[editingRec.exIdx]
            if (!ex || typeof ex === 'string') return null
            return ex.rec ?? null
          })()}
          onSave={(nextRec) => {
            updateExerciseRec(editingRec.sectionIdx, editingRec.exIdx, nextRec)
            setEditingRec(null)
          }}
          onClose={() => setEditingRec(null)}
        />
      )}

      {showDiscard && (
        <DiscardConfirm
          onDiscard={() => { setShowDiscard(false); onClose() }}
          onCancel={() => setShowDiscard(false)}
        />
      )}
    </div>,
    document.body
  )
}

// ── SectionBlock ────────────────────────────────────────────────────────────

// Batch 18d — compact SectionBlock. Header was FIVE controls (up / down /
// label input / collapse / delete); now: drag-handle + label input +
// collapse chevron + ⋯ overflow (Move up / Move down / Delete). Each
// exercise row was FIVE (up / down / name / rec / ×); now THREE:
// drag-handle + name (tap to edit rec) + rec pill + ⋯ (Move up / Move
// down / Remove). One border per card: bg-card rounded-xl overflow-hidden,
// header tinted via bg-item (no border-bottom), outer border removed —
// the scroll region's bg-base tint gives cards contrast without chrome.
function SectionBlock({
  section, idx, isFirst, isLast,
  onLabelChange, onDelete, onMoveUp, onMoveDown,
  onAddExercise, onRemoveExercise, onMoveExercise, onEditRec,
}) {
  const [label, setLabel] = useState(section.label)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => { setLabel(section.label) }, [section.label])

  return (
    <div className="bg-card rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2 bg-item">
        <DragHandle />
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={() => { if (label !== section.label) onLabelChange(label) }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="flex-1 bg-transparent outline-none text-sm font-semibold text-c-primary min-w-0 placeholder:text-c-muted"
          aria-label="Section label"
          placeholder="Section name"
        />
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand section' : 'Collapse section'}
          className="w-8 h-8 flex items-center justify-center text-c-muted hover:bg-card rounded-lg"
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <RowOverflowMenu
          ariaLabel="Section actions"
          anchorClass="hover:bg-card"
          items={[
            ...(isFirst ? [] : [{ label: 'Move up',   onSelect: onMoveUp   }]),
            ...(isLast  ? [] : [{ label: 'Move down', onSelect: onMoveDown }]),
            { label: 'Delete', destructive: true, onSelect: onDelete },
          ]}
        />
      </div>

      {!collapsed && (
        <div className="p-2 flex flex-col gap-0.5">
          {section.exercises.length === 0 && (
            <div className="px-3 py-2 text-xs text-c-muted italic">No exercises yet.</div>
          )}
          {section.exercises.map((ex, exIdx) => {
            const nm = typeof ex === 'string' ? ex : ex.name
            const rec = typeof ex === 'string' ? null : ex.rec
            return (
              <div
                key={exIdx}
                className="pl-2 pr-1 py-2 flex items-center gap-2 rounded-lg hover:bg-item"
              >
                <DragHandle />
                <button
                  type="button"
                  onClick={() => onEditRec(exIdx)}
                  className="flex-1 text-left text-sm text-c-primary truncate min-w-0 py-0.5"
                  aria-label={`${nm}, edit rec`}
                >
                  {nm}
                </button>
                <RecPill rec={rec} onTap={() => onEditRec(exIdx)} />
                <RowOverflowMenu
                  ariaLabel={`Actions for ${nm}`}
                  anchorClass="hover:bg-card"
                  items={[
                    ...(exIdx === 0 ? [] : [{ label: 'Move up',   onSelect: () => onMoveExercise(exIdx, -1) }]),
                    ...(exIdx === section.exercises.length - 1 ? [] : [{ label: 'Move down', onSelect: () => onMoveExercise(exIdx, 1) }]),
                    { label: 'Remove', destructive: true, onSelect: () => onRemoveExercise(exIdx) },
                  ]}
                />
              </div>
            )
          })}
          <button
            type="button"
            onClick={onAddExercise}
            className="mt-2 w-full py-2.5 rounded-lg border border-dashed border-subtle text-c-secondary hover:text-c-primary transition-colors text-sm font-semibold"
          >
            + Add exercise
          </button>
        </div>
      )}
    </div>
  )
}

// ── DiscardConfirm ──────────────────────────────────────────────────────────

function DiscardConfirm({ onDiscard, onCancel }) {
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center px-5"
      style={{ zIndex: 280 }}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Discard changes?"
        className="relative bg-card rounded-2xl p-5 w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <p className="font-bold text-lg mb-1">Discard changes?</p>
        <p className="text-sm text-c-secondary mb-4">
          Your edits to this workout won't be saved.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
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

