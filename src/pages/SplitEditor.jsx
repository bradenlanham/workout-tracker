import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE } from '../data/exercises'

// All workouts available to add back (not 'rest')
const ALL_WORKOUT_TYPES = Object.keys(BB_WORKOUT_NAMES).filter(k => k !== 'custom')

function ArrowBtn({ onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 flex items-center justify-center rounded-xl text-base font-bold transition-colors ${
        disabled ? 'opacity-20 text-c-faint' : 'bg-item text-c-secondary active:bg-hover'
      }`}
    >
      {children}
    </button>
  )
}

export default function SplitEditor() {
  const navigate = useNavigate()
  const { workoutSequence, updateWorkoutSequence, settings } = useStore()
  const theme = getTheme(settings.accentColor)

  const initial = (workoutSequence && workoutSequence.length) ? workoutSequence : BB_WORKOUT_SEQUENCE
  const [order, setOrder] = useState([...initial])
  const [confirmRemove, setConfirmRemove] = useState(null) // index
  const [showAddWorkout, setShowAddWorkout] = useState(false)

  const move = (idx, dir) => {
    const next = [...order]
    const target = idx + (dir === 'up' ? -1 : 1)
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
  }

  const remove = (idx) => {
    setOrder(order.filter((_, i) => i !== idx))
    setConfirmRemove(null)
  }

  const addRestDay = () => setOrder([...order, 'rest'])

  const addWorkout = (type) => {
    setOrder([...order, type])
    setShowAddWorkout(false)
  }

  const reset = () => setOrder([...BB_WORKOUT_SEQUENCE])

  const save = () => {
    const filtered = order.filter(Boolean)
    updateWorkoutSequence(filtered.length ? filtered : BB_WORKOUT_SEQUENCE)
    navigate(-1)
  }

  const itemName = (type) => type === 'rest' ? 'Rest Day' : BB_WORKOUT_NAMES[type] || type
  const itemEmoji = (type) => type === 'rest' ? '😴' : BB_WORKOUT_EMOJI[type] || '🏋️'

  return (
    <div className="min-h-screen pb-36">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-base z-30 px-4 pb-4" style={{ paddingTop: 'max(3rem, env(safe-area-inset-top, 3rem))' }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-card text-c-dim shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Manage Split</h1>
        </div>
        <p className="text-sm text-c-muted ml-12">Reorder workouts, add rest days, or remove entries.</p>
      </div>

      {/* ── Rotation list ───────────────────────────────────────────────────── */}
      <div className="px-4 space-y-2">
        {order.length === 0 && (
          <p className="text-center text-c-faint py-8 text-sm">No workouts in rotation. Add some below.</p>
        )}

        {order.map((type, idx) => (
          <div key={`${type}-${idx}`} className="flex items-center gap-2 bg-card rounded-xl px-3 py-3">
            {/* Day number */}
            <span className="text-xs text-c-faint font-bold w-6 shrink-0 text-center">
              {idx + 1}
            </span>

            {/* Emoji */}
            <span className="text-xl w-7 text-center shrink-0">{itemEmoji(type)}</span>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{itemName(type)}</p>
              {type === 'rest' && (
                <p className="text-xs text-c-faint">No training</p>
              )}
            </div>

            {/* Up/Down */}
            <div className="flex gap-1 shrink-0">
              <ArrowBtn onClick={() => move(idx, 'up')} disabled={idx === 0}>↑</ArrowBtn>
              <ArrowBtn onClick={() => move(idx, 'down')} disabled={idx === order.length - 1}>↓</ArrowBtn>
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={() => setConfirmRemove(idx)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-item text-red-400 active:bg-hover shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowAddWorkout(true)}
            className="flex-1 py-3 rounded-xl border-2 border-dashed border-c-base text-c-muted font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span className="text-base">+</span> Add Workout
          </button>
          <button
            onClick={addRestDay}
            className="flex-1 py-3 rounded-xl border-2 border-dashed border-c-base text-c-muted font-semibold text-sm flex items-center justify-center gap-1.5"
          >
            <span>😴</span> Add Rest Day
          </button>
        </div>
      </div>

      {/* ── Fixed footer ────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-base/95 backdrop-blur border-t border-c-subtle px-4 py-4 z-40"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
      >
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-3 rounded-2xl bg-card text-c-dim font-semibold text-sm"
          >
            Reset Default
          </button>
          <button
            onClick={save}
            className={`flex-1 ${theme.bg} ${theme.textOnBg} py-3 rounded-2xl font-bold`}
          >
            Save Split
          </button>
        </div>
      </div>

      {/* ── Confirm remove modal ─────────────────────────────────────────────── */}
      {confirmRemove !== null && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-5" onClick={() => setConfirmRemove(null)}>
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <p className="font-bold text-lg mb-1">Remove from rotation?</p>
            <p className="text-c-dim text-sm mb-5">
              {itemEmoji(order[confirmRemove])} {itemName(order[confirmRemove])} will be removed from the split.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 bg-item text-c-secondary py-3 rounded-xl font-semibold">
                Cancel
              </button>
              <button onClick={() => remove(confirmRemove)} className="flex-1 bg-red-500/20 border border-red-500/40 text-red-400 py-3 rounded-xl font-bold">
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add workout sheet ────────────────────────────────────────────────── */}
      {showAddWorkout && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowAddWorkout(false)}>
          <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-3">Add Workout</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {ALL_WORKOUT_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => addWorkout(type)}
                  className="w-full flex items-center gap-3 bg-item rounded-xl px-4 py-3 text-left"
                >
                  <span className="text-xl">{BB_WORKOUT_EMOJI[type]}</span>
                  <span className="font-medium">{BB_WORKOUT_NAMES[type]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddWorkout(false)} className="w-full mt-3 py-3 bg-item text-c-dim rounded-xl font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
