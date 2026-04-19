import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { formatRec } from '../utils/helpers'

// Batch 17h — structured REC editor (Step 9). Bottom sheet at z-275 (above
// WorkoutEditSheet's 270). Captures `{sets, reps, note}` with live preview.
// Accepts any incoming shape:
//   - null/undefined → start blank
//   - legacy string → pre-fills `note` (per decision D7, no auto-parse)
//   - structured obj → pre-fills each field
// Save returns `null` when all fields are empty (clears the REC), or a
// compact object containing only the set fields. Clear returns `null`
// explicitly.

export default function RecEditor({ current, onSave, onClose }) {
  const settings = useStore(s => s.settings)
  const theme = getTheme(settings.accentColor)

  // Normalize the incoming current value into a working shape. Legacy
  // strings become `note` per D7 — no auto-parsing.
  const initial = (() => {
    if (!current) return { sets: '', reps: '', note: '' }
    if (typeof current === 'string') return { sets: '', reps: '', note: current }
    return {
      sets: Number.isFinite(current.sets) ? String(current.sets) : '',
      reps: current.reps != null ? String(current.reps) : '',
      note: typeof current.note === 'string' ? current.note : '',
    }
  })()

  const [sets, setSets] = useState(initial.sets)
  const [reps, setReps] = useState(initial.reps)
  const [note, setNote] = useState(initial.note)

  // Esc dismisses
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const buildRec = () => {
    const rec = {}
    const setsNum = parseInt(sets, 10)
    if (Number.isFinite(setsNum) && setsNum > 0) rec.sets = setsNum
    const repsTrim = (reps || '').trim()
    if (repsTrim) rec.reps = repsTrim
    const noteTrim = (note || '').trim()
    if (noteTrim) rec.note = noteTrim
    return Object.keys(rec).length ? rec : null
  }

  const preview = formatRec(buildRec()) || '—'

  const handleSave = () => onSave(buildRec())
  const handleClear = () => onSave(null)

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 275 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit prescription"
        className="relative bg-card rounded-t-2xl w-full max-w-lg p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="pt-1 pb-2 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" aria-hidden="true" />
        </div>

        <div className="flex items-center mb-4">
          <h3 className="flex-1 text-base font-bold text-c-primary">Coach's prescription</h3>
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

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Sets</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={sets}
              onChange={e => setSets(e.target.value)}
              placeholder="—"
              className="w-full bg-base rounded-lg px-3 py-2.5 text-base outline-none border border-subtle"
            />
          </div>
          <div>
            <label className="block text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Reps</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={reps}
              onChange={e => setReps(e.target.value)}
              placeholder="8 or 8-12"
              className="w-full bg-base rounded-lg px-3 py-2.5 text-base outline-none border border-subtle"
            />
          </div>
        </div>

        <label className="block text-xs text-c-muted font-semibold uppercase tracking-wide mb-1">Note (optional)</label>
        <input
          type="text"
          maxLength={40}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. warmup, drop set, tempo"
          className="w-full bg-base rounded-lg px-3 py-2.5 text-sm outline-none border border-subtle mb-3"
        />

        <p className="text-xs text-c-muted mb-4">
          Preview: <span className="text-blue-300 font-semibold">{preview}</span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 py-2.5 rounded-lg bg-item text-c-secondary font-semibold text-sm"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm text-white ${theme.bg}`}
            style={{ color: theme.contrastText }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
