import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'

const SECTION_LABELS = ['Primary', 'Choose 1', 'If You Have Time', 'Accessory', 'Cardio']
const EMOJI_OPTIONS  = ['🏋️', '💪', '🦵', '🎯', '🦿', '🔥', '⚡', '🏃', '🤸', '🧗', '🥊', '✏️']

function AddExerciseInline({ onAdd, onCancel }) {
  const [name, setName] = useState('')
  return (
    <div className="flex gap-2 mt-2">
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Exercise name…"
        className="flex-1 bg-item text-c-primary rounded-lg px-3 py-2 text-sm"
        onKeyDown={e => {
          if (e.key === 'Enter' && name.trim()) { onAdd(name.trim()); setName('') }
          if (e.key === 'Escape') onCancel()
        }}
      />
      <button
        type="button"
        onClick={() => { if (name.trim()) { onAdd(name.trim()); setName('') } }}
        className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-3 py-2 bg-item text-c-dim rounded-lg text-sm"
      >
        Cancel
      </button>
    </div>
  )
}

export default function TemplateEditor() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { settings, customTemplates, addCustomTemplate, updateCustomTemplate, deleteCustomTemplate } = useStore()
  const theme      = getTheme(settings.accentColor)

  const existing = id ? customTemplates.find(t => t.id === id) : null

  const [name, setName]         = useState(existing?.name || '')
  const [emoji, setEmoji]       = useState(existing?.emoji || '🏋️')
  const [groups, setGroups]     = useState(
    existing?.groups || [{ label: 'Primary', exercises: [] }]
  )
  const [addingEx, setAddingEx] = useState(null)  // index of group being edited
  const [showEmoji, setShowEmoji] = useState(false)

  // ── Group management ──────────────────────────────────────────────────────

  const addGroup = () => {
    const usedLabels = groups.map(g => g.label)
    const nextLabel  = SECTION_LABELS.find(l => !usedLabels.includes(l)) || 'Section'
    setGroups(prev => [...prev, { label: nextLabel, exercises: [] }])
  }

  const updateGroupLabel = (gi, label) => {
    setGroups(prev => prev.map((g, i) => i === gi ? { ...g, label } : g))
  }

  const removeGroup = (gi) => {
    setGroups(prev => prev.filter((_, i) => i !== gi))
  }

  // ── Exercise management ───────────────────────────────────────────────────

  const addExercise = (gi, exName) => {
    setGroups(prev => prev.map((g, i) =>
      i === gi ? { ...g, exercises: [...g.exercises, exName] } : g
    ))
  }

  const removeExercise = (gi, ei) => {
    setGroups(prev => prev.map((g, i) =>
      i === gi ? { ...g, exercises: g.exercises.filter((_, j) => j !== ei) } : g
    ))
  }

  const moveExercise = (gi, ei, direction) => {
    setGroups(prev => prev.map((g, i) => {
      if (i !== gi) return g
      const exes = [...g.exercises]
      const target = ei + (direction === 'up' ? -1 : 1)
      if (target < 0 || target >= exes.length) return g
      ;[exes[ei], exes[target]] = [exes[target], exes[ei]]
      return { ...g, exercises: exes }
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!name.trim()) return
    const template = { name: name.trim(), emoji, groups }
    if (existing) {
      updateCustomTemplate(existing.id, template)
    } else {
      addCustomTemplate(template)
    }
    navigate('/log')
  }

  const handleDelete = () => {
    if (existing) deleteCustomTemplate(existing.id)
    navigate('/log')
  }

  return (
    <div className="min-h-screen pb-32">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-base z-30 px-4 pt-12 pb-4 border-b border-c-subtle">
        <div className="flex items-center gap-3 mb-4 pr-14">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-card"
          >
            <svg className="w-5 h-5 text-c-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold flex-1">
            {existing ? 'Edit Template' : 'New Template'}
          </h1>
          {existing && (
            <button
              onClick={handleDelete}
              className="text-red-400 text-sm font-semibold"
            >
              Delete
            </button>
          )}
        </div>

        {/* Name + emoji */}
        <div className="flex gap-3 items-start">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmoji(v => !v)}
              className="w-14 h-14 bg-card rounded-2xl flex items-center justify-center text-3xl border border-c-base"
            >
              {emoji}
            </button>
            {showEmoji && (
              <div className="absolute top-16 left-0 z-50 bg-card border border-c-base rounded-2xl p-3 grid grid-cols-6 gap-2 w-52 shadow-xl">
                {EMOJI_OPTIONS.map(e => (
                  <button
                    key={e}
                    onClick={() => { setEmoji(e); setShowEmoji(false) }}
                    className="text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-hover"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Template name…"
            className="flex-1 bg-card text-c-primary rounded-2xl px-4 py-4 text-lg font-semibold border border-c-base placeholder-gray-400"
          />
        </div>
      </div>

      {/* ── Sections ────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 space-y-4">

        {groups.map((group, gi) => (
          <div key={gi} className="bg-card rounded-2xl overflow-hidden">
            {/* Section header */}
            <div className="flex items-center gap-2 p-3 border-b border-c-base">
              <select
                value={group.label}
                onChange={e => updateGroupLabel(gi, e.target.value)}
                className="flex-1 bg-item text-c-primary rounded-lg px-3 py-2 text-sm font-semibold"
              >
                {SECTION_LABELS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
                {!SECTION_LABELS.includes(group.label) && (
                  <option value={group.label}>{group.label}</option>
                )}
              </select>
              <button
                type="button"
                onClick={() => removeGroup(gi)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-item text-c-muted"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Exercise list */}
            <div className="p-3 space-y-1">
              {group.exercises.map((ex, ei) => (
                <div key={ei} className="flex items-center gap-2 bg-item rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm font-medium text-c-secondary">{ex}</span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveExercise(gi, ei, 'up')}
                      disabled={ei === 0}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-c-muted ${
                        ei === 0 ? 'opacity-20' : 'bg-hover'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(gi, ei, 'down')}
                      disabled={ei === group.exercises.length - 1}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-c-muted ${
                        ei === group.exercises.length - 1 ? 'opacity-20' : 'bg-hover'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeExercise(gi, ei)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-hover text-c-muted"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Add exercise inline */}
              {addingEx === gi ? (
                <AddExerciseInline
                  onAdd={(exName) => addExercise(gi, exName)}
                  onCancel={() => setAddingEx(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingEx(gi)}
                  className="w-full py-2 rounded-xl border border-dashed border-c-base text-c-muted text-sm font-medium flex items-center justify-center gap-1.5 mt-1"
                >
                  <span>+</span> Add exercise
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add section */}
        <button
          type="button"
          onClick={addGroup}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-c-base text-c-muted font-semibold flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span> Add Section
        </button>
      </div>

      {/* ── Footer save button ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-base/95 backdrop-blur border-t border-c-subtle px-4 py-4 z-40">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className={`w-full py-4 rounded-2xl font-bold text-lg transition-opacity ${
            name.trim() ? `${theme.bg} text-white` : 'bg-item text-c-muted opacity-50'
          }`}
        >
          {existing ? 'Save Changes' : 'Create Template'}
        </button>
      </div>
    </div>
  )
}
