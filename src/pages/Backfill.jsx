import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exerciseLibrary'
import { getTheme } from '../theme'
import { perSideLoad, formatDate } from '../utils/helpers'

// One-time onboarding screen for tagging user-created exercises that the
// V2→V3 migration could not resolve to the built-in library (spec §3.2.1).
//
// Batch 16j rewrite — each card now uses LOCAL DRAFT STATE instead of
// auto-saving on every pill tap. The card stays visible while the user
// fiddles with muscle / equipment choices, and a green Confirm button
// appears once both fields are set. Only on Confirm does the card
// transition to a "Saved" state (300ms), then the tagExercise store
// action fires and the card falls out of the list. If the user makes a
// mistake, they can fix it later via /exercises (Batch 16j's Manage
// Exercise Library page).

function Pill({ selected, onClick, children, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
        selected
          ? `${theme.bg} text-white`
          : 'bg-item text-c-secondary hover:bg-hover'
      }`}
      style={selected ? { color: theme.contrastText } : undefined}
    >
      {children}
    </button>
  )
}

function lastLoggedSetFor(sessions, exerciseId) {
  if (!exerciseId) return null
  let best = null
  for (const s of sessions || []) {
    if (s?.mode !== 'bb' || !s?.data?.exercises) continue
    const ex = s.data.exercises.find(e => e.exerciseId === exerciseId)
    if (!ex) continue
    const topSet = (ex.sets || []).find(x => x.reps || x.weight)
    if (!topSet) continue
    const ts = new Date(s.date).getTime()
    if (!best || ts > best.ts) best = { ts, set: topSet, date: s.date }
  }
  return best
}

function ExerciseTagCard({ exercise, lastSet, onConfirm, theme }) {
  const [muscles, setMuscles]                 = useState(exercise.primaryMuscles || [])
  const [equipment, setEquipment]             = useState(
    exercise.equipment && exercise.equipment !== 'Other' ? exercise.equipment : ''
  )
  const [phase, setPhase]                     = useState('editing')    // 'editing' | 'saving'
  const canConfirm = muscles.length > 0 && !!equipment

  const toggleMuscle = (m) => {
    setMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    setPhase('saving')
    setTimeout(() => {
      onConfirm({ primaryMuscles: muscles, equipment })
    }, 350)
  }

  return (
    <div
      className="bg-card rounded-2xl p-4 mb-3 transition-all duration-300"
      style={phase === 'saving'
        ? { opacity: 0, transform: 'translateY(-6px)' }
        : undefined}
    >
      <div className="mb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold truncate">{exercise.name}</h3>
          {phase === 'saving' && (
            <span className="shrink-0 text-xs font-bold text-emerald-400">✓ Saved</span>
          )}
        </div>
        {lastSet && (
          <p className="text-xs text-c-muted mt-0.5">
            Last: {perSideLoad(lastSet.set) || '—'}
            {lastSet.set.reps ? ` × ${lastSet.set.reps}` : ''} · {formatDate(lastSet.date)}
          </p>
        )}
        {!lastSet && (
          <p className="text-xs text-c-muted mt-0.5">No sets logged yet</p>
        )}
      </div>

      <p className="text-xs text-c-dim font-medium mt-3 mb-1.5">
        Primary muscles <span className="text-c-muted">(pick at least one)</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map(m => (
          <Pill key={m} selected={muscles.includes(m)} onClick={() => toggleMuscle(m)} theme={theme}>
            {m}
          </Pill>
        ))}
      </div>

      <p className="text-xs text-c-dim font-medium mt-4 mb-1.5">Equipment</p>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {EQUIPMENT_TYPES.filter(eq => eq !== 'Other').map(eq => (
          <Pill key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)} theme={theme}>
            {eq}
          </Pill>
        ))}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!canConfirm || phase === 'saving'}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
          canConfirm
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
            : 'bg-item text-c-faint'
        }`}
      >
        {phase === 'saving' ? 'Saving…' : canConfirm ? '✓ Confirm' : 'Pick muscle group + equipment'}
      </button>
    </div>
  )
}

export default function Backfill() {
  const navigate = useNavigate()
  const { exerciseLibrary, sessions, settings, tagExercise } = useStore()
  const theme = getTheme(settings.accentColor)

  const needsTaggingExes = useMemo(
    () => exerciseLibrary.filter(e => e.needsTagging),
    [exerciseLibrary]
  )
  const totalToTag = needsTaggingExes.length
  const allDone    = totalToTag === 0

  return (
    <div className="min-h-screen bg-base text-c-primary pb-24" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top, 2rem))' }}>
      <div className="px-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold">Tag your exercises</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs text-c-muted active:text-c-secondary"
          >
            Skip for now
          </button>
        </div>

        {allDone ? (
          <div className="bg-card rounded-2xl p-6 mt-8 text-center">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-base font-semibold mb-1">All exercises tagged!</p>
            <p className="text-xs text-c-muted mb-5">
              You can edit any of them later in <button onClick={() => navigate('/exercises')} className="underline">My Exercises</button>.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm text-white ${theme.bg}`}
              style={{ color: theme.contrastText }}
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-c-secondary mb-2">
              Pick a muscle group and equipment for each exercise, then tap
              Confirm. You can edit any of these later in My Exercises, so no
              pressure to get it perfect first try.
            </p>
            <p className="text-xs text-c-muted mb-3">{totalToTag} remaining</p>

            {needsTaggingExes.map(ex => (
              <ExerciseTagCard
                key={ex.id}
                exercise={ex}
                lastSet={lastLoggedSetFor(sessions, ex.id)}
                onConfirm={patch => tagExercise(ex.id, patch)}
                theme={theme}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
