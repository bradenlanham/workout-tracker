import { useState } from 'react'
import CameraCapture from './CameraCapture'

export default function ShareCard({ data, onDone, sessionId, onUpdateSession, initialSelfie }) {
  const {
    userName, workoutName, workoutEmoji, dateStr, durationStr,
    totalVolume, totalSets, totalPRs, exerciseSummary,
    grade, cardio, theme,
  } = data

  const [selfie, setSelfie] = useState(initialSelfie || null)
  const [showCamera, setShowCamera] = useState(false)

  const formatVolume = (v) => {
    if (v === 0) return '—'
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k lbs'
    return v.toLocaleString() + ' lbs'
  }

  const gradeColor = (g) => {
    if (g === 'A+') return theme.text
    if (g === 'A')  return 'text-emerald-400'
    if (g === 'B')  return 'text-blue-400'
    if (g === 'C')  return 'text-yellow-400'
    return 'text-red-400'
  }

  // Working sets summary: count + heaviest set (by weight, then reps as tiebreak)
  const getSetSummary = (sets) => {
    const working = sets.filter(s => s.type === 'working' && (s.weight > 0 || s.reps > 0))
    if (!working.length) return null
    const best = working.reduce((b, s) => {
      if (!b) return s
      if (s.weight > b.weight) return s
      if (s.weight === b.weight && s.reps > b.reps) return s
      return b
    }, null)
    return { count: working.length, best }
  }

  function handleCapture(dataUrl) {
    setSelfie(dataUrl)
    setShowCamera(false)
    if (sessionId && onUpdateSession) {
      onUpdateSession(sessionId, { selfie: dataUrl })
    }
  }

  function removeSelfie() {
    setSelfie(null)
    if (sessionId && onUpdateSession) {
      onUpdateSession(sessionId, { selfie: null })
    }
  }

  return (
    <>
      {showCamera && (
        <CameraCapture
          onCapture={handleCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}

      <div
        className="fixed inset-0 z-[60] bg-base flex flex-col items-center overflow-y-auto"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
        }}
      >
        <div className="w-full max-w-sm px-4 flex flex-col items-center gap-4">

          {/* ── Card ─────────────────────────────────────────────────────── */}
          <div className="w-full">
            {/* Accent stripe */}
            <div className={`${theme.bg} h-1.5 rounded-t-3xl`} />

            <div className="bg-card rounded-b-3xl px-5 pt-4 pb-5 shadow-2xl">

              {/* ── Selfie area ────────────────────────────────────────────── */}
              {selfie ? (
                <div className="relative mb-4">
                  <img
                    src={selfie}
                    alt="Workout selfie"
                    className="w-full rounded-2xl"
                    style={{ aspectRatio: '3/4', objectFit: 'cover' }}
                    onClick={() => setShowCamera(true)}
                  />
                  {/* Remove button */}
                  <button
                    onClick={removeSelfie}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs font-bold leading-none"
                    aria-label="Remove selfie"
                  >
                    ×
                  </button>
                  {/* Retake hint */}
                  <p className="text-xs text-c-faint text-center mt-1">tap photo to retake</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowCamera(true)}
                  className={`w-full mb-4 py-3.5 rounded-2xl border-2 ${theme.text} font-medium flex items-center justify-center gap-2 active:opacity-70 transition-opacity`}
                  style={{
                    borderColor: 'currentColor',
                    fontSize: '14px',
                    backgroundColor: 'color-mix(in srgb, currentColor 8%, transparent)',
                  }}
                >
                  📸 Add a selfie
                </button>
              )}

              {/* User name */}
              {userName && (
                <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-2">
                  {userName}
                </p>
              )}

              {/* Workout title */}
              <h1 className="text-xl font-bold leading-tight">
                {workoutEmoji} {workoutName}
              </h1>

              {/* Date · Duration */}
              <p className="text-xs text-c-muted mt-1">
                {dateStr}&nbsp;·&nbsp;{durationStr}
              </p>

              {/* ── Stats row ─────────────────────────────────────────────── */}
              <div className="flex gap-1.5 mt-4">
                <div className="flex-1 bg-item rounded-xl px-1.5 py-2 text-center">
                  <p className={`text-sm font-bold leading-none ${theme.text}`}>
                    {formatVolume(totalVolume)}
                  </p>
                  <p className="text-xs text-c-faint mt-0.5">vol</p>
                </div>
                <div className="flex-1 bg-item rounded-xl px-1.5 py-2 text-center">
                  <p className={`text-lg font-bold leading-none ${theme.text}`}>{totalSets}</p>
                  <p className="text-xs text-c-faint mt-0.5">sets</p>
                </div>
                {totalPRs > 0 && (
                  <div className="flex-1 bg-amber-500/10 rounded-xl px-1.5 py-2 text-center">
                    <p className="text-lg font-bold leading-none text-amber-400">{totalPRs} 🏆</p>
                    <p className="text-xs text-amber-500/60 mt-0.5">PRs</p>
                  </div>
                )}
                {grade && (
                  <div className="flex-1 bg-item rounded-xl px-1.5 py-2 text-center">
                    <p className={`text-lg font-bold leading-none ${gradeColor(grade)}`}>{grade}</p>
                    <p className="text-xs text-c-faint mt-0.5">grade</p>
                  </div>
                )}
              </div>

              {/* ── Exercise breakdown (best set per exercise, one line) ───── */}
              {exerciseSummary.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-1.5">
                    Exercises
                  </p>
                  <div className="space-y-0">
                    {exerciseSummary.map((ex, i) => {
                      const summary = getSetSummary(ex.sets)
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-2 py-1.5 ${i > 0 ? 'border-t border-c-base' : ''}`}
                        >
                          <p className="text-sm flex-1 truncate">
                            <span className="font-semibold">{ex.name}</span>
                            {summary && (
                              <span className="text-c-secondary font-normal">
                                {' '}<span className="text-emerald-400">✓</span>{' '}{summary.count} sets
                                {summary.best && (
                                  <> · Top Set: {summary.best.weight > 0
                                    ? `${summary.best.weight} × ${summary.best.reps}`
                                    : `${summary.best.reps} reps`}</>
                                )}
                              </span>
                            )}
                          </p>
                          {ex.hasPR && (
                            <span className="shrink-0 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">
                              PR
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Cardio section ────────────────────────────────────────── */}
              {cardio?.completed && (
                <div className="mt-3 pt-3 border-t border-c-base">
                  <p className="text-xs text-c-faint font-semibold uppercase tracking-widest mb-1">
                    Cardio
                  </p>
                  <p className="text-sm font-semibold text-emerald-400">
                    {[
                      cardio.type,
                      cardio.duration ? `${cardio.duration} min` : null,
                      cardio.heartRate ? `${cardio.heartRate} bpm` : null,
                    ].filter(Boolean).join(' · ')}
                  </p>
                  {cardio.notes && (
                    <p className="text-xs text-c-faint italic mt-0.5">{cardio.notes}</p>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* ── Done ─────────────────────────────────────────────────────── */}
          <div className="text-center">
            <button
              onClick={onDone}
              className={`${theme.bg} text-white font-bold py-3.5 px-14 rounded-2xl text-base`}
              style={{ color: theme.contrastText }}
            >
              Done
            </button>
            <p className="text-xs text-c-faint mt-2">tap to continue</p>
          </div>

        </div>
      </div>
    </>
  )
}
