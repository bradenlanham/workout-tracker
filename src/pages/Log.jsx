import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { getTheme } from '../theme'
import { getNextBbWorkout } from '../utils/helpers'
import { BB_WORKOUT_NAMES, BB_WORKOUT_EMOJI, BB_WORKOUT_SEQUENCE } from '../data/exercises'

function SectionHeader({ children }) {
  return <p className="text-xs text-c-muted font-semibold uppercase tracking-wider mb-2">{children}</p>
}

// ── Split reorder modal ────────────────────────────────────────────────────────

function SplitModal({ sequence, onSave, onClose, theme }) {
  const [order, setOrder] = useState([...sequence])

  const move = (idx, direction) => {
    const next = [...order]
    const target = idx + (direction === 'up' ? -1 : 1)
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
  }

  const reset = () => setOrder([...BB_WORKOUT_SEQUENCE])

  const getName  = (type) => type === 'rest' ? 'Rest Day'   : BB_WORKOUT_NAMES[type]  || type
  const getEmoji = (type) => type === 'rest' ? '😴'         : BB_WORKOUT_EMOJI[type]  || '🏋️'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={onClose}>
      <div className="bg-card w-full max-w-lg mx-auto rounded-t-3xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Split Order</h3>
          <button onClick={reset} className="text-xs text-c-dim underline">Reset to default</button>
        </div>
        <p className="text-xs text-c-muted mb-3">Use arrows to set the rotation order.</p>
        <div className="space-y-2 mb-4">
          {order.map((type, idx) => (
            <div key={`${type}-${idx}`} className="flex items-center gap-3 bg-item rounded-xl px-4 py-3">
              <span className="text-lg">{getEmoji(type)}</span>
              <span className="flex-1 font-medium text-sm">{getName(type)}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => move(idx, 'up')}
                  disabled={idx === 0}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-c-dim ${
                    idx === 0 ? 'opacity-20' : 'bg-item'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => move(idx, 'down')}
                  disabled={idx === order.length - 1}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-c-dim ${
                    idx === order.length - 1 ? 'opacity-20' : 'bg-item'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-item text-c-secondary py-3 rounded-xl font-semibold">
            Cancel
          </button>
          <button
            onClick={() => { onSave(order); onClose() }}
            className={`flex-1 ${theme.bg} text-white py-3 rounded-xl font-semibold`}
            style={{ color: theme.contrastText }}
          >
            Save Order
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Log screen ────────────────────────────────────────────────────────────

export default function Log() {
  const navigate = useNavigate()
  const {
    sessions, settings, customTemplates,
    splits, activeSplitId,
    workoutSequence, updateWorkoutSequence,
  } = useStore()
  const theme = getTheme(settings.accentColor)
  const [showSplit, setShowSplit] = useState(false)

  // ── Active split ───────────────────────────────────────────────────────────
  const activeSplit = splits?.find(s => s.id === activeSplitId) || splits?.[0] || null
  const rotation = activeSplit?.rotation || (workoutSequence && workoutSequence.length ? workoutSequence : BB_WORKOUT_SEQUENCE)

  // Batch 55 — thread rotationMode so Log picker honors week-mode (HYROX
  // Hybrid + user week-mapped splits) for "next workout" detection.
  const rotationMode = activeSplit?.rotationMode || 'cycle'
  const nextBb = getNextBbWorkout(sessions, rotation, rotationMode)

  // Workout list: from active split's workouts, or fall back to rotation keys
  const workoutList = activeSplit?.workouts || rotation
    .filter(t => t !== 'rest')
    .map(t => ({ id: t, name: BB_WORKOUT_NAMES[t] || t, emoji: BB_WORKOUT_EMOJI[t] || '🏋️' }))

  const getWorkoutName  = (wId) => activeSplit?.workouts?.find(w => w.id === wId)?.name  || BB_WORKOUT_NAMES[wId]  || wId
  const getWorkoutEmoji = (wId) => activeSplit?.workouts?.find(w => w.id === wId)?.emoji || BB_WORKOUT_EMOJI[wId] || '🏋️'

  const getLastCompletedDate = (wId) => {
    const match = sessions
      .filter(s => s.type === wId && s.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    if (!match) return null
    return new Date(match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Sequence for the split reorder modal (uses built-in rotation incl. rest days)
  const effectiveSequence = activeSplit?.rotation ||
    (workoutSequence && workoutSequence.length ? workoutSequence : BB_WORKOUT_SEQUENCE)

  return (
    <div className="pb-nav min-h-screen">
      <div className="sticky top-0 bg-base z-30 px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 20px)' }}>
        <h1 className="text-2xl font-bold mb-4">Log Session</h1>
      </div>

      <div className="px-4 space-y-5">
        {/* Active split workouts */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionHeader>All Workouts</SectionHeader>
            <button
              onClick={() => setShowSplit(true)}
              className="text-xs text-c-muted underline"
            >
              Edit split order
            </button>
          </div>
          {activeSplit && (
            <p className="text-xs text-c-muted mb-2 -mt-1">
              {activeSplit.emoji} {activeSplit.name}
            </p>
          )}
          <div className="space-y-2">
            {workoutList.map(w => (
              <button
                key={w.id}
                onClick={() => navigate(`/log/bb/${w.id}`)}
                className={`w-full flex items-center justify-between bg-card rounded-xl p-4 transition-colors ${
                  w.id === nextBb ? `ring-1 ${theme.ring}` : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{w.emoji}</span>
                  <div className="text-left">
                    <p className="font-semibold">{w.name}</p>
                    {w.id === nextBb && (
                      <p className={`text-xs ${theme.text}`}>Suggested next</p>
                    )}
                    {(() => {
                      const lastDate = getLastCompletedDate(w.id)
                      return lastDate
                        ? <p className="text-xs text-c-muted">{lastDate}</p>
                        : null
                    })()}
                  </div>
                </div>
                <svg className="w-5 h-5 text-c-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
            {/* Custom workout */}
            <button
              onClick={() => navigate('/log/bb/custom')}
              className="w-full flex items-center justify-between bg-card rounded-xl p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">✏️</span>
                <p className="font-semibold">{BB_WORKOUT_NAMES.custom}</p>
              </div>
              <svg className="w-5 h-5 text-c-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Custom templates */}
        {customTemplates.length > 0 && (
          <div>
            <SectionHeader>My Templates</SectionHeader>
            <div className="space-y-2">
              {customTemplates.map(tpl => (
                <div key={tpl.id} className="flex gap-2">
                  <button
                    onClick={() => navigate(`/log/bb/tpl_${tpl.id}`)}
                    className="flex-1 flex items-center justify-between bg-card rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tpl.emoji}</span>
                      <p className="font-semibold">{tpl.name}</p>
                    </div>
                    <svg className="w-5 h-5 text-c-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => navigate(`/templates/${tpl.id}`)}
                    className="w-12 flex items-center justify-center bg-card rounded-xl text-c-muted"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Split order modal */}
      {showSplit && (
        <SplitModal
          sequence={effectiveSequence}
          onSave={updateWorkoutSequence}
          onClose={() => setShowSplit(false)}
          theme={theme}
        />
      )}
    </div>
  )
}
