import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES } from '../data/exerciseLibrary'
import { getTheme } from '../theme'
import { perSideLoad, formatDate } from '../utils/helpers'

// One-time onboarding screen for tagging user-created exercises that the
// V2→V3 migration could not resolve to the built-in library. See spec §3.2.1.
// The page lists every library entry with needsTagging: true; auto-saves each
// pill tap via updateExerciseInLibrary; when both primaryMuscles and a non-
// placeholder equipment are set, the entry drops off the list (needsTagging
// clears and the card fades out).

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

function ExerciseTagCard({ exercise, lastSet, onUpdate, theme }) {
  const primaryMuscles = exercise.primaryMuscles || []
  const equipment = exercise.equipment

  const toggleMuscle = (m) => {
    const next = primaryMuscles.includes(m)
      ? primaryMuscles.filter(x => x !== m)
      : [...primaryMuscles, m]
    onUpdate({ primaryMuscles: next })
  }

  const setEquipment = (eq) => onUpdate({ equipment: eq })

  return (
    <div className="bg-card rounded-2xl p-4 mb-3">
      <div className="mb-2">
        <h3 className="text-base font-semibold">{exercise.name}</h3>
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

      <p className="text-xs text-c-dim font-medium mt-3 mb-1.5">Primary muscles</p>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map(m => (
          <Pill key={m} selected={primaryMuscles.includes(m)} onClick={() => toggleMuscle(m)} theme={theme}>
            {m}
          </Pill>
        ))}
      </div>

      <p className="text-xs text-c-dim font-medium mt-4 mb-1.5">Equipment</p>
      <div className="flex flex-wrap gap-1.5">
        {EQUIPMENT_TYPES.map(eq => (
          <Pill key={eq} selected={equipment === eq} onClick={() => setEquipment(eq)} theme={theme}>
            {eq}
          </Pill>
        ))}
      </div>
    </div>
  )
}

export default function Backfill() {
  const navigate = useNavigate()
  const { exerciseLibrary, sessions, settings, updateExerciseInLibrary } = useStore()
  const theme = getTheme(settings.accentColor)

  const needsTaggingExes = useMemo(
    () => exerciseLibrary.filter(e => e.needsTagging),
    [exerciseLibrary]
  )

  const totalToTag = needsTaggingExes.length

  // Snapshot the initial "to-tag" list so cards don't immediately vanish as
  // the user taps pills — they only disappear on next mount (or full save).
  // For now we filter live; if the pop-off feel is jarring, freeze here.
  const handleUpdate = (id, patch) => {
    const current = exerciseLibrary.find(e => e.id === id)
    if (!current) return
    const nextPrimary  = patch.primaryMuscles ?? current.primaryMuscles
    const nextEquip    = patch.equipment      ?? current.equipment
    const isComplete   = (nextPrimary || []).length > 0
      && nextEquip
      && nextEquip !== 'Other'
    updateExerciseInLibrary(id, {
      ...patch,
      needsTagging: !isComplete,
    })
  }

  const allDone = totalToTag === 0

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
            <p className="text-xs text-c-muted mb-5">Muscle-group insights and smarter recommendations are unlocked.</p>
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
            <p className="text-sm text-c-secondary mb-4">
              We've updated how your workouts are tracked. Pick a muscle group and
              equipment for each of your custom exercises to unlock better
              recommendations. Takes about a minute.
            </p>
            <p className="text-xs text-c-muted mb-3">{totalToTag} remaining</p>

            {needsTaggingExes.map(ex => (
              <ExerciseTagCard
                key={ex.id}
                exercise={ex}
                lastSet={lastLoggedSetFor(sessions, ex.id)}
                onUpdate={patch => handleUpdate(ex.id, patch)}
                theme={theme}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
