import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { EXERCISE_LIBRARY, MUSCLE_GROUPS } from '../data/exerciseLibrary'
import { generateId } from '../utils/helpers'

const FITNESS_EMOJIS = ['🏋️','💪','🦵','🏃','🔥','⚡','🎯','💎','🏆','👊','🦾','🧘','🏊','🚴']
const DEFAULT_SECTION_LABELS = ['Primary', 'Choose 1', 'If You Have Time']

// ── Shared: Back Button ────────────────────────────────────────────────────────

function BackBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  )
}

// ── Shared: Emoji Picker ───────────────────────────────────────────────────────

function EmojiPicker({ value, onChange, ringClass }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {FITNESS_EMOJIS.map(em => (
        <button
          key={em}
          onClick={() => onChange(em)}
          className={`text-2xl w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            value === em
              ? `bg-item ring-2 ${ringClass}`
              : 'bg-item opacity-60 hover:opacity-100'
          }`}
        >
          {em}
        </button>
      ))}
    </div>
  )
}

// ── Exercise Picker (full-screen overlay) ──────────────────────────────────────

function ExercisePicker({ addedExercises, onAdd, onClose, theme }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [customInput, setCustomInput] = useState('')

  const tabs = ['All', ...MUSCLE_GROUPS]

  const filtered = EXERCISE_LIBRARY.filter(ex => {
    const matchTab = tab === 'All' || ex.muscleGroup === tab
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const handleAddCustom = () => {
    const name = customInput.trim()
    if (!name) return
    onAdd(name)
    setCustomInput('')
  }

  return (
    <div className="fixed inset-0 bg-base z-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 pb-3 shrink-0" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onClose}
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
      </div>

      {/* Muscle group tabs */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === t ? `${theme.bg} ${theme.textOnBg}` : 'bg-item text-c-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
        {filtered.length === 0 && (
          <p className="text-center text-c-muted text-sm py-8">No exercises found</p>
        )}
        {filtered.map(ex => {
          const added = addedExercises.includes(ex.name)
          return (
            <button
              key={ex.name}
              onClick={() => { if (!added) onAdd(ex.name) }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors ${
                added ? 'bg-item opacity-50 cursor-default' : 'bg-item hover:bg-hover'
              }`}
            >
              <div>
                <p className="text-sm font-medium">{ex.name}</p>
                <p className="text-xs text-c-muted">{ex.muscleGroup} · {ex.equipment}</p>
              </div>
              {added ? (
                <svg className={`w-5 h-5 ${theme.text} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-c-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          )
        })}

        {/* Custom exercise */}
        <div className="pt-4">
          <p className="text-xs text-c-muted mb-2 px-1">Not in the list? Add your own:</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Exercise name…"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              className="flex-1 bg-card rounded-xl px-4 py-3 text-sm outline-none placeholder:text-c-muted"
            />
            <button
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className={`px-4 py-3 rounded-xl font-semibold text-sm ${theme.textOnBg} disabled:opacity-40 ${theme.bg}`}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Workout Builder ────────────────────────────────────────────────────────────

function WorkoutBuilder({ workout, onSave, onBack, theme }) {
  const { sessions } = useStore()
  const [name, setName] = useState(workout?.name || '')
  const [emoji, setEmoji] = useState(workout?.emoji || '💪')
  const [sections, setSections] = useState(
    workout?.sections?.length
      ? workout.sections.map(s => ({
          ...s,
          // Normalize exercises to strings — imported workouts may have {name, note} objects
          exercises: (s.exercises || []).map(ex =>
            typeof ex === 'string' ? ex : (ex?.name || '')
          ).filter(Boolean),
        }))
      : DEFAULT_SECTION_LABELS.map(label => ({ label, exercises: [] }))
  )
  const [pickerSection, setPickerSection] = useState(null)
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionLabel, setNewSectionLabel] = useState('')

  const allAdded = sections.flatMap(s => s.exercises)

  // Check if any logged session has notes for a given exercise name
  const hasSessionNotes = (exName) =>
    sessions.some(s => s.data?.exercises?.some(e => e.name === exName && e.notes?.trim()))

  const moveExercise = (sIdx, eIdx, dir) => {
    setSections(prev => {
      const secs = prev.map(s => ({ ...s, exercises: [...s.exercises] }))
      const exs = secs[sIdx].exercises
      const to = eIdx + dir
      if (to < 0 || to >= exs.length) return prev
      ;[exs[eIdx], exs[to]] = [exs[to], exs[eIdx]]
      return secs
    })
  }

  const removeExercise = (sIdx, eIdx) => {
    setSections(prev => prev.map((s, i) =>
      i === sIdx ? { ...s, exercises: s.exercises.filter((_, j) => j !== eIdx) } : s
    ))
  }

  const addExercise = (sIdx, exName) => {
    setSections(prev => prev.map((s, i) =>
      i === sIdx ? { ...s, exercises: [...s.exercises, exName] } : s
    ))
  }

  const renameSection = (sIdx, label) => {
    setSections(prev => prev.map((s, i) => i === sIdx ? { ...s, label } : s))
  }

  const removeSection = (sIdx) => {
    setSections(prev => prev.filter((_, i) => i !== sIdx))
  }

  const handleAddSection = () => {
    const label = newSectionLabel.trim() || `Section ${sections.length + 1}`
    setSections(prev => [...prev, { label, exercises: [] }])
    setNewSectionLabel('')
    setAddingSection(false)
  }

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      ...(workout || {}),
      id: workout?.id || generateId(),
      name: name.trim(),
      emoji,
      sections,
    })
  }

  return (
    <>
      <div className="min-h-screen pb-36 animate-slide-in">
        <div
          className="sticky top-0 bg-base z-30 px-4 pb-4"
          style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
        >
          <div className="flex items-center gap-3 mb-1">
            <BackBtn onClick={onBack} />
            <div>
              <h1 className="text-2xl font-bold">{workout?.id ? 'Edit Workout' : 'New Workout'}</h1>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-c-muted uppercase tracking-wide">Workout Name</label>
            <input
              type="text"
              placeholder="e.g. Push — Chest"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              className="mt-2 w-full bg-card rounded-xl px-4 py-3 text-base outline-none placeholder:text-c-muted"
            />
          </div>

          {/* Emoji */}
          <div>
            <label className="text-xs font-semibold text-c-muted uppercase tracking-wide">Emoji</label>
            <EmojiPicker value={emoji} onChange={setEmoji} ringClass={theme.ring} />
          </div>

          {/* Sections */}
          <div>
            <label className="text-xs font-semibold text-c-muted uppercase tracking-wide mb-3 block">Exercises</label>
            <div className="space-y-3">
              {sections.map((sec, sIdx) => (
                <div key={sIdx} className="bg-card rounded-2xl p-4">
                  {/* Section header */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={sec.label}
                      onChange={e => renameSection(sIdx, e.target.value)}
                      className="flex-1 bg-transparent font-bold text-sm outline-none min-w-0"
                    />
                    <button
                      onClick={() => setPickerSection(sIdx)}
                      className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg ${theme.bgSubtle} ${theme.text}`}
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => removeSection(sIdx)}
                      className="text-c-muted hover:text-red-400 transition-colors shrink-0 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {sec.exercises.length === 0 && (
                    <p className="text-xs text-c-faint text-center py-2">No exercises — tap + Add</p>
                  )}

                  <div className="space-y-1">
                    {sec.exercises.map((exName, eIdx) => (
                      <div key={eIdx} className="flex items-center gap-2 bg-item rounded-xl px-3 py-2.5">
                        <span className="flex-1 text-sm min-w-0">{exName}</span>
                        {hasSessionNotes(exName) && (
                          <span title="Has notes from previous sessions" className="text-sm leading-none opacity-60">ℹ️</span>
                        )}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => moveExercise(sIdx, eIdx, -1)}
                            disabled={eIdx === 0}
                            className="p-1.5 text-c-muted disabled:opacity-20"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveExercise(sIdx, eIdx, 1)}
                            disabled={eIdx === sec.exercises.length - 1}
                            className="p-1.5 text-c-muted disabled:opacity-20"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeExercise(sIdx, eIdx)}
                            className="p-1.5 text-red-400/70 hover:text-red-400"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add section */}
            {addingSection ? (
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  placeholder="Section name…"
                  value={newSectionLabel}
                  onChange={e => setNewSectionLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                  autoFocus
                  className="flex-1 bg-card rounded-xl px-4 py-3 text-sm outline-none placeholder:text-c-muted"
                />
                <button
                  onClick={handleAddSection}
                  className={`px-4 py-3 rounded-xl font-semibold text-sm ${theme.textOnBg} ${theme.bg}`}
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingSection(false); setNewSectionLabel('') }}
                  className="px-4 py-3 rounded-xl font-semibold text-sm bg-item text-c-secondary"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingSection(true)}
                className="w-full mt-3 py-3 rounded-xl border border-dashed border-c-base text-c-dim font-semibold text-sm"
              >
                + Add Section
              </button>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className={`w-full py-4 rounded-2xl font-bold ${theme.textOnBg} text-base transition-all disabled:opacity-40 ${theme.bg}`}
          >
            Save Workout
          </button>
        </div>
      </div>

      {pickerSection !== null && (
        <ExercisePicker
          addedExercises={allAdded}
          onAdd={exName => addExercise(pickerSection, exName)}
          onClose={() => setPickerSection(null)}
          theme={theme}
        />
      )}
    </>
  )
}

// ── Step 1: Name Your Split ────────────────────────────────────────────────────

function Step1({ name, setName, emoji, setEmoji, onBack, onContinue, theme }) {
  return (
    <div className="min-h-screen pb-36">
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <BackBtn onClick={onBack} />
          <div>
            <p className="text-xs text-c-muted font-semibold uppercase tracking-wide">Step 1 of 4</p>
            <h1 className="text-2xl font-bold">Name Your Split</h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-5">
        <div>
          <label className="text-xs font-semibold text-c-muted uppercase tracking-wide">Split Name</label>
          <input
            type="text"
            placeholder="e.g. Push Pull Legs"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            className="mt-2 w-full bg-card rounded-xl px-4 py-3 text-base outline-none placeholder:text-c-muted"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-c-muted uppercase tracking-wide">Pick an Emoji</label>
          <EmojiPicker value={emoji} onChange={setEmoji} ringClass={theme.ring} />
        </div>

        <button
          onClick={onContinue}
          disabled={!name.trim()}
          className={`w-full py-4 rounded-2xl font-bold ${theme.textOnBg} text-base transition-all disabled:opacity-40 ${theme.bg}`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Add Workouts ───────────────────────────────────────────────────────

function Step2({ workouts, onAddWorkout, onEditWorkout, onRemoveWorkout, onMoveWorkout, onContinue, onBack, theme }) {
  return (
    <div className="min-h-screen pb-36">
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <BackBtn onClick={onBack} />
          <div>
            <p className="text-xs text-c-muted font-semibold uppercase tracking-wide">Step 2 of 4</p>
            <h1 className="text-2xl font-bold">Add Workouts</h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {workouts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🏋️</p>
            <p className="text-c-muted text-sm">No workouts yet. Add at least one to continue.</p>
          </div>
        )}

        {workouts.map((w, idx) => {
          const exerciseCount = w.sections?.flatMap(s => s.exercises).length || 0
          return (
            <div key={w.id} className="bg-card rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl shrink-0">{w.emoji}</span>
              <button className="flex-1 min-w-0 text-left" onClick={() => onEditWorkout(idx)}>
                <p className="font-semibold text-sm truncate">{w.name}</p>
                <p className="text-xs text-c-muted">
                  {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} · tap to edit
                </p>
              </button>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => onMoveWorkout(idx, -1)}
                  disabled={idx === 0}
                  className="p-2 text-c-muted disabled:opacity-20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onMoveWorkout(idx, 1)}
                  disabled={idx === workouts.length - 1}
                  className="p-2 text-c-muted disabled:opacity-20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => onRemoveWorkout(idx)}
                  className="p-2 text-red-400/70 hover:text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}

        <button
          onClick={onAddWorkout}
          className="w-full py-3.5 rounded-2xl border border-dashed border-c-base text-c-secondary font-semibold text-sm flex items-center justify-center gap-2 hover:bg-card transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add Workout
        </button>

        <button
          onClick={onContinue}
          disabled={workouts.length === 0}
          className={`w-full py-4 rounded-2xl font-bold ${theme.textOnBg} text-base transition-all disabled:opacity-40 ${theme.bg}`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Set Rotation ───────────────────────────────────────────────────────

function Step3({ workouts, rotation, setRotation, onContinue, onBack, theme }) {
  const getLabel = id => id === 'rest' ? 'Rest Day' : (workouts.find(w => w.id === id)?.name || id)
  const getEmoji = id => id === 'rest' ? '😴' : (workouts.find(w => w.id === id)?.emoji || '🏋️')

  const moveItem = (idx, dir) => {
    setRotation(prev => {
      const next = [...prev]
      const to = idx + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
  }

  const removeItem = idx => setRotation(prev => prev.filter((_, i) => i !== idx))

  return (
    <div className="min-h-screen pb-36">
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <BackBtn onClick={onBack} />
          <div>
            <p className="text-xs text-c-muted font-semibold uppercase tracking-wide">Step 3 of 4</p>
            <h1 className="text-2xl font-bold">Set Rotation</h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {/* Preview */}
        <div className="bg-card rounded-2xl p-4">
          <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-2">Preview</p>
          <p className="text-sm text-c-secondary leading-relaxed">
            {rotation.length === 0
              ? 'No days set — add workouts below.'
              : rotation.map((id, i) => `Day ${i + 1}: ${getLabel(id)}`).join(' · ')
            }
          </p>
        </div>

        {/* Rotation list */}
        {rotation.map((id, idx) => (
          <div key={`${id}-${idx}`} className="bg-card rounded-2xl p-4 flex items-center gap-3">
            <span className="text-xl shrink-0">{getEmoji(id)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-c-muted">Day {idx + 1}</p>
              <p className="font-semibold text-sm truncate">{getLabel(id)}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                className="p-2 text-c-muted disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => moveItem(idx, 1)}
                disabled={idx === rotation.length - 1}
                className="p-2 text-c-muted disabled:opacity-20"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={() => removeItem(idx)}
                className="p-2 text-red-400/70 hover:text-red-400"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Add to rotation */}
        <div className="bg-card rounded-2xl p-4">
          <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-3">
            Add to rotation
          </p>
          <div className="flex flex-wrap gap-2">
            {workouts.map(w => (
              <button
                key={w.id}
                onClick={() => setRotation(prev => [...prev, w.id])}
                className="flex items-center gap-1.5 bg-item text-c-secondary text-sm px-3 py-2 rounded-xl font-medium hover:bg-hover transition-colors"
              >
                <span>{w.emoji}</span>
                <span className="max-w-[120px] truncate">{w.name}</span>
              </button>
            ))}
            <button
              onClick={() => setRotation(prev => [...prev, 'rest'])}
              className="flex items-center gap-1.5 bg-item text-c-secondary text-sm px-3 py-2 rounded-xl font-medium hover:bg-hover transition-colors"
            >
              😴 Rest Day
            </button>
          </div>
        </div>

        <button
          onClick={onContinue}
          disabled={rotation.length === 0}
          className={`w-full py-4 rounded-2xl font-bold ${theme.textOnBg} text-base transition-all disabled:opacity-40 ${theme.bg}`}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Review & Save ──────────────────────────────────────────────────────

function Step4({ splitName, splitEmoji, workouts, rotation, isEdit, onSave, onBack, theme }) {
  const [makeActive, setMakeActive] = useState(!isEdit)

  const getLabel = id => id === 'rest' ? 'Rest' : (workouts.find(w => w.id === id)?.name || id)

  const totalExercises = workouts.reduce(
    (sum, w) => sum + w.sections.flatMap(s => s.exercises).length,
    0
  )

  return (
    <div className="min-h-screen pb-36">
      <div
        className="sticky top-0 bg-base z-30 px-4 pb-4"
        style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <BackBtn onClick={onBack} />
          <div>
            <p className="text-xs text-c-muted font-semibold uppercase tracking-wide">Step 4 of 4</p>
            <h1 className="text-2xl font-bold">Review & Save</h1>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Summary */}
        <div className="bg-card rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{splitEmoji}</span>
            <div>
              <h2 className="font-bold text-xl leading-tight">{splitName}</h2>
              <p className="text-sm text-c-muted mt-0.5">
                {workouts.length} workout{workouts.length !== 1 ? 's' : ''} · {totalExercises} exercises · {rotation.length}-day rotation
              </p>
            </div>
          </div>

          <div className="space-y-1.5 mb-4">
            {workouts.map(w => {
              const count = w.sections.flatMap(s => s.exercises).length
              return (
                <div key={w.id} className="flex items-center gap-2 bg-item rounded-xl px-3 py-2.5">
                  <span className="text-base">{w.emoji}</span>
                  <span className="flex-1 text-sm font-medium truncate">{w.name}</span>
                  <span className="text-xs text-c-muted shrink-0">{count} ex</span>
                </div>
              )
            })}
          </div>

          <div>
            <p className="text-xs text-c-muted font-semibold uppercase tracking-wide mb-1.5">Rotation</p>
            <p className="text-sm text-c-secondary leading-relaxed">
              {rotation.map((id, i) => `Day ${i + 1}: ${getLabel(id)}`).join(' · ')}
            </p>
          </div>
        </div>

        {/* Set as active toggle (create mode only) */}
        {!isEdit && (
          <button
            onClick={() => setMakeActive(v => !v)}
            className="w-full flex items-center justify-between bg-card rounded-2xl px-5 py-4"
          >
            <span className="font-semibold text-sm">Set as active split</span>
            <div className={`w-12 h-6 rounded-full transition-colors relative ${makeActive ? theme.bg : 'bg-item'}`}>
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${makeActive ? 'right-0.5' : 'left-0.5'}`} />
            </div>
          </button>
        )}

        <button
          onClick={() => onSave(makeActive)}
          className={`w-full py-4 rounded-2xl font-bold ${theme.textOnBg} text-base ${theme.bg}`}
        >
          {isEdit ? 'Save Changes' : 'Save Split'}
        </button>
      </div>
    </div>
  )
}

// ── Main SplitBuilder ──────────────────────────────────────────────────────────

export default function SplitBuilder() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { splits, addSplit, updateSplit, setActiveSplit, settings } = useStore()
  const theme = getTheme(settings.accentColor)

  const isEdit = !!id
  const existingSplit = isEdit ? splits.find(s => s.id === id) : null

  // Views: 'step1' | 'step2' | 'workout-builder' | 'step3' | 'step4'
  const [view, setView] = useState('step1')

  // Split data
  const [splitName, setSplitName] = useState(existingSplit?.name || '')
  const [splitEmoji, setSplitEmoji] = useState(existingSplit?.emoji || '🏋️')
  const [workouts, setWorkouts] = useState(
    existingSplit?.workouts
      ? existingSplit.workouts.map(w => ({
          ...w,
          // Ensure workouts have name/emoji defaults in case they're missing (e.g. imported splits)
          name: w.name || 'Workout',
          emoji: w.emoji || '🏋️',
          sections: (w.sections || []).map(s => ({
            ...s,
            // Normalize exercises: imported splits may store {name, note} objects — flatten to strings
            exercises: (s.exercises || []).map(ex =>
              typeof ex === 'string' ? ex : (ex?.name || '')
            ).filter(Boolean),
          })),
        }))
      : []
  )
  const [rotation, setRotation] = useState(existingSplit?.rotation ? [...existingSplit.rotation] : [])

  // Workout builder
  const [editingIdx, setEditingIdx] = useState(null)

  const openWorkoutBuilder = (idx = null) => {
    setEditingIdx(idx)
    setView('workout-builder')
  }

  const handleSaveWorkout = (workout) => {
    if (editingIdx === null) {
      setWorkouts(prev => [...prev, workout])
      setRotation(prev => [...prev, workout.id])
    } else {
      setWorkouts(prev => prev.map((w, i) => i === editingIdx ? workout : w))
    }
    setView('step2')
  }

  const handleMoveWorkout = (idx, dir) => {
    setWorkouts(prev => {
      const next = [...prev]
      const to = idx + dir
      if (to < 0 || to >= next.length) return prev
      ;[next[idx], next[to]] = [next[to], next[idx]]
      return next
    })
  }

  const handleRemoveWorkout = (idx) => {
    const removed = workouts[idx]
    setWorkouts(prev => prev.filter((_, i) => i !== idx))
    setRotation(prev => prev.filter(rid => rid !== removed.id))
  }

  const handleContinueToStep3 = () => {
    // Pre-populate rotation with workout order if it only has exactly the workout IDs
    // (no rest days added yet) and user hasn't manually modified it from the default
    if (rotation.length === 0) {
      setRotation(workouts.map(w => w.id))
    }
    setView('step3')
  }

  const handleSave = (makeActive) => {
    const splitData = {
      name: splitName,
      emoji: splitEmoji,
      workouts,
      rotation,
      isBuiltIn: false,
    }
    if (isEdit) {
      updateSplit(id, splitData)
    } else {
      const newSplit = addSplit(splitData)
      if (makeActive) setActiveSplit(newSplit.id)
    }
    navigate('/splits')
  }

  const handleBack = () => {
    switch (view) {
      case 'step1':          navigate('/splits'); break
      case 'step2':          setView('step1'); break
      case 'workout-builder': setView('step2'); break
      case 'step3':          setView('step2'); break
      case 'step4':          setView('step3'); break
      default:               navigate('/splits')
    }
  }

  const editingWorkout = editingIdx !== null ? workouts[editingIdx] : null

  if (view === 'workout-builder') {
    return (
      <WorkoutBuilder
        workout={editingWorkout}
        onSave={handleSaveWorkout}
        onBack={handleBack}
        theme={theme}
      />
    )
  }

  if (view === 'step1') {
    return (
      <Step1
        name={splitName}
        setName={setSplitName}
        emoji={splitEmoji}
        setEmoji={setSplitEmoji}
        onBack={handleBack}
        onContinue={() => setView('step2')}
        theme={theme}
      />
    )
  }

  if (view === 'step2') {
    return (
      <Step2
        workouts={workouts}
        onAddWorkout={() => openWorkoutBuilder(null)}
        onEditWorkout={idx => openWorkoutBuilder(idx)}
        onRemoveWorkout={handleRemoveWorkout}
        onMoveWorkout={handleMoveWorkout}
        onContinue={handleContinueToStep3}
        onBack={handleBack}
        theme={theme}
      />
    )
  }

  if (view === 'step3') {
    return (
      <Step3
        workouts={workouts}
        rotation={rotation}
        setRotation={setRotation}
        onContinue={() => setView('step4')}
        onBack={handleBack}
        theme={theme}
      />
    )
  }

  return (
    <Step4
      splitName={splitName}
      splitEmoji={splitEmoji}
      workouts={workouts}
      rotation={rotation}
      isEdit={isEdit}
      onSave={handleSave}
      onBack={handleBack}
      theme={theme}
    />
  )
}
